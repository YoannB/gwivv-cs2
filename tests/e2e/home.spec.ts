import { expect, test } from "@playwright/test";
import {
    CLIPS,
    CLIPS_ON_HOME,
    HEADER_NAV,
    HEADER_SECTIONS,
    HIGHLIGHTS,
    LOADOUT,
    RANGE_ENABLED,
    SEASONS,
    SITE_NAME,
    SOCIAL_LINKS,
    STEAM64_ID,
} from "../../constants/site";
import { acceptCookiesButton, cookieBanner, languageButton, languageOption, themeToggle } from "./support/home";
import { lpRe } from "./support/locale-path";

test.describe("Home — structural smoke", () => {
    test("shows the player hero: brand title, illustration and the six platform links", async ({ page }) => {
        await page.goto("/");

        await expect(page.getByRole("heading", { level: 1, name: SITE_NAME })).toBeVisible();
        await expect(page.locator(".hero__character")).toBeVisible();
        const links = page.locator(".hero__social a");
        await expect(links).toHaveCount(SOCIAL_LINKS.length);
        for (const [i, link] of SOCIAL_LINKS.entries()) {
            await expect(links.nth(i)).toHaveAttribute("href", link.href);
            await expect(links.nth(i)).toHaveAttribute("rel", "noopener noreferrer");
        }
    });

    test("the statistics strip shows the dated FACEIT card and a settled Leetify state", async ({ page }) => {
        await page.goto("/");

        const strip = page.locator(".stats");
        await expect(strip.locator(".stats__card--faceit")).toBeVisible();
        await expect(strip.getByRole("link", { name: "Data Provided by Leetify" })).toHaveAttribute(
            "href",
            "https://leetify.com/",
        );
        // Without LEETIFY_API_KEY (CI) the route answers { status: "unavailable" }: the strip says so,
        // it shows no number.
        await expect(strip.locator(".stats__status")).not.toHaveClass(/stats__status--loading/);
    });

    test("the season history lists every season with a Premier range bar when rated", async ({ page }) => {
        await page.goto("/");

        const rows = page.locator(".seasons__table tbody tr");
        await expect(rows).toHaveCount(SEASONS.length);
        for (const [i, season] of SEASONS.entries()) {
            await expect(rows.nth(i).locator(".seasons__bar")).toHaveCount(season.premier ? 1 : 0);
        }
        await expect(page.getByRole("link", { name: "Rank history on Leetify" })).toHaveAttribute(
            "href",
            `https://leetify.com/app/profile/${STEAM64_ID}/ranks`,
        );
    });

    test("the latest clips load the provider player only after a click", async ({ page }) => {
        test.skip(CLIPS.length === 0, "no clip declared in constants/site.ts");
        await page.goto("/");

        const items = page.locator(".clips__item");
        await expect(items).toHaveCount(Math.min(CLIPS.length, CLIPS_ON_HOME));
        const first = items.first();
        await expect(first.locator("iframe")).toHaveCount(0);
        await first.locator("button.clip-player__poster").click();
        await expect(first.locator("iframe")).toHaveAttribute("src", CLIPS[0].embed);
    });

    test("the highlights show every YouTube montage and play it only after a click", async ({ page }) => {
        await page.goto("/");

        const items = page.locator("#highlights .highlights__item");
        await expect(items).toHaveCount(HIGHLIGHTS.length);
        for (const [i, video] of HIGHLIGHTS.entries()) {
            await expect(items.nth(i).getByRole("heading", { level: 3 })).toHaveText(video.title);
            await expect(items.nth(i).getByRole("link", { name: "Watch on YouTube" })).toHaveAttribute(
                "href",
                `https://www.youtube.com/watch?v=${video.id}`,
            );
        }
        const first = items.first();
        await expect(first.locator("iframe")).toHaveCount(0);
        await first.locator("button.clip-player__poster").click();
        await expect(first.locator("iframe")).toHaveAttribute(
            "src",
            `https://www.youtube-nocookie.com/embed/${HIGHLIGHTS[0].id}?autoplay=1`,
        );
    });

    test("the loadout lists the hardware and the settings with the computed eDPI", async ({ page }) => {
        await page.goto("/");

        const loadout = page.locator("#loadout");
        await expect(loadout).toContainText(LOADOUT.hardware.cpu);
        await expect(loadout).toContainText(LOADOUT.hardware.gpu);
        await expect(loadout.locator(".loadout__row").filter({ hasText: "eDPI" }).locator("dd")).toHaveText(
            String(Math.round(LOADOUT.settings.dpi * LOADOUT.settings.sensitivity)),
        );
    });

    test("the Sage Range teaser closes the page with its call to action", async ({ page }) => {
        await page.goto("/");

        const teaser = page.locator("#range");
        await expect(teaser.getByRole("heading", { level: 2, name: "Test your instincts." })).toBeVisible();
        if (RANGE_ENABLED) {
            await expect(teaser.getByRole("link", { name: /Play Sage Range/ })).toHaveAttribute("href", /\/range$/);
        } else {
            // The game is not served yet: a disabled button, never a link to a missing page.
            const cta = teaser.getByRole("button", { name: /Play Sage Range/ });
            await expect(cta).toBeDisabled();
            await expect(cta).toContainText("Coming soon");
            await expect(teaser.getByRole("link")).toHaveCount(0);
        }
    });

    test("the header links to every home section, then its pages, and marks the one reached", async ({ page }) => {
        await page.goto("/");

        const nav = page.getByRole("navigation", { name: "Main" });
        const links = nav.getByRole("link");
        // Section anchors first, then the pages kept in the header (HEADER_NAV, e.g. the game).
        await expect(links).toHaveCount(HEADER_SECTIONS.length + HEADER_NAV.length);
        for (const [i, section] of HEADER_SECTIONS.entries()) {
            await expect(links.nth(i)).toHaveAttribute("href", new RegExp(`#${section.id}$`));
            await expect(page.locator(`#${section.id}`)).toHaveCount(1);
        }

        const loadout = nav.getByRole("link", { name: "Loadout" });
        if (!(await loadout.isVisible())) await page.locator(".menu-toggle").click();
        await loadout.click();
        await expect(page).toHaveURL(/#loadout$/);
        await expect(loadout).toHaveAttribute("aria-current", "location");
    });

    test("a header section link from another page scrolls there, and again on a second click", async ({ page }) => {
        await page.goto("/range");

        const nav = page.getByRole("navigation", { name: "Main" });
        const loadout = nav.getByRole("link", { name: "Loadout" });
        if (!(await loadout.isVisible())) await page.locator(".menu-toggle").click();
        await loadout.click();
        await expect(page).toHaveURL(/#loadout$/);
        // The section reaches the top (under the sticky header) instead of the page staying at the top.
        await expect
            .poll(async () => page.locator("#loadout").evaluate((el) => el.getBoundingClientRect().top))
            .toBeLessThan(200);
        await expect(loadout).toHaveAttribute("aria-current", "location");

        // Scroll away, then click the link already in the URL: it scrolls back, the hash stays single.
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        if (!(await loadout.isVisible())) await page.locator(".menu-toggle").click();
        await loadout.click();
        await expect
            .poll(async () => page.locator("#loadout").evaluate((el) => el.getBoundingClientRect().top))
            .toBeLessThan(200);
        expect(new URL(page.url()).hash).toBe("#loadout");
    });

    test("the cookie banner appears then hides after acceptance", async ({ page }) => {
        await page.goto("/");

        const banner = cookieBanner(page);
        await expect(banner).toBeVisible();

        await acceptCookiesButton(page).click();

        await expect(banner).toBeHidden();
    });

    test("FR ↔ EN language switch keeps the current page", async ({ page }) => {
        await page.goto("/");

        await languageButton(page).click();
        await languageOption(page, "Français").click();

        await expect(page).toHaveURL(lpRe("fr"));

        await languageButton(page).click();
        await languageOption(page, "English").click();

        await expect(page).toHaveURL(lpRe("en"));
    });

    test("the theme toggle sets data-theme on <html>", async ({ page }) => {
        await page.goto("/");

        const before = await page.getAttribute("html", "data-theme");

        await themeToggle(page).click();

        const after = await page.getAttribute("html", "data-theme");

        expect(after).not.toBe(before);
        expect(["light", "dark"]).toContain(after);
    });
});
