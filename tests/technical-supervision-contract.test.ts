import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";

import { parseAvk5Estimate } from "@/lib/avk5-parser";
import { createEstimateContext } from "@/lib/documents/estimate-context";
import { buildTechnicalSupervisionContractDefaults, buildTechnicalSupervisionContractTemplateValues, emptyTechnicalSupervisionContractValues, suggestedContractEndDate } from "@/lib/technical-supervision-contract";
import { loadTechnicalSupervisionContractTemplate } from "@/lib/technical-supervision-contract-template";
import { contractPreviewSections } from "@/lib/technical-supervision-contract-content";

describe("technical supervision contract", () => {
  it("maps the full project name, Phase 2 calculation, and configured party profiles", async () => {
    const parsed = await parseAvk5Estimate(readFileSync(resolve(process.cwd(), "reference/67_КД_ЗКР.rtf")));
    const context = createEstimateContext(parsed, "67_КД_ЗКР.rtf");
    const defaults = buildTechnicalSupervisionContractDefaults(context);

    expect(defaults.projectName).toBe("Поточний ремонт зупинки громадського транспорту \"Мостозагін\", що на вул.Ківерцівська,біля будинку 9б (непарна сторона) в місті Луцьку Волинської області");
    expect(defaults.calculationRatePercent).toBe("1,1");
    expect(defaults.supervisionAmountUah).toBe("1 948,49");
    expect(defaults.supervisionAmountInWords).toBe("Одна тисяча дев’ятсот сорок вісім грн 49 коп.");
    expect(defaults.customerDetails).toContain("Департамент житлово-комунального господарства Луцької міської ради");
    expect(defaults.customerDetails).toContain("р/р №");
    expect(defaults.contractorDetails).toContain("ФОП Шевчук Ігор Вікторович");
    expect(defaults.contractorDetails).toContain("UA113033980000026009500700621");
    expect(defaults.contractorCertificate).toBe("");
    expect(defaults.customerLegalBasis).toBe("Положення про департамент, затверджене рішенням Луцької міської ради від 29.06.2017 № 26/12");
    expect(defaults.contractEndDate).toBe("31.12.2026");
    expect(defaults.appendixReference).toBe("Розрахунок кошторисної вартості технічного нагляду");
  });

  it("offers the historical end date only for a 2026 contract context", () => {
    expect(suggestedContractEndDate(new Date("2026-01-01T00:00:00.000Z"))).toBe("31.12.2026");
    expect(suggestedContractEndDate(new Date("2027-01-01T00:00:00.000Z"))).toBe("");
  });

  it("recomputes the amount and keeps repeated fields synchronized", () => {
    const values = {
      ...emptyTechnicalSupervisionContractValues,
      projectName: "Об’єкт",
      chapters1To9TotalUah: "177 135,00",
      calculationRatePercent: "1,5",
      contractNumber: "01/26",
      documentDate: "12 травня 2026",
      contractEndDate: "31.12.2026",
      customerName: "Замовник",
      customerRepresentative: "Представник",
      customerLegalBasis: "Статут",
      contractorName: "Виконавець",
      contractorRegistrationDetails: "Реєстраційні дані",
      contractorCertificate: "АТ № 000000",
      customerTaxStatus: "не є платником податку",
      contractorTaxStatus: "є платником Єдиного податку 5%",
      customerDetails: "Реквізити замовника",
      customerSignatureTitle: "Директор",
      customerSignature: "Підпис замовника",
      contractorDetails: "Реквізити виконавця",
      contractorSignatureTitle: "ФОП",
      contractorSignature: "Підпис виконавця",
    };
    const templateValues = buildTechnicalSupervisionContractTemplateValues(values);

    expect(templateValues.supervisionAmountUah).toBe("2 657,03");
    expect(templateValues.supervisionAmountInWords).toBe("Дві тисячі шістсот п’ятдесят сім грн 03 коп.");
    expect(templateValues.chapters1To9TotalUah).toBe("177 135,00");
    expect(templateValues.contractNumber).toBe("01/26");
    expect(templateValues.contractorSignature).toBe("Підпис виконавця");
  });

  it("keeps the five-page converted template structurally intact and free of historical party data", async () => {
    const zip = new PizZip(await loadTechnicalSupervisionContractTemplate());
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    const documentRels = zip.file("word/_rels/document.xml.rels")?.asText() ?? "";
    const placeholders = [...xml.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1]).sort();

    expect(placeholders).toEqual([
      "appendixReference", "calculationRatePercent", "chapters1To9TotalUah", "contractEndDate", "contractNumber", "contractorCertificate", "contractorDetails", "contractorName", "contractorRegistrationDetails", "contractorSignature", "contractorSignatureTitle", "contractorTaxStatus", "customerDetails", "customerLegalBasis", "customerName", "customerRepresentative", "customerSignature", "customerSignatureTitle", "customerTaxStatus", "documentDate", "projectName", "supervisionAmountInWords", "supervisionAmountUah",
    ]);
    expect(xml).toContain("<w:tbl");
    expect(xml).toContain("w:pgMar");
    expect(xml).toContain("1. Визначення окремих термінів договору.");
    expect(xml).toContain("12. Юридичні адреси, банківські реквізити і підписи Сторін");
    expect(xml).not.toContain("Шевчук");
    expect(xml).not.toContain("Ліщук");
    expect(xml).not.toContain("UA113033980000026009500700621");
    expect(documentRels).toContain("relationships");
  });

  it("keeps all 12 reference sections and full standard clauses available to the preview", () => {
    expect(contractPreviewSections).toHaveLength(11);
    expect(contractPreviewSections.map((section) => section.heading)).toEqual([
      "1. Визначення окремих термінів договору.",
      "2. Предмет договору.",
      "3. Ціна договору і порядок розрахунків.",
      "4. Термін виконання робіт.",
      "5. Права і обов’язки Виконавця.",
      "6. Права і обов’язки Замовника.",
      "7. Приймання виконання технічного нагляду.",
      "8. Порядок розв’язання спорів.",
      "9. Форс-мажорні обставини.",
      "10. Призупинення робіт і розірвання Договору.",
      "11. Інші умови.",
    ]);
    const text = contractPreviewSections.flatMap((section) => section.paragraphs).join("\n");
    expect(text).toContain("5.1. Виконавець зобов`язаний:");
    expect(text).toContain("6.1. Замовник зобов’язаний:");
    expect(text).toContain("9.5. Ненадходження коштів з державного бюджету");
    expect(text).toContain("10.4. Сторона, з вини якої призупиняються роботи");
    expect(text).toContain("11.6. Замовник своїм підписом підтверджує");
  });
});
