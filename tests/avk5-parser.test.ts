import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAvk5Estimate } from "@/lib/avk5-parser";

const fixturePath = resolve(process.cwd(), "reference/6_КД_ЗКР.rtf");
const secondFixturePath = resolve(process.cwd(), "reference/10_КД_ЗКР.rtf");
const localFixturePath = resolve(process.cwd(), "reference/8_КД_ЛК1_02-01-01.rtf");

describe("parseAvk5Estimate", () => {
  it("extracts exact values and evidence from the real CP1251 fixture", async () => {
    const result = await parseAvk5Estimate(readFileSync(fixturePath));

    expect(result.extractionStatus).toBe("extracted");
    expect(result.data.documentType).toBe("consolidated-estimate");
    expect(result.data.estimateNumber).toBeNull();
    expect(result.data.projectName).toBe("Поточний ремонт проїзду до будинку №19б на вулиці Кравчука до вулиці Конякіна в місті Луцьку Волинської області");
    expect(result.data.finalEstimatedTotalThousandsUah).toBe(197.271);
    expect(result.data.finalEstimatedTotalThousandsUahText).toBe("197,271");
    expect(result.data.projectOrganization).toBe("Ігор ШЕВЧУК");
    expect(result.data.chiefProjectEngineer).toBe("Ігор ШЕВЧУК");
    expect(result.data.preparedBy).toBe("Ігор ШЕВЧУК");
    expect(result.data.items.length).toBeGreaterThan(1);
    expect(new Set(result.data.items.map((item) => `${item.code}|${item.name}|${item.totalThousandsUah}`)).size).toBe(result.data.items.length);
    expect(result.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "02-01", totalThousandsUah: 131.855, missingFields: ["unit", "quantity", "price"] }),
    ]));
    expect(result.data.itemsTotalThousandsUah).toBe(197.271);

    expect(result.verification).toEqual({
      status: "verified",
      summaryTotalThousandsUah: 197.271,
      estimateTableTotalThousandsUah: 197.271,
      explanatoryTotalThousandsUah: 197.271,
      estimateItemsTotalThousandsUah: 197.271,
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MISSING_PROJECT_ORGANIZATION" }),
    ]));
    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ section: "project-name", matchedText: expect.stringContaining("Поточний ремонт") }),
      expect.objectContaining({ section: "approval-summary", matchedText: expect.stringContaining("197,271") }),
      expect.objectContaining({ section: "estimate-table", matchedText: "197,271" }),
      expect.objectContaining({ section: "chief-engineer", matchedText: expect.stringContaining("Ігор ШЕВЧУК") }),
      expect.objectContaining({ section: "prepared-by", matchedText: expect.stringContaining("Ігор ШЕВЧУК") }),
      expect.objectContaining({ section: "project-organization", matchedText: expect.stringContaining("Ігор ШЕВЧУК") }),
    ]));
  });

  it("keeps the second consolidated fixture separate from the 197.271 source", async () => {
    const result = await parseAvk5Estimate(readFileSync(secondFixturePath));

    expect(result.extractionStatus).toBe("extracted");
    expect(result.data.documentType).toBe("consolidated-estimate");
    expect(result.data.projectName).toBe("Поточний ремонт вулиці Іова Кондзелевича в місті Луцьку Волинської області");
    expect(result.data.finalEstimatedTotalThousandsUah).toBe(215.007);
    expect(result.data.finalEstimatedTotalThousandsUah).not.toBe(result.data.items[0]?.totalThousandsUah);
    expect(result.data.items[0]?.totalThousandsUah).toBe(144.079);
    expect(result.data.preparedBy).toBe("Ігор ШЕВЧУК");
    expect(result.data.projectOrganization).toBe("Ігор ШЕВЧУК");
    expect(result.data.items.length).toBe(8);
    expect(result.data.itemsTotalThousandsUah).toBe(215.007);
    expect(result.verification.status).toBe("verified");
  });

  it("extracts the real local estimate, its four work items, and the local total", async () => {
    const result = await parseAvk5Estimate(readFileSync(localFixturePath));

    expect(result.extractionStatus).toBe("extracted");
    expect(result.data.documentType).toBe("local-estimate");
    expect(result.data.projectName).toBe("Поточний ремонт вулиці Ветеранів в місті Луцьку Волинської області");
    expect(result.data.estimateNumber).toBe("02-01-01");
    expect(result.data.finalEstimatedTotalThousandsUah).toBe(144.079);
    expect(result.data.finalEstimatedTotalThousandsUahText).toBe("144,079");
    expect(result.data.preparedBy).toBe("Ігор ШЕВЧУК");
    expect(result.data.projectOrganization).toBeNull();
    expect(result.data.chiefProjectEngineer).toBeNull();
    expect(result.data.items).toEqual([
      expect.objectContaining({ code: "КР18-4-1", unit: "100м2", quantity: 1.24, price: 29512.49, total: 36595, totalUnit: "uah", totalThousandsUah: 36.595 }),
      expect.objectContaining({ code: "С311-10-М", unit: "т", quantity: 12, price: 166.01, total: 1992, totalUnit: "uah", totalThousandsUah: 1.992 }),
      expect.objectContaining({ code: "КР18-42-5", unit: "100м2", quantity: 1.24, price: 60537.04, total: 75066, totalUnit: "uah", totalThousandsUah: 75.066 }),
      expect.objectContaining({ code: "КР18-42-6", unit: "100м2", quantity: 1.24, price: 13973.29, total: 17327, totalUnit: "uah", totalThousandsUah: 17.327 }),
    ]);
    expect(result.data.items.map((item) => item.name)).toEqual([
      "Знімання асфальтобетонних покриттів доріг за допомогою машин для холодного фрезерування асфальтобетонних покриттів окремими місцями площею до 10 м2 шириною фрезерування 500 мм та глибиною фрезерування 50 мм [на однiй половинi проїжджої частини при систематичному русi транспорту на другiй]",
      "Перевезення крихти від фрезерування до 10 км",
      "Розлив бітумної емульсії в кількості 0,6 л/м2 та улаштування покриття товщиною 4 см з гарячої щільної дрібнозернистої асфальтобетонної суміші тип Б марка 1 вручну з ущільненням самохідними котками [на однiй половинi проїжджої частини при систематичному русi транспорту на другiй]",
      "На кожні 0,5 см зміни товщини шару додавати або виключати до норми 18-42-5 до товщ. 5 см [на однiй половинi проїжджої частини при систематичному русi транспорту на другiй]",
    ]);
    expect(result.data.itemsTotalThousandsUah).toBe(130.98);
    expect(result.verification).toEqual({
      status: "verified",
      summaryTotalThousandsUah: null,
      estimateTableTotalThousandsUah: 144.079,
      explanatoryTotalThousandsUah: null,
      estimateItemsTotalThousandsUah: 130.98,
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MISSING_PROJECT_ORGANIZATION" }),
      expect.objectContaining({ code: "MISSING_CHIEF_PROJECT_ENGINEER" }),
    ]));
    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ section: "project-name", matchedText: "Поточний ремонт вулиці Ветеранів в місті Луцьку Волинської області" }),
      expect.objectContaining({ section: "final-total", matchedText: expect.stringContaining("144,079") }),
      expect.objectContaining({ section: "estimate-table", matchedText: expect.stringContaining("144079") }),
      expect.objectContaining({ section: "prepared-by", matchedText: expect.stringContaining("Ігор ШЕВЧУК") }),
    ]));
  });

  it("returns a clear error for non-RTF input", async () => {
    await expect(parseAvk5Estimate(Buffer.from("not an RTF document"))).rejects.toMatchObject({
      name: "Avk5ParseError",
      code: "INVALID_RTF",
    });
  });

  it("does not select an ambiguous final total when labeled totals disagree", async () => {
    const source = readFileSync(localFixturePath);
    const conflicting = Buffer.from(source);
    const headerTotal = Buffer.from("144,079", "latin1");
    const headerIndex = conflicting.indexOf(headerTotal);
    expect(headerIndex).toBeGreaterThanOrEqual(0);
    conflicting.set(Buffer.from("145,079", "latin1"), headerIndex);

    const result = await parseAvk5Estimate(conflicting);

    expect(result.data.finalEstimatedTotalThousandsUah).toBeNull();
    expect(result.data.finalEstimatedTotalThousandsUahText).toBeNull();
    expect(result.extractionStatus).toBe("partial");
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "INCONSISTENT_TOTALS" }),
    ]));
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "AMBIGUOUS_FINAL_TOTAL" }),
    ]));
  });

  it("distinguishes decoded but unsupported RTF from a parser failure", async () => {
    const result = await parseAvk5Estimate("{\\rtf1\\ansi\\uc1 Plain text\\par}");

    expect(result.extractionStatus).toBe("unsupported");
    expect(result.data.documentType).toBe("unknown");
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "UNSUPPORTED_DOCUMENT_TYPE" }),
    ]));
  });
});
