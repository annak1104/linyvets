import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";

import { parseAvk5Estimate } from "@/lib/avk5-parser";
import { createEstimateContext } from "@/lib/documents/estimate-context";
import { customerSignatories } from "@/lib/party-profiles";
import {
  buildTechnicalSupervisionCalculationDefaults,
  buildTechnicalSupervisionCalculationTemplateValues,
  calculateSupervisionAmountKopecks,
  formatUahKopecks,
  supervisionAmountInWords,
} from "@/lib/technical-supervision-calculation";
import { loadTechnicalSupervisionCalculationTemplate } from "@/lib/technical-supervision-calculation-template";

describe("technical supervision calculation", () => {
  it("calculates 1.1% with kopeck-safe rounding", () => {
    const amount = calculateSupervisionAmountKopecks("177 135,00", "1,1");

    expect(formatUahKopecks(amount)).toBe("1 948,49");
    expect(supervisionAmountInWords(amount)).toBe("Одна тисяча дев’ятсот сорок вісім грн 49 коп.");
  });

  it("maps the real 67 AVK-5 estimate without using its 1.5% allowance as the calculation rate", async () => {
    const parsed = await parseAvk5Estimate(readFileSync(resolve(process.cwd(), "reference/67_КД_ЗКР.rtf")));
    const context = createEstimateContext(parsed, "67_КД_ЗКР.rtf");
    const defaults = buildTechnicalSupervisionCalculationDefaults(context);

    expect(context.totals.consolidated.value?.amountThousandsUah).toBe(264.325);
    expect(context.totals.chapters1To9.value?.amountThousandsUah).toBe(177.135);
    expect(context.totals.sourceSupervisionRate.value?.value).toBe(1.5);
    expect(context.totals.sourceSupervisionAllowance.value?.amountThousandsUah).toBe(2.657);
    expect(defaults.calculationRatePercent).toBe("1,1");
    expect(defaults.consolidatedTotalUah).toBe("264 325,00");
    expect(defaults.chapters1To9TotalUah).toBe("177 135,00");
    expect(defaults.supervisionAmountUah).toBe("1 948,49");
  });

  it("keeps the converted template editable and free of reference-specific values", async () => {
    const template = new PizZip(await loadTechnicalSupervisionCalculationTemplate());
    const xml = template.file("word/document.xml")?.asText() ?? "";
    const styles = template.file("word/styles.xml")?.asText() ?? "";

    expect(xml).toContain("{{projectName}}");
    expect(xml).toContain("{{customerDetails}}");
    expect(xml).toContain("{{contractorDetails}}");
    expect(xml).not.toContain("Мостозагін");
    expect(xml).not.toContain("Шевчук");
    expect(xml).not.toContain("264 325,00");
    expect(xml).toContain('w:gridSpan w:val="3"');
    expect(xml).toContain('w:vMerge w:val="restart"');
    expect(xml).toContain('w:vMerge w:val="continue"');
    expect(xml).toContain("Вартість робіт");
    expect(xml).toContain("1");
    expect(xml).toContain("4");
    expect(xml).toContain("{{customerDirector}}");
    expect(xml).toContain("{{customerSignatureTitle}}");
    expect(xml).toContain("{{contractorSignature}}");
    expect(styles).toContain("w:styles");
  });

  it("maps every approved customer signatory to the calculation preview values", async () => {
    const parsed = await parseAvk5Estimate(readFileSync(resolve(process.cwd(), "reference/67_КД_ЗКР.rtf")));
    const context = createEstimateContext(parsed, "67_КД_ЗКР.rtf");

    for (const signatory of customerSignatories) {
      const values = buildTechnicalSupervisionCalculationDefaults(context, signatory.id);
      const templateValues = buildTechnicalSupervisionCalculationTemplateValues(values);
      expect(values.customerSignatoryId).toBe(signatory.id);
      expect(values.customerSignatureTitle).toBe(signatory.position);
      expect(values.customerDirector).toBe(signatory.displayName);
      expect(templateValues.customerSignatureTitle).toBe(signatory.position);
      expect(templateValues.customerDirector).toBe(signatory.displayName);
    }
  });

  it("recomputes derived values when the editable rate changes", async () => {
    const parsed = await parseAvk5Estimate(readFileSync(resolve(process.cwd(), "reference/67_КД_ЗКР.rtf")));
    const context = createEstimateContext(parsed, "67_КД_ЗКР.rtf");
    const defaults = buildTechnicalSupervisionCalculationDefaults(context);
    const values = buildTechnicalSupervisionCalculationTemplateValues({ ...defaults, calculationRatePercent: "1,5" });

    expect(values.supervisionAmountUah).toBe("2 657,03");
    expect(values.supervisionAmountInWords).toBe("Дві тисячі шістсот п’ятдесят сім грн 03 коп.");
    expect(values.chapters1To9Expression).toBe("177 135,00 х 1,5%");
  });
});

