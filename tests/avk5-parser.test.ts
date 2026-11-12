import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAvk5Estimate } from "@/lib/avk5-parser";

const fixturePath = resolve(process.cwd(), "reference/6_КД_ЗКР.rtf");

describe("parseAvk5Estimate", () => {
  it("extracts exact values and evidence from the real CP1251 fixture", async () => {
    const result = await parseAvk5Estimate(readFileSync(fixturePath));

    expect(result.data.projectName).toBe("Поточний ремонт проїзду до будинку №19б на вулиці Кравчука до вулиці Конякіна в місті Луцьку Волинської області");
    expect(result.data.finalEstimatedTotalThousandsUah).toBe(197.271);
    expect(result.data.finalEstimatedTotalThousandsUahText).toBe("197,271");
    expect(result.data.projectOrganization).toBeNull();
    expect(result.data.chiefProjectEngineer).toBe("Ігор ШЕВЧУК");

    expect(result.verification).toEqual({
      status: "verified",
      summaryTotalThousandsUah: 197.271,
      estimateTableTotalThousandsUah: 197.271,
      explanatoryTotalThousandsUah: 197.271,
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MISSING_PROJECT_ORGANIZATION" }),
    ]));
    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ section: "project-name", matchedText: expect.stringContaining("Поточний ремонт") }),
      expect.objectContaining({ section: "approval-summary", matchedText: expect.stringContaining("197,271") }),
      expect.objectContaining({ section: "estimate-table", matchedText: "197,271" }),
      expect.objectContaining({ section: "chief-engineer", matchedText: expect.stringContaining("Ігор ШЕВЧУК") }),
    ]));
  });

  it("returns a clear error for non-RTF input", async () => {
    await expect(parseAvk5Estimate(Buffer.from("not an RTF document"))).rejects.toMatchObject({
      name: "Avk5ParseError",
      code: "INVALID_RTF",
    });
  });
});
