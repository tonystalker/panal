/**
 * tests/unit/date.test.ts
 * Unit tests for timezone-aware date helpers.
 */

import { describe, it, expect } from "vitest";
import { isValidDateKey, daysBetween, dateRange } from "@/lib/date";

describe("isValidDateKey", () => {
  it("accepts valid YYYY-MM-DD strings", () => {
    expect(isValidDateKey("2026-09-29")).toBe(true);
    expect(isValidDateKey("2000-01-01")).toBe(true);
  });

  it("rejects malformed strings", () => {
    expect(isValidDateKey("2026/09/29")).toBe(false);
    expect(isValidDateKey("29-09-2026")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("not-a-date")).toBe(false);
    expect(isValidDateKey("")).toBe(false);
  });
});

describe("daysBetween", () => {
  it("returns 0 for the same date", () => {
    expect(daysBetween("2026-09-29", "2026-09-29")).toBe(0);
  });

  it("returns positive for a later date", () => {
    expect(daysBetween("2026-10-06", "2026-09-29")).toBe(7);
  });

  it("returns negative for an earlier date", () => {
    expect(daysBetween("2026-09-22", "2026-09-29")).toBe(-7);
  });
});

describe("dateRange", () => {
  it("returns inclusive range of date keys", () => {
    const range = dateRange("2026-09-27", "2026-09-29");
    expect(range).toEqual(["2026-09-27", "2026-09-28", "2026-09-29"]);
  });

  it("returns a single element for same start and end", () => {
    expect(dateRange("2026-09-29", "2026-09-29")).toEqual(["2026-09-29"]);
  });

  it("returns 7 elements for a 7-day range", () => {
    const range = dateRange("2026-09-23", "2026-09-29");
    expect(range).toHaveLength(7);
    expect(range[0]).toBe("2026-09-23");
    expect(range[6]).toBe("2026-09-29");
  });
});
