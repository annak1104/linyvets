import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/generate-technical-supervision-contract/route";
import { parseAvk5Estimate } from "@/lib/avk5-parser";
import { createEstimateContext } from "@/lib/documents/estimate-context";
import { buildTechnicalSupervisionContractDefaults, EMPTY_CONTRACT_END_DATE_PLACEHOLDER, EMPTY_CONTRACT_SIGNING_DATE_PLACEHOLDER } from "@/lib/technical-supervision-contract";

const source = readFileSync(resolve(process.cwd(), "reference/67_КД_ЗКР.rtf"));

function documentXml(buffer: Buffer): string {
  const file = new PizZip(buffer).file("word/document.xml");
  if (!file) throw new Error("Generated contract is missing word/document.xml");
  return file.asText().replaceAll("&quot;", '"');
}

describe("POST /api/generate-technical-supervision-contract", () => {
  it("renders the same profile and historical defaults used by the contract preview", async () => {
    const context = createEstimateContext(await parseAvk5Estimate(source), "67_КД_ЗКР.rtf");
    const defaults = buildTechnicalSupervisionContractDefaults(context);
    const values = {
      ...defaults,
      contractNumber: "01/26",
      documentDate: "12 травня 2026",
      contractorCertificate: "АТ № 007622",
    };
    const response = await POST(new Request("http://localhost/api/generate-technical-supervision-contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }));
    const xml = documentXml(Buffer.from(await response.arrayBuffer()));

    expect(response.status).toBe(200);
    expect(xml).toContain(defaults.customerName);
    expect(xml).toContain(defaults.customerDetails.split("\n")[0]);
    expect(xml).toContain(defaults.contractorDetails.split("\n")[0]);
    expect(xml).toContain(defaults.customerLegalBasis);
    expect(xml).toContain(defaults.contractorAuthorizationBasis);
    expect(xml).toContain("№ 01/26");
    expect(xml).toContain("«12 травня 2026»");
    expect(xml).toContain(defaults.contractEndDate);
    expect(xml).toContain(defaults.appendixReference);
    expect(xml).toContain("11.6. Замовник своїм підписом підтверджує, що він не є платником податку, Виконавець своїм підписом підтверджує, що він є платником Єдиного податку 5%.");
    expect(xml).not.toContain("що він що він");
    expect(xml).toContain("1,1%");
    expect(xml).toContain("1 948,49");
  });

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

  it("accepts a partially completed contract with only the number", async () => {
    const context = createEstimateContext(await parseAvk5Estimate(source), "67_КД_ЗКР.rtf");
    const values = {
      ...buildTechnicalSupervisionContractDefaults(context),
      contractNumber: "01/26",
      contractEndDate: "",
      contractorCertificate: "АТ № 007622",
      customerTaxStatus: "потребує підтвердження",
      contractorTaxStatus: "потребує підтвердження",
    };
    const response = await POST(new Request("http://localhost/api/generate-technical-supervision-contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }));
    const xml = documentXml(Buffer.from(await response.arrayBuffer()));

    expect(response.status).toBe(200);
    expect(xml).toContain("№ 01/26");
    expect(xml).toContain(EMPTY_CONTRACT_SIGNING_DATE_PLACEHOLDER);
    expect(xml).toContain(EMPTY_CONTRACT_END_DATE_PLACEHOLDER);
  });

  it.each([
    ["probudkontrol", "Товариство з обмеженою відповідальністю «ПроБудКонтроль»", "виписка з Єдиного державного реєстру від 18.12.2025, № 1001871020000003582", ""],
    ["ik-zahid", "Товариство з обмеженою відповідальністю «ІК ЗАХІД»", "Статут, затверджений установчими зборами засновників, протокол від 30.01.2025 № 1.", ""],
    ["fop-shevchuk", "ФОП Шевчук Ігор Вікторович", "виписка з Єдиного державного реєстру від 14.06.2017, № 2 182 000 0000 002106", "АТ № 007622"],
    ["fop-kras", "ФОП Крась Юрій Ігорович", "виписка з Єдиного державного реєстру від 17.10.2019 № 2 198 000 0000 033585", "АТ № 007840"],
  ] as const)("renders the selected %s contractor without cross-profile data", async (profileId, legalName, authorizationBasis, certificate) => {
    const context = createEstimateContext(await parseAvk5Estimate(source), "67_КД_ЗКР.rtf");
    const defaults = buildTechnicalSupervisionContractDefaults(context, { contractorProfileId: profileId });
    const values = {
      ...defaults,
      contractorCertificate: defaults.contractorCertificate || certificate,
    };
    const response = await POST(new Request("http://localhost/api/generate-technical-supervision-contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }));
    const xml = documentXml(Buffer.from(await response.arrayBuffer()));

    expect(response.status).toBe(200);
    expect(xml).toContain(legalName);
    expect(xml).toContain(authorizationBasis);
    if (certificate) expect(xml).toContain(certificate);
    expect(xml).not.toContain("та , з другої сторони");
    if (profileId !== "fop-kras") expect(xml).not.toContain("UA133052990000026004040804630");
    if (profileId !== "fop-kras") expect(xml).not.toContain("Крась Ю.І.");
  });

  it("preserves a manually supplied certificate for a TОВ contractor", async () => {
    const context = createEstimateContext(await parseAvk5Estimate(source), "67_КД_ЗКР.rtf");
    const defaults = buildTechnicalSupervisionContractDefaults(context, { contractorProfileId: "ik-zahid" });
    const values = { ...defaults, contractorCertificate: "АТ № ручний" };
    const response = await POST(new Request("http://localhost/api/generate-technical-supervision-contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }));
    const xml = documentXml(Buffer.from(await response.arrayBuffer()));

    expect(response.status).toBe(200);
    expect(xml).toContain(" та АТ № ручний");
    expect(xml).toContain("Товариство з обмеженою відповідальністю «ІК ЗАХІД»");
  });

  it("rejects missing and malformed contract details", async () => {
    const response = await POST(new Request("http://localhost/api/generate-technical-supervision-contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectName: "Об’єкт" }) }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_TECHNICAL_SUPERVISION_CONTRACT_DATA");
  });
});
