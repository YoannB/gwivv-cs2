import { expect, test } from "@playwright/test";
import { LS_SAGE_RANGE } from "../../lib/storage";
import { DEFAULT_LOCALE, lp } from "./support/locale-path";
import { localized } from "./support/pathnames";

// SAGE RANGE smoke test: start → play → pause → results, language-agnostic (classes and data
// attributes, never copy). The game's test hook (window.__SAGE_RANGE_TEST__) fixes the seed,
// shortens the session to two seconds and skips the countdown; such runs never offer the leaderboard.

const RANGE = localized(DEFAULT_LOCALE, "/range");

test.describe("Sage Range", () => {
    test("desktop: start, shoot, pause, resume, then see the results", async ({ page, isMobile }) => {
        test.skip(isMobile, "touch devices get the explanatory screen");
        await page.addInitScript(() => {
            (window as { __SAGE_RANGE_TEST__?: object }).__SAGE_RANGE_TEST__ = {
                seed: 7,
                durationTicks: 120,
                countdownMs: 0,
            };
        });
        await page.goto(RANGE);
        const game = page.locator(".sr");
        await expect(game).toHaveAttribute("data-phase", "menu");

        await page.locator(".sr-difficulty__option").first().click();
        await page.locator(".sr-start__go").click();
        await expect(game).toHaveAttribute("data-phase", "play");
        // During a session the stage covers the site chrome.
        await expect(page.locator(".sr-stage")).toBeVisible();

        const canvas = page.locator(".sr-canvas");
        await canvas.click({ position: { x: 20, y: 300 } });
        await page.keyboard.press("Escape");
        await expect(page.locator(".sr-pause")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.locator(".sr-pause")).toHaveCount(0);

        await expect(game).toHaveAttribute("data-phase", "results", { timeout: 15_000 });
        await expect(page.getByTestId("sr-final-score")).toHaveText(/\d/);
        await expect(page.locator(".sr-submit")).toHaveCount(0);
        const back = page.locator(".sr-actions a");
        await expect(back).toHaveAttribute("href", lp(DEFAULT_LOCALE, "/"));

        // The personal best is kept in the browser, under the site's declared key.
        const stored = await page.evaluate((key) => localStorage.getItem(key), LS_SAGE_RANGE);
        expect(stored === null || stored.includes('"best"')).toBe(true);

        // The results live in the address: it is the share link, and Back returns to it.
        await expect(page).toHaveURL(/#r=[A-Za-z0-9_-]+$/);
        const shareUrl = page.url();
        const score = await page.getByTestId("sr-final-score").textContent();

        await page.locator(".sr-actions .sr-btn--primary").click();
        await expect(game).toHaveAttribute("data-phase", "play");
        await page.goBack();
        await expect(game).toHaveAttribute("data-phase", "results");
        await expect(page.getByTestId("sr-final-score")).toHaveText(score as string);

        // Someone else opening the link sees the session, replayed, read-only. (A share code holds
        // no session length: this hooked two-second run replays over a full minute, so its score is
        // not compared here; games/sage-range/core/share.test.ts proves the round trip.)
        const other = await page.context().browser()!.newPage();
        await other.goto(shareUrl);
        await expect(other.locator(".sr")).toHaveAttribute("data-phase", "shared");
        await expect(other.locator(".sr-desktop").getByTestId("sr-final-score")).toHaveText(/\d/);
        await other.close();
    });

    test("touch: an explanatory screen instead of a shrunk game", async ({ page, isMobile }) => {
        test.skip(!isMobile, "desktop flow covered above");
        await page.goto(RANGE);
        await expect(page.locator(".sr-mobile")).toBeVisible();
        await expect(page.locator(".sr-start__go")).toBeHidden();
    });

    test("leaderboard API answers and refuses a forged session", async ({ request }) => {
        const boards = await request.get("/api/range/scores");
        expect([200, 503]).toContain(boards.status());
        const forged = await request.post("/api/range/scores", {
            data: {
                version: 3,
                difficulty: "elite",
                seed: 1,
                identity: "https://steamcommunity.com/id/ace",
                shots: [
                    [0, 1, 1],
                    [1, 1, 1],
                ],
            },
        });
        expect(forged.status()).toBe(400);
    });
});
