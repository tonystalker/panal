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

import { format, parseISO, differenceInCalendarDays, isValid, subDays } from "date-fns";
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
