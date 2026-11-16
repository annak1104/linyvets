import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/generate-technical-supervision-contract/route";
import { parseAvk5Estimate } from "@/lib/avk5-parser";
import { createEstimateContext } from "@/lib/documents/estimate-context";
import { buildTechnicalSupervisionContractDefaults } from "@/lib/technical-supervision-contract";

const source = readFileSync(resolve(process.cwd(), "reference/67_КД_ЗКР.rtf"));

function documentXml(buffer: Buffer): string {
  const file = new PizZip(buffer).file("word/document.xml");
  if (!file) throw new Error("Generated contract is missing word/document.xml");
  return file.asText().replaceAll("&quot;", '"');
}

describe("POST /api/generate-technical-supervision-contract", () => {
  it("generates a synchronized contract with user-confirmed party data", async () => {
    const context = createEstimateContext(await parseAvk5Estimate(source), "67_КД_ЗКР.rtf");
    const values = {
      ...buildTechnicalSupervisionContractDefaults(context),
      contractNumber: "01/26",
      documentDate: "12 травня 2026",
      contractEndDate: "31.12.2026",
      customerName: "Підтверджений замовник",
      customerRepresentative: "ПІБ представника",
      customerLegalBasis: "Положення",
      contractorName: "Підтверджений виконавець",
      contractorRegistrationDetails: "Виписка з реєстру",
      contractorCertificate: "Сертифікат серії АТ № 000000",
      customerTaxStatus: "не є платником податку",
      contractorTaxStatus: "є платником Єдиного податку 5%",
      customerDetails: "Замовник\nАдреса\nРахунок",
      customerSignatureTitle: "Директор",
      customerSignature: "Підпис замовника",
      contractorDetails: "Виконавець\nАдреса\nРахунок",
      contractorSignatureTitle: "ФОП",
      contractorSignature: "Підпис виконавця",
    };
    const response = await POST(new Request("http://localhost/api/generate-technical-supervision-contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }));
    const document = Buffer.from(await response.arrayBuffer());
    const xml = documentXml(document);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(decodeURIComponent(response.headers.get("content-disposition") ?? "")).toContain("dogovir-tekhnichnoho-nahliadu.docx");
    expect(xml).toContain(values.projectName);
    expect(xml).toContain("1,1%");
    expect(xml).toContain("177 135,00");
    expect(xml).toContain("1 948,49");
    expect(xml).toContain("Одна тисяча дев’ятсот сорок вісім грн 49 коп.");
    expect(xml).toContain("Підтверджений замовник");
    expect(xml).toContain("Підтверджений виконавець");
    expect(xml).not.toContain("{{");
    expect(xml).not.toContain("Шевчук Ігор");
  });

  it("rejects missing and malformed contract details", async () => {
    const response = await POST(new Request("http://localhost/api/generate-technical-supervision-contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectName: "Об’єкт" }) }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_TECHNICAL_SUPERVISION_CONTRACT_DATA");
  });
});
