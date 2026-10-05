/**
 * lib/date.ts
 *
 * Timezone-aware date helpers.
 *
 * Rules (standing decisions — do not reverse):
 *  - Date keys are "YYYY-MM-DD" in the USER's local timezone, not UTC.
 *  - Timestamps (ISO 8601 UTC) are kept separately from date keys.
 *  - Never use new Date().toISOString().slice(0,10) — that is UTC, not local time.
 */

import {
  format,
  parseISO,
  differenceInCalendarDays,
  isValid,
  subDays,
  addDays,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  getISOWeek,
  getYear,
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

/**
 * Resolves the operational workday date key ("YYYY-MM-DD") for a given point in time (`now`),
 * taking into account the user's timezone and workday cutoff time ("HH:mm").
 *
 * Rules:
 *  - For a 6:00 AM cutoff ("06:00"):
 *    - 2026-10-01 01:00 local resolves to "2026-09-30" workday.
 *    - 2026-10-01 06:00 local resolves to "2026-10-01" workday.
 *  - For a default 12:00 AM cutoff ("00:00"):
 *    - Resolves to the local calendar day.
 *  - DST-safe: uses calendar day subtraction (subDays) so clock shifts never corrupt date keys.
 */
export function operationalDate(
  now: Date | number | string = new Date(),
  timezone?: string,
  cutoffTime: string = "00:00",
): string {
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dateObj =
    now instanceof Date
      ? now
      : typeof now === "number"
        ? new Date(now)
        : new Date(now);
  const zoned = toZonedTime(dateObj, tz);

  const [cutoffH = 0, cutoffM = 0] = (cutoffTime || "00:00")
    .split(":")
    .map((v) => parseInt(v, 10) || 0);
  const cutoffMinutes = cutoffH * 60 + cutoffM;
  const currentMinutes = zoned.getHours() * 60 + zoned.getMinutes();

  if (currentMinutes < cutoffMinutes) {
    return format(subDays(zoned, 1), "yyyy-MM-dd");
  }
  return format(zoned, "yyyy-MM-dd");
}

/**
 * Returns today's operational date key as "YYYY-MM-DD" in the given IANA timezone and cutoff.
 * Falls back to browser timezone and "00:00" cutoff when not provided.
 */
export function todayKey(timezone?: string, cutoffTime?: string): string {
  return operationalDate(new Date(), timezone, cutoffTime);
}

/**
 * Returns the date key "YYYY-MM-DD" for an arbitrary JS Date in the given timezone.
 */
export function toDateKey(date: Date, timezone?: string): string {
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return format(toZonedTime(date, tz), "yyyy-MM-dd");
}

/**
 * Parses a "YYYY-MM-DD" date key and returns the start-of-day UTC Date
 * for that calendar day in the given timezone.
 */
export function fromDateKey(dateKey: string, timezone?: string): Date {
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const local = parseISO(dateKey); // parsed as midnight UTC
  return fromZonedTime(local, tz); // convert to actual UTC for the timezone
}

/**
 * Returns a human-readable label for a date key relative to the operational today.
 * Examples: "Today", "Yesterday", "Mon, Sep 29"
 */
export function dateLabel(dateKey: string, timezone?: string, cutoffTime?: string): string {
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = operationalDate(new Date(), tz, cutoffTime);
  if (dateKey === today) return "Today";
  const yesterday = format(subDays(parseISO(today), 1), "yyyy-MM-dd");
  if (dateKey === yesterday) return "Yesterday";
  return format(parseISO(dateKey), "EEE, MMM d");
}

/**
 * Returns the number of calendar days between two date keys (a - b).
 * Positive = a is after b.
 */
export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(a), parseISO(b));
}

/** Validates that a string is a well-formed YYYY-MM-DD date key. */
export function isValidDateKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return isValid(parseISO(s));
}

/** Returns an array of date keys from `start` to `end` inclusive, ascending. */
export function dateRange(start: string, end: string): string[] {
  const keys: string[] = [];
  let cur = parseISO(start);
  const last = parseISO(end);
  while (cur <= last) {
    keys.push(format(cur, "yyyy-MM-dd"));
    cur = new Date(cur.getTime() + 86_400_000);
  }
  return keys;
}

/** ISO 8601 UTC timestamp string — used for createdAt / updatedAt fields. */
export function nowISO(): string {
  return new Date().toISOString();
}

function parseMidday(date: Date | string, timezone?: string): Date {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-").map((v) => parseInt(v, 10));
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const d = date instanceof Date ? date : new Date(date);
  const zoned = toZonedTime(d, tz);
  return new Date(zoned.getFullYear(), zoned.getMonth(), zoned.getDate(), 12, 0, 0);
}

/**
 * Resolves start date, end date, and metadata for a week containing the given date.
 * weekStartsOn: 0 for Sunday, 1 for Monday (default 1).
 */
export function getWeekBounds(
  date: Date | string = new Date(),
  weekStartsOn: 0 | 1 = 1,
  timezone?: string,
): {
  startDate: string;
  endDate: string;
  weekKey: string;
  weekNumber: number;
  year: number;
} {
  const parsed = parseMidday(date, timezone);
  const start = startOfWeek(parsed, { weekStartsOn });
  const end = endOfWeek(parsed, { weekStartsOn });

  const startDate = format(start, "yyyy-MM-dd");
  const endDate = format(end, "yyyy-MM-dd");

  return {
    startDate,
    endDate,
    weekKey: startDate,
    weekNumber: getISOWeek(start),
    year: getYear(start),
  };
}

/**
 * Returns a human-friendly label for a week range, e.g. "Oct 5 – Oct 11, 2026"
 */
export function formatWeekRange(startDate: string, endDate: string): string {
  const start = parseMidday(startDate);
  const end = parseMidday(endDate);
  const startYear = getYear(start);
  const endYear = getYear(end);

  if (startYear === endYear) {
    return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  }
  return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
}

/**
 * Returns the start date of the previous week (7 days prior).
 */
export function getPrevWeekStartDate(startDate: string): string {
  return format(subWeeks(parseMidday(startDate), 1), "yyyy-MM-dd");
}

/**
 * Returns the start date of the next week (7 days after).
 */
export function getNextWeekStartDate(startDate: string): string {
  return format(addWeeks(parseMidday(startDate), 1), "yyyy-MM-dd");
}

/**
 * Returns array of 7 date keys ("YYYY-MM-DD") representing each day in the week.
 */
export function getWeekDays(startDate: string): string[] {
  return dateRange(startDate, format(addDays(parseMidday(startDate), 6), "yyyy-MM-dd"));
}

/**
 * Checks whether a given week startDate corresponds to the current operational week.
 */
export function isCurrentWeek(
  startDate: string,
  timezone?: string,
  cutoffTime?: string,
  weekStartsOn: 0 | 1 = 1,
): boolean {
  const today = operationalDate(new Date(), timezone, cutoffTime);
  const currentBounds = getWeekBounds(today, weekStartsOn, timezone);
  return startDate === currentBounds.startDate;
}

