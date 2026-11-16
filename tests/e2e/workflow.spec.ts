import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";

const fixturePath = resolve(process.cwd(), "reference/6_КД_ЗКР.rtf");
const secondFixturePath = resolve(process.cwd(), "reference/10_КД_ЗКР.rtf");
const localFixturePath = resolve(process.cwd(), "reference/8_КД_ЛК1_02-01-01.rtf");
const longProjectFixturePath = resolve(process.cwd(), "reference/67_КД_ЗКР.rtf");
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
    await expect(page.getByLabel(/Проєктна організація/)).toHaveValue("Ігор ШЕВЧУК");
    await expect(page.getByText("Кошторис успішно прочитано")).toBeVisible();
    await expect(page.locator('[aria-label="Попередній перегляд документа"]')).toContainText("Проєктна організація: ФОП Шевчук І.В.");
    await expect(page.getByLabel("Абзац 4 · інженер")).toHaveValue("Головний інженер проєкту: Шевчук І.В.");

    await page.getByLabel("Абзац 3 · організація").fill("Організаційний абзац, відредагований вручну");
    await page.getByLabel(/Проєктна організація/).fill("Нове ім’я керівника");
    await page.getByLabel("Абзац 4 · інженер").fill("Інженерний абзац, відредагований вручну");
    await page.getByLabel("Головний інженер проєкту").fill("Новий інженер");
    await expect(page.getByLabel("Абзац 3 · організація")).toHaveValue("Організаційний абзац, відредагований вручну");
    await expect(page.getByLabel("Абзац 4 · інженер")).toHaveValue("Інженерний абзац, відредагований вручну");
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
    expect(xml).toContain("Організаційний абзац, відредагований вручну");
    expect(xml).toContain("Інженерний абзац, відредагований вручну");
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

  test("keeps the complete wrapped project name in the form, preview, and generated DOCX", async ({ page }) => {
    const projectName = "Поточний ремонт зупинки громадського транспорту \"Мостозагін\", що на вул.Ківерцівська,біля будинку 9б (непарна сторона) в місті Луцьку Волинської області";

    await page.goto("/");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Завантажити файл кошторису" }).click();
    await (await chooser).setFiles(longProjectFixturePath);

    await expect(page.getByRole("heading", { name: "Перевірте наказ перед формуванням." })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("Назва проєкту")).toHaveValue(projectName);
    await expect(page.locator('[aria-label="Попередній перегляд документа"]')).toContainText(projectName);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Сформувати AVK-5/ }).click();
    const download = await downloadPromise;
    const downloadedPath = await download.path();

    expect(downloadedPath).not.toBeNull();
    expect(documentXml(readFileSync(downloadedPath!)).replaceAll("&quot;", '"')).toContain(projectName);
  });

  test("generates the technical supervision calculation from the shared AVK-5 context", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("checkbox", { name: "Наказ про затвердження кошторису" }).uncheck({ force: true });
    await page.getByRole("checkbox", { name: "Розрахунок вартості технічного нагляду" }).check({ force: true });

    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Завантажити файл кошторису" }).click();
    await (await chooser).setFiles(longProjectFixturePath);

    await expect(page.getByRole("heading", { name: "Підтвердіть розрахунок технічного нагляду." })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel(/Всього по зведеному кошторисному розрахунку, грн/)).toHaveValue("264 325,00");
    await expect(page.getByLabel(/Разом по главах 1–9, грн/)).toHaveValue("177 135,00");
    await expect(page.getByLabel(/Розрахована вартість технічного нагляду, грн/)).toHaveValue("1 948,49");
    await expect(page.getByRole("checkbox", { name: /актуальність реквізитів/i })).toHaveCount(0);
    await expect(page.getByText("Перевірте актуальність реквізитів").first()).toBeVisible();

    await page.getByLabel(/Номер договору/).fill("01/26");
    await page.getByLabel(/Дата документа/).fill("12 травня 2026");
    await page.getByLabel(/Реквізити замовника/).fill("Замовник\nАдреса");
    await page.getByLabel(/Директор замовника/).fill("Директор");
    await page.getByLabel(/Реквізити виконавця/).fill("Виконавець\nАдреса");
    await page.getByLabel(/Посада виконавця/).fill("ФОП");
    await page.getByLabel(/Підпис виконавця/).fill("Підписант");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Сформувати розрахунок" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("rozrakhunok-tehnichnoho-nahliadu.docx");
    const downloadedPath = await download.path();
    expect(downloadedPath).not.toBeNull();
    const xml = documentXml(readFileSync(downloadedPath!));
    expect(xml).toContain("264 325,00");
    expect(xml).toContain("177 135,00");
    expect(xml).toContain("1 948,49");
    expect(xml).toContain("12 травня 2026");
    expect(xml).toContain("Замовник");
    expect(xml).toContain("Підписант");
    expect(xml).not.toContain("{{");
    await expect(page.getByText("Розрахунок вартості технічного нагляду", { exact: true }).last()).toBeVisible();
  });

  test("generates the five-page technical supervision contract without reference party data", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("checkbox", { name: "Наказ про затвердження кошторису" }).uncheck({ force: true });
    await page.getByRole("checkbox", { name: "Договір технічного нагляду" }).check({ force: true });

    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Завантажити файл кошторису" }).click();
    await (await chooser).setFiles(longProjectFixturePath);

    await expect(page.getByRole("heading", { name: "Підтвердіть договір технічного нагляду." })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel(/Назва об’єкта/)).toHaveValue(/Поточний ремонт зупинки громадського транспорту/);
    await expect(page.getByLabel(/Сума договору, грн/)).toHaveValue("1 948,49");
    await expect(page.getByText(/історичне посилання/)).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /актуальність реквізитів/i })).toHaveCount(0);
    await expect(page.getByText("Перевірте актуальність реквізитів").first()).toBeVisible();
    await expect(page.locator('[aria-label="Попередній перегляд договору"]')).toContainText("1. Визначення окремих термінів договору.");
    await expect(page.locator('[aria-label="Попередній перегляд договору"]')).toContainText("12. Юридичні адреси, банківські реквізити і підписи Сторін.");

    await page.getByLabel(/Номер договору/).fill("02/26");
    await page.getByLabel(/Дата договору/).fill("13 травня 2026");
    await page.getByLabel(/Діє до/).fill("31.12.2026");
    await page.getByLabel(/Назва замовника/).fill("Замовник для тесту");
    await page.getByLabel(/Уповноважений представник замовника/).fill("Представник замовника");
    await page.getByLabel(/Підстава повноважень замовника/).fill("Статут");
    await page.getByLabel(/Назва виконавця/).fill("Виконавець для тесту");
    await page.getByLabel(/Реєстраційні дані виконавця/).fill("Реєстраційні дані");
    await page.getByLabel(/Кваліфікаційний сертифікат/).fill("АТ № 000000");
    await page.getByLabel(/Податковий статус замовника/).fill("не є платником податку");
    await page.getByLabel(/Податковий статус виконавця/).fill("є платником Єдиного податку 5%");
    await page.getByLabel(/Реквізити замовника/).fill("Замовник\nАдреса\nРахунок");
    await page.getByLabel(/Підпис замовника/).fill("Підпис замовника");
    await page.getByLabel(/Реквізити виконавця/).fill("Виконавець\nАдреса\nРахунок");
    await page.getByLabel(/Посада виконавця/).fill("ФОП");
    await page.getByLabel(/Підпис виконавця/).fill("Підпис виконавця");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Сформувати договір" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("dogovir-tekhnichnoho-nahliadu.docx");
    const downloadedPath = await download.path();
    expect(downloadedPath).not.toBeNull();
    const xml = documentXml(readFileSync(downloadedPath!));
    expect(xml).toContain("1 948,49");
    expect(xml).toContain("Замовник для тесту");
    expect(xml).toContain("Виконавець для тесту");
    expect(xml).not.toContain("Шевчук Ігор");
    expect(xml).not.toContain("UA113033980000026009500700621");
    expect(xml).not.toContain("{{");
    await expect(page.getByText("Договір технічного нагляду", { exact: true }).last()).toBeVisible();
  });

  test("generates all selected documents as one ZIP after independent review", async ({ page }) => {
    const projectName = "Поточний ремонт зупинки громадського транспорту \"Мостозагін\", що на вул.Ківерцівська,біля будинку 9б (непарна сторона) в місті Луцьку Волинської області";

    await page.goto("/");
    await page.getByRole("button", { name: "Обрати всі" }).click();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Завантажити файл кошторису" }).click();
    await (await chooser).setFiles(longProjectFixturePath);

    await expect(page.getByRole("heading", { name: "Перевірте наказ перед формуванням." })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Сформувати ZIP" })).toBeVisible();

    await page.getByRole("tab", { name: "Розрахунок вартості технічного нагляду" }).click();
    await page.getByLabel(/Номер договору/).fill("01/26");
    await page.getByLabel(/Дата документа/).fill("12 травня 2026");
    await page.getByLabel(/Реквізити замовника/).fill("Замовник\nАдреса");
    await page.getByLabel(/Директор замовника/).fill("Директор");
    await page.getByLabel(/Реквізити виконавця/).fill("Виконавець\nАдреса");
    await page.getByLabel(/Посада виконавця/).fill("ФОП");
    await page.getByLabel(/Підпис виконавця/).fill("Підписант");

    await page.getByRole("tab", { name: "Договір технічного нагляду" }).click();
    await page.getByLabel(/Діє до/).fill("31.12.2026");
    await page.getByLabel(/Назва замовника/).fill("Замовник для ZIP");
    await page.getByLabel(/Уповноважений представник замовника/).fill("Представник");
    await page.getByLabel(/Підстава повноважень замовника/).fill("Статут");
    await page.getByLabel(/Назва виконавця/).fill("Виконавець для ZIP");
    await page.getByLabel(/Реєстраційні дані виконавця/).fill("Реєстраційні дані");
    await page.getByLabel(/Кваліфікаційний сертифікат/).fill("АТ № 000000");
    await page.getByLabel(/Податковий статус замовника/).fill("не є платником податку");
    await page.getByLabel(/Податковий статус виконавця/).fill("є платником Єдиного податку 5%");
    await page.getByLabel(/Реквізити замовника/).fill("Замовник\nАдреса");
    await page.getByLabel(/Підпис замовника/).fill("Директор");
    await page.getByLabel(/Реквізити виконавця/).fill("Виконавець\nАдреса");
    await page.getByLabel(/Посада виконавця/).fill("ФОП");
    await page.getByLabel(/Підпис виконавця/).fill("Підписант");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Сформувати ZIP" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("dokumenty.zip");
    const downloadedPath = await download.path();
    expect(downloadedPath).not.toBeNull();
    const archive = new PizZip(readFileSync(downloadedPath!));
    const entries = Object.keys(archive.files).filter((entry) => !entry.endsWith("/"));

    expect(entries).toHaveLength(3);
    expect(entries.join(" ")).toContain("nakaz");
    expect(entries.join(" ")).toContain("rozrakhunok-tehnichnoho-nahliadu");
    expect(entries.join(" ")).toContain("dogovir-tehnichnoho-nahliadu");
    for (const entry of entries) expect(documentXml(archive.file(entry)!.asNodeBuffer()).replaceAll("&quot;", '"')).toContain(projectName);
    await expect(page.getByText("Крок 3 · Пакет готовий")).toBeVisible();
    await expect(page.getByRole("button", { name: /DOCX/ })).toHaveCount(3);
  });
});
