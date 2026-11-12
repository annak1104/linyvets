import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";

const fixturePath = resolve(process.cwd(), "reference/6_КД_ЗКР.rtf");
const secondFixturePath = resolve(process.cwd(), "reference/10_КД_ЗКР.rtf");
const localFixturePath = resolve(process.cwd(), "reference/8_КД_ЛК1_02-01-01.rtf");
const auditDir = resolve(process.cwd(), "qa/reliability-audit");

function saveScreenshotPath(name: string): string {
  mkdirSync(auditDir, { recursive: true });
  return resolve(auditDir, name);
}

function documentXml(buffer: Buffer): string {
  const zip = new PizZip(buffer);
  const document = zip.file("word/document.xml");
  if (!document) throw new Error("Generated DOCX is missing word/document.xml");
  return document.asText();
}

test.describe("Лінивець complete workflow", () => {
  test("uploads, parses, edits, previews, generates, downloads, and can restart", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Почнемо з вашого кошторису." })).toBeVisible();
    await page.screenshot({ path: saveScreenshotPath(`01-upload-${testInfo.project.name}.png`), fullPage: true });

    const firstChooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Завантажити файл кошторису" }).click();
    await (await firstChooser).setFiles(fixturePath);

    await expect(page.getByRole("heading", { name: "Перевірте наказ перед формуванням." })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("Назва проєкту")).toHaveValue("Поточний ремонт проїзду до будинку №19б на вулиці Кравчука до вулиці Конякіна в місті Луцьку Волинської області");
    await expect(page.getByLabel("Сума, тис. грн")).toHaveValue("197,271");
    await expect(page.getByLabel("Головний інженер проєкту")).toHaveValue("Ігор ШЕВЧУК");
    await expect(page.getByText("Кошторис успішно прочитано")).toBeVisible();
    await expect(page.getByText("Проєктну організацію не зазначено у джерелі.")).toBeVisible();
    await page.screenshot({ path: saveScreenshotPath(`02-review-parsed-${testInfo.project.name}.png`), fullPage: true });

    const projectName = "Поточний ремонт — оновлений об’єкт із дуже довгою назвою 2026";
    await page.getByLabel("Назва проєкту").fill(projectName);
    await page.getByLabel("Сума, тис. грн").fill("12345,678");
    await expect(page.getByLabel("Сума українською")).toHaveValue("Дванадцять мільйонів триста сорок п’ять тисяч шістсот сімдесят вісім грн 00 коп.");
    await expect(page.locator('[aria-label="Попередній перегляд документа"]')).toContainText(projectName);
    await expect(page.locator('[aria-label="Попередній перегляд документа"]')).toContainText("12345,678");
    await page.screenshot({ path: saveScreenshotPath(`03-review-edited-${testInfo.project.name}.png`), fullPage: true });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Сформувати AVK-5" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Поточний-ремонт-оновлений-обєкт-із-дуже-довгою-назвою-2026.docx");
    const downloadedPath = await download.path();
    expect(downloadedPath).not.toBeNull();
    const xml = documentXml(readFileSync(downloadedPath!));
    expect(xml).toContain(projectName);
    expect(xml).toContain("12345,678");
    expect(xml).toContain("Дванадцять мільйонів триста сорок п’ять тисяч шістсот сімдесят вісім грн 00 коп.");
    expect(xml).toContain("Ігор ШЕВЧУК");
    expect(xml).not.toContain("{{");
    expect(xml).not.toContain("Кравчука");
    await expect(page.getByText("Крок 3 · Документ готовий")).toBeVisible();
    await expect(page.getByText(download.suggestedFilename())).toBeVisible();
    await expect(page.getByText("Офіційний наказ")).toBeVisible();
    await expect(page.getByText("Позиції замовлення")).toHaveCount(0);
    await expect(page.getByText("12345,678 тис. грн")).toBeVisible();
    await page.screenshot({ path: saveScreenshotPath(`04-download-${testInfo.project.name}.png`), fullPage: true });

    await page.getByRole("button", { name: "Створити новий документ" }).click();
    await expect(page.getByRole("heading", { name: "Почнемо з вашого кошторису." })).toBeVisible();
    const secondChooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Завантажити файл кошторису" }).click();
    await (await secondChooser).setFiles(secondFixturePath);
    await expect(page.getByRole("heading", { name: "Перевірте наказ перед формуванням." })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("Назва проєкту")).toHaveValue("Поточний ремонт вулиці Іова Кондзелевича в місті Луцьку Волинської області");
    await expect(page.getByLabel("Сума, тис. грн")).toHaveValue("215,007");
    await expect(page.getByLabel("Назва проєкту")).not.toHaveValue(projectName);
  });

  test("shows a clear corrupted-file error and preserves the mobile layout", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.screenshot({ path: saveScreenshotPath(`05-upload-${testInfo.project.name}.png`), fullPage: true });
    const corruptedPath = resolve(auditDir, "corrupted.rtf");
    mkdirSync(auditDir, { recursive: true });
    writeFileSync(corruptedPath, "{\\rtf1\\ansi broken");

    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Завантажити файл кошторису" }).click();
    await (await chooser).setFiles(corruptedPath);
    await expect(page.locator('[role="alert"]').filter({ hasText: "Файл не схожий на коректний RTF-документ або пошкоджений." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Почнемо з вашого кошторису." })).toBeVisible();
    await page.screenshot({ path: saveScreenshotPath(`06-upload-corrupted-${testInfo.project.name}.png`), fullPage: true });

    const retryChooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Завантажити файл кошторису" }).click();
    await (await retryChooser).setFiles(fixturePath);
    await expect(page.getByRole("heading", { name: "Перевірте наказ перед формуванням." })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: saveScreenshotPath(`07-review-${testInfo.project.name}.png`), fullPage: true });
  });

  test("populates the local-estimate fields without exposing work items", async ({ page }) => {
    await page.goto("/");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Завантажити файл кошторису" }).click();
    await (await chooser).setFiles(localFixturePath);

    await expect(page.getByRole("heading", { name: "Перевірте наказ перед формуванням." })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("Назва проєкту")).toHaveValue("Поточний ремонт вулиці Ветеранів в місті Луцьку Волинської області");
    await expect(page.getByLabel("Сума, тис. грн")).toHaveValue("144,079");
    await expect(page.getByLabel("Головний інженер проєкту")).toHaveValue("");
    await expect(page.getByText("Позиції замовлення")).toHaveCount(0);
    await expect(page.getByText("Показати джерело реквізитів наказу")).toBeVisible();
  });
});
