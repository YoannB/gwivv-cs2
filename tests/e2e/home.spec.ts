import { expect, test } from "@playwright/test";
import { SITE_NAME, SOCIAL_LINKS } from "../../constants/site";
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
