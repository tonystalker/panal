import { test, expect } from "@playwright/test";

test.describe("Today page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/today");
  });

  test("renders today page with task section and manual metrics", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Today");
    await expect(page.locator("h2").first()).toContainText("Tasks");
  });

  test("can add a task and mark it done", async ({ page }) => {
    await page.locator("#add-task-btn").click();
    await page.locator("#new-task-title").fill("Test E2E Task");
    await page.locator("#new-task-title").press("Enter");
    await page.locator("text=Test E2E Task").waitFor();

    // Mark complete
    const toggleBtn = page.locator('[id^="task-toggle-"]').first();
    await toggleBtn.click();
    await expect(page.locator('[id^="task-toggle-"]').first()).toHaveClass(/checked/);
  });

  test("progress bar reflects task completion", async ({ page }) => {
    // Add two tasks
    for (const title of ["Task A", "Task B"]) {
      await page.locator("#add-task-btn").click();
      await page.locator("#new-task-title").fill(title);
      await page.locator("#new-task-title").press("Enter");
      await page.locator(`text=${title}`).waitFor();
    }
    // Complete first
    await page.locator('[id^="task-toggle-"]').first().click();
    // Progress should show 50%
    await expect(page.locator("text=50%")).toBeVisible();
  });

  test("reload retains task data (IndexedDB persistence)", async ({ page }) => {
    await page.locator("#add-task-btn").click();
    await page.locator("#new-task-title").fill("Persistent Task");
    await page.locator("#new-task-title").press("Enter");
    await page.locator("text=Persistent Task").waitFor();

    // Reload
    await page.reload();
    await expect(page.locator("text=Persistent Task")).toBeVisible();
  });
});

test.describe("Dashboard page", () => {
  test("renders dashboard with add and reset widget buttons", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("Dashboard");
    await expect(page.locator("#add-widget-btn")).toBeVisible();
    await expect(page.locator("#reset-widgets-btn")).toBeVisible();
  });
});

test.describe("Settings page", () => {
  test("renders settings with backup section", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("h1")).toContainText("Settings");
    await expect(page.locator("#export-backup-btn")).toBeVisible();
    await expect(page.locator("#import-backup-btn")).toBeVisible();
  });

  test("shows error when exporting without passphrase", async ({ page }) => {
    await page.goto("/settings");
    await page.locator("#export-backup-btn").click();
    await expect(page.locator("text=Enter a passphrase")).toBeVisible();
  });
});
