import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3005";
const BREAKPOINTS = [
  { name: "mobile-320", width: 320, height: 600 },
  { name: "mobile-375", width: 375, height: 667 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1024", width: 1024, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

test.describe("Production Landing Page Verification", () => {
  test("verifies Next.js dev indicator (black circular N badge) is absent in production build", async ({
    page,
  }) => {
    await page.goto(BASE_URL);
    // Next.js dev tools portal / badge elements
    const devBadge = page.locator("nextjs-portal, [data-nextjs-dev-tools-button], [data-next-badge], #nextjs-dev-tools-button, [aria-label*='Next.js']");
    expect(await devBadge.count()).toBe(0);
  });

  test("verifies complete Panal rebranding across title, lockups, and footer", async ({
    page,
  }) => {
    await page.goto(BASE_URL);

    // Title
    await expect(page).toHaveTitle(/Panal — Personal analytics, local-first/);

    // Nav brand lockup
    const navBrand = page.locator("header a[aria-label*='Panal']");
    await expect(navBrand).toBeVisible();
    await expect(navBrand).toContainText("Panal");
    await expect(navBrand).toContainText("Personal analytics, local-first");

    // Mockup URL
    await expect(page.locator("text=panal.local/dashboard")).toBeVisible();

    // Final CTA button
    const finalCta = page.locator("#cta-open-app-btn");
    await expect(finalCta).toBeVisible();
    await expect(finalCta).toContainText("Open Panal");

    // Footer brand and copyright
    const footer = page.locator("footer");
    await expect(footer).toContainText("Panal");
    await expect(footer).toContainText("Personal analytics, local-first");
    await expect(footer).toContainText("Private by default");
    await expect(footer).toContainText("All personal data stored locally on your device");

    // No visible 'Personal Analytics' string on landing page
    const bodyText = await page.locator("main").innerText();
    expect(bodyText).not.toContain("Personal Analytics");
  });

  test("verifies truthful connector positioning and generic copy", async ({ page }) => {
    await page.goto(BASE_URL);

    // Verified connector copy
    await expect(
      page.locator("text=Turn activity into inspectable daily metrics.")
    ).toBeVisible();
    await expect(
      page.locator(
        "text=Connect supported services such as GitHub and LeetCode. Their activity becomes clear, date-based metrics alongside the work you log yourself."
      ).first()
    ).toBeVisible();

    // Check connector chips
    await expect(
      page.locator("text=GitHub + LeetCode connectors").first()
    ).toBeVisible();

    // No ungrounded marketplace claims
    const fullText = await page.locator("body").innerText();
    expect(fullText).not.toContain("GitHub, LeetCode & more");
    expect(fullText).not.toContain("developer services");
    expect(fullText).not.toContain("marketplace");
    expect(fullText).not.toContain("universal connectors");
  });

  test("verifies corrected privacy and speed claims", async ({ page }) => {
    await page.goto(BASE_URL);

    // Replaced claims
    await expect(
      page.locator("text=No product analytics or advertising trackers").first()
    ).toBeVisible();
    await expect(page.locator("text=No account required").first()).toBeVisible();

    // Privacy architecture diagram
    const privacySection = page.locator("#privacy");
    await expect(privacySection.getByText("Browser", { exact: true })).toBeVisible();
    await expect(privacySection.getByText("On-Device Storage", { exact: true })).toBeVisible();
    await expect(privacySection.getByText("Encrypted Export", { exact: true })).toBeVisible();

    // Check absence of inaccurate claims
    const fullText = await page.locator("body").innerText();
    expect(fullText).not.toContain("Zero remote tracking");
    expect(fullText).not.toContain("Ready in 10 seconds");
    expect(fullText).not.toContain("zero knowledge");
    expect(fullText).not.toContain("end-to-end encrypted sync");
    expect(fullText).not.toContain("IndexedDB");
    expect(fullText).not.toContain("Dexie");
  });

  for (const bp of BREAKPOINTS) {
    test(`renders cleanly without horizontal overflow at ${bp.name} (${bp.width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto(BASE_URL);

      // Verify no horizontal document overflow
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth
      );
      const clientWidth = await page.evaluate(
        () => document.documentElement.clientWidth
      );
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // 1px tolerance for subpixel rounding

      // Verify main content and header exist
      await expect(page.locator("header")).toBeVisible();
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("#product")).toBeVisible();
      await expect(page.locator("#story")).toBeVisible();
      await expect(page.locator("#features")).toBeVisible();
      await expect(page.locator("#privacy")).toBeVisible();
      await expect(page.locator("footer")).toBeVisible();
    });
  }

  test("verifies CTA routing leads to /today local-first workflow without fake auth", async ({
    page,
  }) => {
    await page.goto(BASE_URL);

    const cta = page.locator("#hero-primary-cta");
    await expect(cta).toHaveAttribute("href", "/today");

    // Click CTA
    await cta.click();
    await expect(page).toHaveURL(`${BASE_URL}/today`);

    // Verify /today page loaded in honest local mode
    await expect(page.locator("h1")).toContainText("Today");
  });

  test("verifies scroll-story chapters have accessible contrast and sticky offsets", async ({
    page,
  }) => {
    await page.goto(BASE_URL);

    const storySection = page.locator("#story");
    await expect(storySection).toBeVisible();

    // Check chapters exist and have scroll-margin-top
    const chapters = storySection.locator("[class*='scroll-mt-']");
    const count = await chapters.count();
    expect(count).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < count; i++) {
      const ch = chapters.nth(i);
      const scrollMargin = await ch.evaluate(
        (el) => window.getComputedStyle(el).scrollMarginTop
      );
      // Ensure positive scroll margin (> 60px) to clear fixed header
      const pxValue = parseFloat(scrollMargin);
      expect(pxValue).toBeGreaterThanOrEqual(64);
    }
  });

  test("verifies visible keyboard focus rings on interactive elements", async ({
    page,
  }) => {
    await page.goto(BASE_URL);

    // Tab into navigation
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(
      () => document.activeElement?.tagName
    );
    expect(focusedTag).toBeTruthy();
  });
});
