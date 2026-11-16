import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseAvk5Estimate } from "@/lib/avk5-parser";
import { createEstimateContext } from "@/lib/documents/estimate-context";
import { availableDocumentRegistry, defaultSelectedDocumentIds, documentRegistry, getAvailableDocumentIds } from "@/lib/documents/registry";

describe("document registry and normalized estimate context", () => {
  it("registers all planned documents while exposing only implemented generators", () => {
    expect(documentRegistry.map((document) => document.id)).toEqual([
      "official-estimate-order",
      "technical-supervision-calculation",
      "technical-supervision-contract",
    ]);
    expect(getAvailableDocumentIds()).toEqual(["official-estimate-order", "technical-supervision-calculation", "technical-supervision-contract"]);
    expect(defaultSelectedDocumentIds).toEqual(["official-estimate-order"]);
    expect(availableDocumentRegistry.every((document) => document.generation.enabled)).toBe(true);
  });

  it("normalizes one real AVK-5 parse without changing financial semantics", async () => {
    const bytes = readFileSync(resolve(process.cwd(), "reference/6_КД_ЗКР.rtf"));
    const parsed = await parseAvk5Estimate(bytes);
    const context = createEstimateContext(parsed, "6_КД_ЗКР.rtf");

    expect(context.source.documentType).toBe("consolidated-estimate");
    expect(context.project.name.value).toContain("Поточний ремонт проїзду");
    expect(context.totals.final.value).toMatchObject({ amountThousandsUah: 197.271, unit: "thousands-uah" });
    expect(context.totals.consolidated.value?.amountThousandsUah).toBe(197.271);
    expect(context.totals.chapters1To9.value?.amountThousandsUah).toBe(131.855);
    expect(context.totals.sourceSupervisionRate.value?.value).toBe(1.5);
    expect(context.totals.sourceSupervisionAllowance.value?.amountThousandsUah).toBe(1.978);
    expect(context.people.projectOrganizationHead.value).toBe("Ігор ШЕВЧУК");
    expect(context.people.chiefProjectEngineer.value).toBe("Ігор ШЕВЧУК");
    expect(context.totals.chapters1To9.evidence[0]?.label).toBe("Разом по главах 1-9");
    expect(context.source.evidence.length).toBeGreaterThan(0);
  });
});

