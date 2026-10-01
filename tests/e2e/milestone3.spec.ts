/**
 * tests/e2e/milestone3.spec.ts
 *
 * E2E tests for Milestone 3:
 *  - Change a widget chart type
 *  - Add and configure a widget
 *  - Connect mocked LeetCode connector
 *  - Dashboard shows widget config UI
 */

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Dashboard — widget configuration
// ---------------------------------------------------------------------------

test.describe("Dashboard — widget configuration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    // Wait for page to initialize widgets
    await page.waitForTimeout(1000);
  });

  test("renders dashboard with Add Widget and Reset buttons", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Dashboard");
    await expect(page.locator("#add-widget-btn")).toBeVisible();
    await expect(page.locator("#reset-widgets-btn")).toBeVisible();
  });

  test("reset to defaults seeds default widgets", async ({ page }) => {
    await page.locator("#reset-widgets-btn").click();
    // Wait for widgets to render
    await page.waitForTimeout(1000);
    // At least one configure button should now be visible
    const configBtns = page.locator('[id^="widget-config-"]');
    await expect(configBtns.first()).toBeVisible({ timeout: 5000 });
  });

  test("clicking configure opens widget config dialog", async ({ page }) => {
    // Ensure there are widgets
    await page.locator("#reset-widgets-btn").click();
    await page.waitForTimeout(1000);

    const configBtn = page.locator('[id^="widget-config-"]').first();
    await configBtn.click();

    // Dialog should be visible
    await expect(page.locator("#widget-config-title")).toBeVisible();
    await expect(page.locator("#widget-metric-select")).toBeVisible();
    await expect(page.locator("#widget-save-btn")).toBeVisible();
  });

  test("can change chart type to line in widget config", async ({ page }) => {
    await page.locator("#reset-widgets-btn").click();
    await page.waitForTimeout(1000);

    const configBtn = page.locator('[id^="widget-config-"]').first();
    await configBtn.click();

    // Click the 'Line' chart type button
    await page.locator("#chart-type-line").click();
    await expect(page.locator("#chart-type-line")).toHaveClass(/btn-primary/);

    // Save
    await page.locator("#widget-save-btn").click();

    // Dialog should close
    await expect(page.locator("#widget-config-title")).not.toBeVisible();
  });

  test("can change chart type to bar in widget config", async ({ page }) => {
    await page.locator("#reset-widgets-btn").click();
    await page.waitForTimeout(1000);

    const configBtn = page.locator('[id^="widget-config-"]').first();
    await configBtn.click();
    await page.locator("#chart-type-bar").click();
    await page.locator("#widget-save-btn").click();

    await expect(page.locator("#widget-config-title")).not.toBeVisible();
  });

  test("can set a goal line in widget config", async ({ page }) => {
    await page.locator("#reset-widgets-btn").click();
    await page.waitForTimeout(1000);

    const configBtn = page.locator('[id^="widget-config-"]').first();
    await configBtn.click();

    await page.locator("#widget-goal-line").fill("50");
    await page.locator("#widget-save-btn").click();
    await expect(page.locator("#widget-config-title")).not.toBeVisible();
  });

  test("can add a new widget", async ({ page }) => {
    await page.locator("#add-widget-btn").click();

    // Dialog should open for the new widget
    await expect(page.locator("#widget-config-title")).toBeVisible();

    // Select a metric
    await page.locator("#widget-metric-select").selectOption({ index: 1 });

    // Save
    await page.locator("#widget-save-btn").click();
    await expect(page.locator("#widget-config-title")).not.toBeVisible();
  });

  test("widget config dialog closes on cancel", async ({ page }) => {
    await page.locator("#add-widget-btn").click();
    await expect(page.locator("#widget-config-title")).toBeVisible();

    await page.locator("text=Cancel").click();
    await expect(page.locator("#widget-config-title")).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Connectors — LeetCode panel
// ---------------------------------------------------------------------------

test.describe("Connectors — LeetCode panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/connectors");
  });

  test("LeetCode panel is visible", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Connectors");
    await expect(page.getByRole("heading", { name: "LeetCode" })).toBeVisible();
  });

  test("LeetCode connect button is disabled without username", async ({ page }) => {
    const connectBtn = page.locator("#connector-connect-leetcode");
    await expect(connectBtn).toBeDisabled();
  });

  test("LeetCode connect button enables after entering username", async ({ page }) => {
    await page.locator("#lc-username").fill("testuser");
    const connectBtn = page.locator("#connector-connect-leetcode");
    await expect(connectBtn).not.toBeDisabled();
  });

  test("connect mocked LeetCode and see success message", async ({ page }) => {
    await page.locator("#lc-username").fill("mockuser");

    // In dev mode, the adapter uses mock data automatically
    await page.locator("#connector-connect-leetcode").click();

    // Should show success message (mocked sync is fast)
    await expect(page.locator("text=Connected as @mockuser")).toBeVisible({ timeout: 10000 });

    // Sync and disconnect buttons should appear
    await expect(page.locator("#connector-sync-leetcode")).toBeVisible();
    await expect(page.locator("#connector-disconnect-leetcode")).toBeVisible();
  });

  test("disconnect LeetCode shows confirm dialog", async ({ page }) => {
    // First connect
    await page.locator("#lc-username").fill("mockuser");
    await page.locator("#connector-connect-leetcode").click();
    await expect(page.locator("#connector-disconnect-leetcode")).toBeVisible({ timeout: 10000 });

    // Then disconnect
    await page.locator("#connector-disconnect-leetcode").click();
    await expect(page.locator("#lc-confirm-disconnect-btn")).toBeVisible();
    await expect(page.locator("text=Disconnect LeetCode?")).toBeVisible();
  });

  test("can confirm LeetCode disconnect", async ({ page }) => {
    await page.locator("#lc-username").fill("mockuser");
    await page.locator("#connector-connect-leetcode").click();
    await expect(page.locator("#connector-disconnect-leetcode")).toBeVisible({ timeout: 10000 });

    await page.locator("#connector-disconnect-leetcode").click();
    await page.locator("#lc-confirm-disconnect-btn").click();

    // Should show disconnected message
    await expect(page.locator("text=LeetCode disconnected")).toBeVisible({ timeout: 5000 });

    // Connect button should reappear
    await expect(page.locator("#connector-connect-leetcode")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Connectors — GitHub panel (existing, updated for new UI)
// ---------------------------------------------------------------------------

test.describe("Connectors — GitHub panel", () => {
  test("GitHub panel is visible with connect button", async ({ page }) => {
    await page.goto("/connectors");
    await expect(page.getByRole("heading", { name: "GitHub" })).toBeVisible();
    await expect(page.locator("#connector-connect-github")).toBeVisible();
  });
});
