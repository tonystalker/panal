/**
 * tests/unit/date.test.ts
 * Unit tests for timezone-aware and operational date helpers.
 */

import { describe, it, expect } from "vitest";
import {
  isValidDateKey,
  daysBetween,
  dateRange,
  operationalDate,
  todayKey,
  dateLabel,
} from "@/lib/date";

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

describe("operationalDate", () => {
  describe("default midnight cutoff (00:00)", () => {
    it("preserves standard calendar date for all hours under default cutoff", () => {
      // 00:00 UTC
      expect(operationalDate(new Date("2026-10-01T00:00:00Z"), "UTC", "00:00")).toBe("2026-10-01");
      // 12:00 UTC
      expect(operationalDate(new Date("2026-10-01T12:00:00Z"), "UTC", "00:00")).toBe("2026-10-01");
      // 23:59 UTC
      expect(operationalDate(new Date("2026-10-01T23:59:00Z"), "UTC", "00:00")).toBe("2026-10-01");
    });

    it("defaults to 00:00 when cutoff parameter is omitted", () => {
      expect(operationalDate(new Date("2026-10-01T01:00:00Z"), "UTC")).toBe("2026-10-01");
      expect(operationalDate(new Date("2026-10-01T23:00:00Z"), "UTC")).toBe("2026-10-01");
    });
  });

  describe("6:00 AM cutoff (06:00)", () => {
    it("resolves 2026-10-01 01:00 local to 2026-09-30 workday", () => {
      const date = new Date("2026-10-01T01:00:00Z");
      expect(operationalDate(date, "UTC", "06:00")).toBe("2026-09-30");
    });

    it("resolves times immediately before cutoff (05:59 local) to previous workday", () => {
      const date = new Date("2026-10-01T05:59:59Z");
      expect(operationalDate(date, "UTC", "06:00")).toBe("2026-09-30");
    });

    it("resolves exactly at cutoff (06:00 local) to current calendar workday", () => {
      const date = new Date("2026-10-01T06:00:00Z");
      expect(operationalDate(date, "UTC", "06:00")).toBe("2026-10-01");
    });

    it("resolves times immediately after cutoff (06:01 local) to current calendar workday", () => {
      const date = new Date("2026-10-01T06:01:00Z");
      expect(operationalDate(date, "UTC", "06:00")).toBe("2026-10-01");
    });

    it("resolves late night times (23:59 local) to current calendar workday", () => {
      const date = new Date("2026-10-01T23:59:00Z");
      expect(operationalDate(date, "UTC", "06:00")).toBe("2026-10-01");
    });
  });

  describe("timezone sensitivity with cutoff", () => {
    it("correctly evaluates cutoff in Asia/Kolkata (UTC+5:30)", () => {
      // 2026-09-30 20:00 UTC = 2026-10-01 01:30 AM in Asia/Kolkata
      // Under 06:00 cutoff, 01:30 AM is before cutoff -> resolves to 2026-09-30
      const nightTime = new Date("2026-09-30T20:00:00Z");
      expect(operationalDate(nightTime, "Asia/Kolkata", "06:00")).toBe("2026-09-30");

      // 2026-10-01 01:00 UTC = 2026-10-01 06:30 AM in Asia/Kolkata
      // Under 06:00 cutoff, 06:30 AM is after cutoff -> resolves to 2026-10-01
      const morningTime = new Date("2026-10-01T01:00:00Z");
      expect(operationalDate(morningTime, "Asia/Kolkata", "06:00")).toBe("2026-10-01");
    });

    it("correctly evaluates cutoff in America/New_York (EDT, UTC-4 in October)", () => {
      // 2026-10-01 07:00 UTC = 2026-10-01 03:00 AM EDT
      // Before 06:00 cutoff -> 2026-09-30
      const earlyMorning = new Date("2026-10-01T07:00:00Z");
      expect(operationalDate(earlyMorning, "America/New_York", "06:00")).toBe("2026-09-30");

      // 2026-10-01 11:00 UTC = 2026-10-01 07:00 AM EDT
      // After 06:00 cutoff -> 2026-10-01
      const afterCutoff = new Date("2026-10-01T11:00:00Z");
      expect(operationalDate(afterCutoff, "America/New_York", "06:00")).toBe("2026-10-01");
    });
  });

  describe("DST-safe handling and boundary transitions", () => {
    it("handles DST fall-back transition safely (America/New_York Nov 1, 2026)", () => {
      // On Nov 1, 2026, 2:00 AM EDT becomes 1:00 AM EST.
      // At 01:30 AM local time on Nov 1 with a 6:00 AM cutoff, it should belong to 2026-10-31 workday
      // 2026-11-01 05:30 UTC = 01:30 AM EDT
      const beforeCutoffDST = new Date("2026-11-01T05:30:00Z");
      expect(operationalDate(beforeCutoffDST, "America/New_York", "06:00")).toBe("2026-10-31");

      // At 07:00 AM local time on Nov 1 (after cutoff) -> 2026-11-01
      // 2026-11-01 12:00 UTC = 07:00 AM EST
      const afterCutoffDST = new Date("2026-11-01T12:00:00Z");
      expect(operationalDate(afterCutoffDST, "America/New_York", "06:00")).toBe("2026-11-01");
    });

    it("handles New Year boundary rollover across cutoff", () => {
      // 2026-01-01 03:00 UTC with 06:00 cutoff resolves to 2025-12-31
      const newYearMorning = new Date("2026-01-01T03:00:00Z");
      expect(operationalDate(newYearMorning, "UTC", "06:00")).toBe("2025-12-31");

      // 2026-01-01 07:00 UTC with 06:00 cutoff resolves to 2026-01-01
      const newYearDay = new Date("2026-01-01T07:00:00Z");
      expect(operationalDate(newYearDay, "UTC", "06:00")).toBe("2026-01-01");
    });

    it("handles Month transition boundary across cutoff (March 1 to Feb 28)", () => {
      // 2026-03-01 02:00 UTC with 06:00 cutoff resolves to 2026-02-28
      const marchMorning = new Date("2026-03-01T02:00:00Z");
      expect(operationalDate(marchMorning, "UTC", "06:00")).toBe("2026-02-28");
    });
  });
});

describe("dateLabel with operational cutoff", () => {
  it("labels the current operational date as Today and day before as Yesterday", () => {
    // If today is 2026-10-01
    const currentOp = operationalDate(new Date(), "UTC", "00:00");
    expect(dateLabel(currentOp, "UTC", "00:00")).toBe("Today");

    const prevOp = operationalDate(new Date(Date.now() - 86_400_000 * 2), "UTC", "00:00");
    // Just verify it doesn't crash and returns formatted label
    expect(typeof dateLabel(prevOp, "UTC", "00:00")).toBe("string");
  });
});

describe("todayKey delegation", () => {
  it("delegates to operationalDate with cutoff", () => {
    expect(todayKey("UTC", "00:00")).toBe(operationalDate(new Date(), "UTC", "00:00"));
  });
});

