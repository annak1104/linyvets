import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/generate-documents/route";
import { parseAvk5Estimate } from "@/lib/avk5-parser";
import { createEstimateContext } from "@/lib/documents/estimate-context";
import { customerSignatories } from "@/lib/party-profiles";
import { buildOrderParagraphs, emptyOrderValues } from "@/lib/order-form";
import { amountInWordsUkrainian } from "@/lib/ua-currency-to-words";
import { buildTechnicalSupervisionCalculationDefaults } from "@/lib/technical-supervision-calculation";
import { buildTechnicalSupervisionContractDefaults } from "@/lib/technical-supervision-contract";
import type { DocumentId } from "@/lib/documents/types";

const sourcePath = resolve(process.cwd(), "reference/67_КД_ЗКР.rtf");

async function buildDocuments() {
  const parsed = await parseAvk5Estimate(readFileSync(sourcePath));
  const context = createEstimateContext(parsed, "67_КД_ЗКР.rtf");
  const projectName = context.project.name.value ?? "";
  const amount = context.totals.final.value?.text ?? "";
  const amountInWords = amountInWordsUkrainian(amount);
  const order = {
    ...emptyOrderValues,
    projectName,
    projectOrganization: context.people.projectOrganizationHead.value ?? "",
    chiefProjectEngineer: context.people.chiefProjectEngineer.value ?? "",
    estimatedAmountThousandsUah: amount,
    estimatedAmountInWords: amountInWords,
    ...buildOrderParagraphs({ projectName, estimatedAmountThousandsUah: amount, estimatedAmountInWords: amountInWords, projectOrganization: context.people.projectOrganizationHead.value ?? "", chiefProjectEngineer: context.people.chiefProjectEngineer.value ?? "", certificate: "" }),
  };
  const calculationDefaults = buildTechnicalSupervisionCalculationDefaults(context);
  const calculation = {
    ...calculationDefaults,
    contractNumber: "01/26",
    documentDate: "12 травня 2026",
    customerDetails: "Замовник\nАдреса",
    customerDirector: "Директор",
    contractorDetails: "Виконавець\nАдреса",
    contractorSignatureTitle: "ФОП",
    contractorSignature: "Підписант",
  };
  const contract = {
    ...buildTechnicalSupervisionContractDefaults(context, calculation),
    contractNumber: "01/26",
    documentDate: "12 травня 2026",
    contractEndDate: "31.12.2026",
    customerName: "Замовник",
    customerRepresentative: "Директор",
    customerLegalBasis: "Статут",
    contractorName: "Виконавець",
    contractorRegistrationDetails: "Реєстраційні дані",
    contractorCertificate: "АТ № 000000",
    customerTaxStatus: "не є платником податку",
    contractorTaxStatus: "є платником Єдиного податку 5%",
    customerDetails: "Замовник\nАдреса",
    customerSignatureTitle: "Директор",
    customerSignature: "Директор",
    contractorDetails: "Виконавець\nАдреса",
    contractorSignatureTitle: "ФОП",
    contractorSignature: "Підписант",
  };

  return {
    "official-estimate-order": order,
    "technical-supervision-calculation": calculation,
    "technical-supervision-contract": contract,
  } as const;
}

function requestFor(documents: Array<{ id: DocumentId; data: unknown }>): Request {
  return new Request("http://localhost/api/generate-documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents }),
  });
}

function archiveEntries(buffer: Buffer): string[] {
  return Object.keys(new PizZip(buffer).files).filter((name) => !name.endsWith("/"));
}

function documentXml(buffer: Buffer): string {
  const document = new PizZip(buffer).file("word/document.xml");
  if (!document) throw new Error("Generated DOCX is missing word/document.xml");
  return document.asText();
}

describe("POST /api/generate-documents", () => {
  it.each([
    ["official-estimate-order", "nakaz"],
    ["technical-supervision-calculation", "rozrakhunok-tehnichnoho-nahliadu"],
    ["technical-supervision-contract", "dogovir-tehnichnoho-nahliadu"],
  ] as const)("generates a valid one-document ZIP for %s", async (id, suffix) => {
    const documents = await buildDocuments();
    const response = await POST(requestFor([{ id, data: documents[id] }]));
    const archive = Buffer.from(await response.arrayBuffer());
    const entries = archiveEntries(archive);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/zip");
    expect(response.headers.get("x-linyvets-document-count")).toBe("1");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toContain(suffix);
    expect(documentXml(new PizZip(archive).file(entries[0])!.asNodeBuffer())).not.toContain("{{");
  });

  it.each([
    ["official-estimate-order", "technical-supervision-calculation"],
    ["official-estimate-order", "technical-supervision-contract"],
    ["technical-supervision-calculation", "technical-supervision-contract"],
  ] as const)("generates a complete ZIP for the pair %s + %s", async (first, second) => {
    const documents = await buildDocuments();
    const response = await POST(requestFor([{ id: first, data: documents[first] }, { id: second, data: documents[second] }]));
    const archive = Buffer.from(await response.arrayBuffer());
    const entries = archiveEntries(archive);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-linyvets-document-count")).toBe("2");
    expect(entries).toHaveLength(2);
    expect(new Set(entries).size).toBe(2);
    expect(entries.some((entry) => entry.includes("nakaz"))).toBe([first as string, second as string].includes("official-estimate-order"));
    for (const entry of entries) expect(documentXml(new PizZip(archive).file(entry)!.asNodeBuffer())).not.toContain("{{");
  });

  it("generates all three DOCX files with the shared project and no partial archive", async () => {
    const documents = await buildDocuments();
    const ids = Object.keys(documents) as DocumentId[];
    const response = await POST(requestFor(ids.map((id) => ({ id, data: documents[id] }))));
    const archive = Buffer.from(await response.arrayBuffer());
    const entries = archiveEntries(archive);
    const projectName = documents["official-estimate-order"].projectName;

    expect(response.status).toBe(200);
    expect(response.headers.get("x-linyvets-document-count")).toBe("3");
    expect(entries).toHaveLength(3);
    expect(new Set(entries).size).toBe(3);
    expect(entries.join(" ")).toContain("nakaz");
    expect(entries.join(" ")).toContain("rozrakhunok-tehnichnoho-nahliadu");
    expect(entries.join(" ")).toContain("dogovir-tehnichnoho-nahliadu");
    for (const entry of entries) {
      const xml = documentXml(new PizZip(archive).file(entry)!.asNodeBuffer()).replaceAll("&quot;", '"');
      expect(xml).toContain(projectName);
      expect(xml).not.toContain("{{");
    }
  });

  it.each(customerSignatories)("uses the selected %s signatory in every ZIP document", async (signatory) => {
    const documents = await buildDocuments();
    const contract = {
      ...documents["technical-supervision-contract"],
      customerSignatoryId: signatory.id,
      customerSignatureTitle: signatory.position,
      customerSignature: signatory.displayName,
      customerRepresentative: signatory.fullName ?? "Ручне повне ім’я підписанта",
      customerLegalBasis: signatory.authorizationBasis ?? "Окрема підстава повноважень",
    };
    const requestDocuments = [
      {
        id: "official-estimate-order" as const,
        data: {
          ...documents["official-estimate-order"],
          customerSignatoryId: signatory.id,
          customerSignatureTitle: signatory.position,
          customerSignature: signatory.displayName,
        },
      },
      {
        id: "technical-supervision-calculation" as const,
        data: {
          ...documents["technical-supervision-calculation"],
          customerSignatoryId: signatory.id,
          customerSignatureTitle: signatory.position,
          customerDirector: signatory.displayName,
        },
      },
      { id: "technical-supervision-contract" as const, data: contract },
    ];
    const response = await POST(requestFor(requestDocuments));
    const archive = Buffer.from(await response.arrayBuffer());
    const entries = archiveEntries(archive);

    expect(response.status).toBe(200);
    expect(entries).toHaveLength(3);
    for (const entry of entries) {
      const xml = documentXml(new PizZip(archive).file(entry)!.asNodeBuffer()).replaceAll("&quot;", '"');
      expect(xml).toContain(signatory.position);
      expect(xml).toContain(signatory.displayName);
    }
  });

  it.each(["probudkontrol", "ik-zahid", "fop-shevchuk", "fop-kras"] as const)("generates a contract ZIP for %s without certificate leakage", async (contractorProfileId) => {
    const parsed = await parseAvk5Estimate(readFileSync(sourcePath));
    const context = createEstimateContext(parsed, "67_КД_ЗКР.rtf");
    const contract = buildTechnicalSupervisionContractDefaults(context, { contractorProfileId });
    const response = await POST(requestFor([{ id: "technical-supervision-contract", data: contract }]));
    const archive = Buffer.from(await response.arrayBuffer());
    const entries = archiveEntries(archive);
    const xml = documentXml(new PizZip(archive).file(entries[0])!.asNodeBuffer()).replaceAll("&quot;", '"');

    expect(response.status).toBe(200);
    expect(entries).toHaveLength(1);
    expect(xml).toContain(contract.contractorName);
    expect(xml).toContain(contract.contractEndDate);
    if (contract.contractorCertificate) expect(xml).toContain(contract.contractorCertificate);
    expect(xml).not.toContain("та , з другої сторони");
    expect(xml).not.toContain("{{");
  });

  it("reports per-document validation errors and does not return a partial ZIP", async () => {
    const documents = await buildDocuments();
    const response = await POST(requestFor([
      { id: "official-estimate-order", data: documents["official-estimate-order"] },
      { id: "technical-supervision-contract", data: { ...documents["technical-supervision-contract"], contractorName: "" } },
    ]));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BATCH_VALIDATION_FAILED");
    expect(body.error.documents).toHaveLength(1);
    expect(body.error.documents[0].id).toBe("technical-supervision-contract");
    expect(body.error.documents[0].fields.some((field: { field: string }) => field.field === "contractorName")).toBe(true);
  });
});
