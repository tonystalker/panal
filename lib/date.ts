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

import { format, parseISO, differenceInCalendarDays, isValid } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

/**
 * Returns today's date key as "YYYY-MM-DD" in the given IANA timezone.
 * Falls back to the browser's local timezone when no tz is provided.
 */
export function todayKey(timezone?: string): string {
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return format(toZonedTime(new Date(), tz), "yyyy-MM-dd");
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
 * Returns a human-readable label for a date key.
 * Examples: "Today", "Yesterday", "Mon, Sep 29"
 */
export function dateLabel(dateKey: string, timezone?: string): string {
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = todayKey(tz);
  if (dateKey === today) return "Today";
  const yesterday = toDateKey(
    new Date(Date.now() - 86_400_000),
    tz,
  );
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
