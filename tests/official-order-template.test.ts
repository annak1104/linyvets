import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";

import {
  createOfficialOrderDocx,
  generateOfficialOrderDocx,
} from "@/lib/official-order-template";
import { amountInWordsUkrainian } from "@/lib/ua-currency-to-words";

const sourcePath = resolve(process.cwd(), "reference/Кравчука.docx");
const templatePath = resolve(process.cwd(), "templates/official-order-template.docx");
const preservedParts = [
  "word/styles.xml",
  "word/numbering.xml",
  "word/theme/theme1.xml",
  "word/settings.xml",
  "word/fontTable.xml",
  "word/webSettings.xml",
  "customXml/item1.xml",
];

function packagePart(buffer: Buffer, name: string): Buffer {
  const file = new PizZip(buffer).file(name);
  if (!file) throw new Error(`Missing DOCX part: ${name}`);
  return file.asNodeBuffer();
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function documentXml(buffer: Buffer): string {
  return packagePart(buffer, "word/document.xml").toString("utf8");
}

function documentText(buffer: Buffer): string {
  return documentXml(buffer)
    .replace(/<[^>]+>/g, "")
    .replace(/&#x2019;/g, "’")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

describe("official order Docxtemplater template", () => {
  it("keeps the source emblem and embedded object while exposing reusable slots", () => {
    const source = readFileSync(sourcePath);
    const template = readFileSync(templatePath);
    const xml = documentXml(template);
    const text = documentText(template);

    expect(sha256(packagePart(template, "word/media/image1.png"))).toBe(
      sha256(packagePart(source, "word/media/image1.png")),
    );
    expect(sha256(packagePart(template, "word/embeddings/oleObject1.bin"))).toBe(
      sha256(packagePart(source, "word/embeddings/oleObject1.bin")),
    );
    for (const part of preservedParts) {
      expect(sha256(packagePart(template, part))).toBe(sha256(packagePart(source, part)));
    }

    for (const slot of [
      "orderParagraph1",
      "projectName",
      "estimatedAmount",
      "estimatedAmountInWords",
      "projectOrganization",
      "chiefProjectEngineer",
      "certificate",
    ]) {
      expect(xml).toContain(`{{${slot}}}`);
    }

    expect(xml).not.toContain("Кравчука");
    expect(xml).not.toContain("Волинської області");
    expect(xml).not.toContain("197,271");
    expect(xml).not.toContain("Шевчук І.В.");
    expect(xml).not.toContain("012269");
    expect(text).toContain("Василь ЛІЩУК");
    expect(text).toContain("Яворський Віктор");
  });

  it("centers the Tryzub anchor without changing its original proportions", () => {
    const template = readFileSync(templatePath);
    const xml = documentXml(template);
    const paragraphs = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g);
    if (!paragraphs) throw new Error("Template has no Word paragraphs");

    expect(paragraphs[1]).toContain('<w:jc w:val="center"/>');
    expect(paragraphs[1]).toContain('style="position:absolute;margin-left:207pt;margin-top:0;width:57pt;height:58.5pt;z-index:251657728"');
  });

  it("replaces fields, leaves missing optional fields blank, and preserves static details", async () => {
    const source = readFileSync(sourcePath);
    const generated = generateOfficialOrderDocx(readFileSync(templatePath), {
      projectName: "Новий об’єкт благоустрою",
      estimatedAmountThousandsUah: "197,271",
      projectOrganization: "",
      chiefProjectEngineer: "Ігор ШЕВЧУК",
      certificate: "",
    });
    const xml = documentXml(generated);
    const text = documentText(generated);

    expect(xml).not.toContain("{{");
    expect(text).toContain("Новий об’єкт благоустрою");
    expect(text).toContain("197,271");
    expect(text).toContain("Сто дев’яносто сім тисяч двісті сімдесят одна грн 00 коп.");
    expect(text).toContain("Ігор ШЕВЧУК");
    expect(text).not.toContain("Проєктна організація:");
    expect(text).toContain("Головний інженер проєкту - Ігор ШЕВЧУК.");
    expect(text).toContain("ЛУЦЬКА  МІСЬКА  РАДА");
    expect(text).toContain("Василь ЛІЩУК");
    expect(xml).not.toContain("Кравчука");
    expect(xml).not.toContain("Шевчук І.В.");
    expect(xml).not.toContain("012269");

    expect(sha256(packagePart(generated, "word/media/image1.png"))).toBe(
      sha256(packagePart(source, "word/media/image1.png")),
    );
    expect(sha256(packagePart(generated, "word/embeddings/oleObject1.bin"))).toBe(
      sha256(packagePart(source, "word/embeddings/oleObject1.bin")),
    );
    for (const part of preservedParts) {
      expect(sha256(packagePart(generated, part))).toBe(sha256(packagePart(source, part)));
    }

    const generatedFromFile = await createOfficialOrderDocx({ projectName: "Файловий тест" });
    expect(documentXml(generatedFromFile)).toContain("Файловий тест");
  });

  it("uses the neutral default order paragraph without copying source-specific text", () => {
    const generated = generateOfficialOrderDocx(readFileSync(templatePath), {
      projectName: "Тестовий проєкт",
      estimatedAmountThousandsUah: "1",
    });
    const xml = documentXml(generated);

    expect(xml).toContain("Затвердити зведений кошторис вартості робіт (робочий проєкт):");
    expect(xml).not.toContain("поточний ремонт проїзду до будинку");
  });
});

describe("Ukrainian currency wording", () => {
  it("converts the expected AVK amount without floating-point arithmetic", () => {
    expect(amountInWordsUkrainian("197,271")).toBe(
      "Сто дев’яносто сім тисяч двісті сімдесят одна грн 00 коп.",
    );
  });

  it("rounds only at the kopeck boundary for decimal input", () => {
    expect(amountInWordsUkrainian("197.2715")).toBe(
      "Сто дев’яносто сім тисяч двісті сімдесят одна грн 50 коп.",
    );
    expect(amountInWordsUkrainian("0,001")).toBe("Одна грн 00 коп.");
  });
});
