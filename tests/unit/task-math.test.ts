/**
 * tests/unit/task-math.test.ts
 * Unit tests for task completion % and target progress %.
 * These are pure functions — no DB needed.
 */

import { describe, it, expect } from "vitest";
import { taskCompletionPercent, targetProgressPercent } from "@/lib/repositories";
import type { TaskInstance } from "@/lib/db";

function makeTask(overrides: Partial<TaskInstance>): TaskInstance {
  return {
    id: "test-id",
    dailyLogId: "log-id",
    templateId: null,
    title: "Test task",
    targetValue: null,
    completedValue: 0,
    unit: null,
    status: "todo",
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    completedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

describe("taskCompletionPercent", () => {
  it("returns 0 when there are no tasks", () => {
    expect(taskCompletionPercent([])).toBe(0);
  });

  it("returns 50% when 3 of 6 tasks are done", () => {
    const tasks = [
      makeTask({ id: "1", status: "done" }),
      makeTask({ id: "2", status: "done" }),
      makeTask({ id: "3", status: "done" }),
      makeTask({ id: "4", status: "todo" }),
      makeTask({ id: "5", status: "todo" }),
      makeTask({ id: "6", status: "todo" }),
    ];
    expect(taskCompletionPercent(tasks)).toBe(50);
  });

  it("returns 100% when all tasks are done", () => {
    const tasks = [
      makeTask({ id: "1", status: "done" }),
      makeTask({ id: "2", status: "done" }),
    ];
    expect(taskCompletionPercent(tasks)).toBe(100);
  });

  it("excludes skipped tasks from the denominator", () => {
    // 2 done, 1 todo, 1 skipped → 2/3 = 67%
    const tasks = [
      makeTask({ id: "1", status: "done" }),
      makeTask({ id: "2", status: "done" }),
      makeTask({ id: "3", status: "todo" }),
      makeTask({ id: "4", status: "skipped" }),
    ];
    expect(taskCompletionPercent(tasks)).toBe(67);
  });

  it("returns 0 when all tasks are skipped", () => {
    const tasks = [makeTask({ id: "1", status: "skipped" })];
    expect(taskCompletionPercent(tasks)).toBe(0);
  });

  it("returns 0 when no tasks are done", () => {
    const tasks = [makeTask({ id: "1", status: "todo" }), makeTask({ id: "2", status: "todo" })];
    expect(taskCompletionPercent(tasks)).toBe(0);
  });
});

describe("targetProgressPercent", () => {
  it("returns 0 when there are no quantitative tasks", () => {
    const tasks = [makeTask({ id: "1", status: "todo", targetValue: null })];
    expect(targetProgressPercent(tasks)).toBe(0);
  });

  it("returns 30% when 3 of 10 problems are solved", () => {
    const tasks = [
      makeTask({ id: "1", targetValue: 10, completedValue: 3, unit: "problems", status: "todo" }),
    ];
    expect(targetProgressPercent(tasks)).toBe(30);
  });

  it("returns 100% when target is met", () => {
    const tasks = [
      makeTask({ id: "1", targetValue: 5, completedValue: 5, unit: "problems", status: "done" }),
    ];
    expect(targetProgressPercent(tasks)).toBe(100);
  });

  it("sums across multiple quantitative tasks", () => {
    // 3/10 + 5/10 = 8/20 = 40%
    const tasks = [
      makeTask({ id: "1", targetValue: 10, completedValue: 3, status: "todo" }),
      makeTask({ id: "2", targetValue: 10, completedValue: 5, status: "todo" }),
    ];
    expect(targetProgressPercent(tasks)).toBe(40);
  });

  it("does not treat incomplete quantitative task as failed (status remains todo)", () => {
    const task = makeTask({ id: "1", targetValue: 10, completedValue: 3, status: "todo" });
    // Status is todo — this is NOT a failure, just in-progress
    expect(task.status).toBe("todo");
    expect(targetProgressPercent([task])).toBe(30);
  });

  it("excludes skipped quantitative tasks", () => {
    const tasks = [
      makeTask({ id: "1", targetValue: 10, completedValue: 3, status: "todo" }),
      makeTask({ id: "2", targetValue: 10, completedValue: 0, status: "skipped" }),
    ];
    expect(targetProgressPercent(tasks)).toBe(30);
  });
});
