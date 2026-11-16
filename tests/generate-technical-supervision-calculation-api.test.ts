import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/generate-technical-supervision-calculation/route";
import { parseAvk5Estimate } from "@/lib/avk5-parser";
import { createEstimateContext } from "@/lib/documents/estimate-context";
import { buildTechnicalSupervisionCalculationDefaults } from "@/lib/technical-supervision-calculation";

const source = readFileSync(resolve(process.cwd(), "reference/67_КД_ЗКР.rtf"));

function packagePart(buffer: Buffer, name: string): Buffer {
  const file = new PizZip(buffer).file(name);
  if (!file) throw new Error(`Missing DOCX part: ${name}`);
  return file.asNodeBuffer();
}

function digest(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

describe("POST /api/generate-technical-supervision-calculation", () => {
  it("generates the verified reference calculation with edited party details", async () => {
    const parsed = await parseAvk5Estimate(source);
    const context = createEstimateContext(parsed, "67_КД_ЗКР.rtf");
    const values = {
      ...buildTechnicalSupervisionCalculationDefaults(context),
      contractNumber: "01/26",
      documentDate: "12 травня 2026",
      customerDetails: "Підтверджений замовник\nАдреса замовника\nРахунок замовника",
      customerDirector: "ПІБ директора",
      contractorDetails: "Підтверджений виконавець\nАдреса виконавця\nРахунок виконавця",
      contractorSignatureTitle: "Підписант виконавця",
      contractorSignature: "ПІБ виконавця",
    };
    const response = await POST(new Request("http://localhost/api/generate-technical-supervision-calculation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }));
    const document = Buffer.from(await response.arrayBuffer());
    const xml = packagePart(document, "word/document.xml").toString("utf8").replaceAll("&quot;", '"');
    const template = packagePart(readFileSync(resolve(process.cwd(), "templates/technical-supervision-calculation-v1.docx")), "word/styles.xml");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(decodeURIComponent(response.headers.get("content-disposition") ?? "")).toContain("rozrakhunok-tehnichnoho-nahliadu.docx");
    expect(xml).toContain(values.projectName);
    expect(xml).toContain("264 325,00");
    expect(xml).toContain("177 135,00");
    expect(xml).toContain("1 948,49");
    expect(xml).toContain("Одна тисяча дев’ятсот сорок вісім грн 49 коп.");
    expect(xml).toContain("Підтверджений замовник");
    expect(xml).toContain("Підтверджений виконавець");
    expect(xml).not.toContain("{{");
    expect(xml).not.toContain("Шевчук");
    expect(digest(packagePart(document, "word/styles.xml"))).toBe(digest(template));
  });

  it("requires user confirmation for document and party details", async () => {
    const response = await POST(new Request("http://localhost/api/generate-technical-supervision-calculation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName: "Проєкт" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_TECHNICAL_SUPERVISION_DATA");
  });
});

