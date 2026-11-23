import { expect, test } from "@playwright/test";
import { CLIPS, CLIPS_ON_HOME, HIGHLIGHTS, LOADOUT, SITE_NAME, SOCIAL_LINKS } from "../../constants/site";
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
