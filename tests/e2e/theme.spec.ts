import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const fixturePath = resolve(process.cwd(), "reference/6_КД_ЗКР.rtf");

test.describe("Лінивець themes", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!window.sessionStorage.getItem("linyvets-theme-test-initialized")) {
        window.localStorage.removeItem("linyvets-theme");
        window.sessionStorage.setItem("linyvets-theme-test-initialized", "1");
      }
    });
  });

  test("uses the system preference, switches without losing form data, and persists the choice", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    const html = page.locator("html");
    const toggle = page.getByRole("button", { name: "Увімкнути світлу тему" });
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(toggle).toBeVisible();
    await expect(page.locator("main")).toHaveCSS("background-color", "rgb(11, 17, 32)");

    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Завантажити файл кошторису" }).click();
    await (await chooser).setFiles(fixturePath);
    await expect(page.getByRole("heading", { name: "Перевірте наказ перед формуванням." })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Назва проєкту").fill("Темний тестовий об’єкт");
    await expect(page.getByLabel("Назва проєкту")).toHaveCSS("background-color", "rgb(27, 41, 64)");
    await expect(page.locator('[aria-label="Попередній перегляд документа"]')).toHaveCSS("background-color", "rgb(255, 255, 255)");

    await toggle.click();
    await expect(html).toHaveAttribute("data-theme", "light");
    await expect(page.getByLabel("Назва проєкту")).toHaveValue("Темний тестовий об’єкт");
    await expect(page.locator("main")).toHaveCSS("background-color", "rgb(244, 249, 252)");
    await expect(page.locator('[aria-label="Попередній перегляд документа"]')).toHaveCSS("background-color", "rgb(255, 255, 255)");

    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Увімкнути темну тему" })).toBeVisible();
    expect(consoleErrors.filter((message) => /hydration|mismatch/i.test(message))).toHaveLength(0);
  });

  test("keeps the system preference on a first visit when it is light", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Увімкнути темну тему" })).toBeVisible();
  });
});
