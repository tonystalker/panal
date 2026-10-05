/**
 * tests/unit/weekly.test.ts
 * Unit tests for Weekly Planner repositories and data helpers.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  getOrCreateWeeklyLog,
  getTasksForWeeklyLog,
  createWeeklyTask,
  completeWeeklyTask,
  reopenWeeklyTask,
  skipWeeklyTask,
  carryForwardWeeklyTasks,
  taskCompletionPercent,
  targetProgressPercent,
} from "@/lib/repositories";
import {
  getWeekBounds,
  formatWeekRange,
  getPrevWeekStartDate,
  getNextWeekStartDate,
  getWeekDays,
  isCurrentWeek,
} from "@/lib/date";

describe("Weekly Planner Date Helpers", () => {
  it("computes week bounds for a given date (Monday start)", () => {
    // 2026-10-07 is Wednesday
    const bounds = getWeekBounds("2026-10-07", 1);
    expect(bounds.startDate).toBe("2026-10-05"); // Monday
    expect(bounds.endDate).toBe("2026-10-11"); // Sunday
    expect(bounds.weekKey).toBe("2026-10-05");
    expect(bounds.weekNumber).toBe(41);
  });

  it("computes week bounds with Sunday start when configured", () => {
    // 2026-10-07 is Wednesday
    const bounds = getWeekBounds("2026-10-07", 0);
    expect(bounds.startDate).toBe("2026-10-04"); // Sunday
    expect(bounds.endDate).toBe("2026-10-10"); // Saturday
  });

  it("formats week range nicely", () => {
    expect(formatWeekRange("2026-10-05", "2026-10-11")).toBe("Oct 5 – Oct 11, 2026");
    expect(formatWeekRange("2026-12-28", "2027-01-03")).toBe("Dec 28, 2026 – Jan 3, 2027");
  });

  it("calculates previous and next week start dates", () => {
    expect(getPrevWeekStartDate("2026-10-05")).toBe("2026-09-28");
    expect(getNextWeekStartDate("2026-10-05")).toBe("2026-10-12");
  });

  it("returns exactly 7 days for getWeekDays", () => {
    const days = getWeekDays("2026-10-05");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-10-05");
    expect(days[6]).toBe("2026-10-11");
  });
});

describe("Weekly Planner Repositories", () => {
  beforeEach(async () => {
    await db.weeklyLogs.clear();
    await db.weeklyTasks.clear();
  });

  it("creates and retrieves a weekly log", async () => {
    const log1 = await getOrCreateWeeklyLog("2026-10-05", "2026-10-11");
    expect(log1).toBeDefined();
    expect(log1.startDate).toBe("2026-10-05");
    expect(log1.endDate).toBe("2026-10-11");

    // Idempotent: returns existing
    const log2 = await getOrCreateWeeklyLog("2026-10-05", "2026-10-11");
    expect(log2.id).toBe(log1.id);
  });

  it("creates, completes, skips, and reopens weekly tasks", async () => {
    const log = await getOrCreateWeeklyLog("2026-10-05", "2026-10-11");

    const task1 = await createWeeklyTask(
      log.id,
      { title: "Ship product feature", targetValue: null, unit: null },
      0,
    );
    expect(task1.status).toBe("todo");

    const task2 = await createWeeklyTask(
      log.id,
      { title: "Write documentation", targetValue: 5, unit: "chapters" },
      1,
    );

    let tasks = await getTasksForWeeklyLog(log.id);
    expect(tasks).toHaveLength(2);
    expect(taskCompletionPercent(tasks)).toBe(0);

    // Complete task1
    await completeWeeklyTask(task1.id);
    tasks = await getTasksForWeeklyLog(log.id);
    expect(tasks.find((t) => t.id === task1.id)?.status).toBe("done");
    expect(taskCompletionPercent(tasks)).toBe(50);

    // Reopen task1
    await reopenWeeklyTask(task1.id);
    tasks = await getTasksForWeeklyLog(log.id);
    expect(tasks.find((t) => t.id === task1.id)?.status).toBe("todo");

    // Skip task2
    await skipWeeklyTask(task2.id);
    tasks = await getTasksForWeeklyLog(log.id);
    expect(tasks.find((t) => t.id === task2.id)?.status).toBe("skipped");
    // Skipped tasks excluded from denominator: 0 of 1 active done = 0%
    expect(taskCompletionPercent(tasks)).toBe(0);
  });

  it("carries forward unfinished tasks from previous week", async () => {
    const prevLog = await getOrCreateWeeklyLog("2026-09-28", "2026-10-04");
    const currentLog = await getOrCreateWeeklyLog("2026-10-05", "2026-10-11");

    // Add 2 tasks to prev week: 1 done, 1 todo
    const t1 = await createWeeklyTask(prevLog.id, { title: "Finished goal", targetValue: null, unit: null }, 0);
    await completeWeeklyTask(t1.id);

    await createWeeklyTask(prevLog.id, { title: "Unfinished project roadmap", targetValue: 10, unit: "pages" }, 1);

    // Carry forward
    const carried = await carryForwardWeeklyTasks(prevLog.id, currentLog.id);
    expect(carried).toHaveLength(1);
    expect(carried[0].title).toBe("Unfinished project roadmap");
    expect(carried[0].weeklyLogId).toBe(currentLog.id);
    expect(carried[0].status).toBe("todo");

    // Verify current week tasks
    const currentTasks = await getTasksForWeeklyLog(currentLog.id);
    expect(currentTasks).toHaveLength(1);
    expect(currentTasks[0].title).toBe("Unfinished project roadmap");
  });
});
