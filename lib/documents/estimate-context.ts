import type { Avk5Evidence, Avk5ParseResult } from "@/lib/avk5-parser";
import type { EstimateContext, EstimateField, NormalizedMoney, NormalizedPercentage } from "@/lib/documents/types";

function field<T>(value: T | null | undefined, evidence: Avk5Evidence[], sourceText?: string | null, ambiguous = false): EstimateField<T> {
  return {
    value: value ?? null,
    status: ambiguous ? "ambiguous" : value === null || value === undefined || value === "" ? "missing" : "extracted",
    evidence,
    sourceText: sourceText ?? null,
  };
}

function money(value: number | null | undefined, text: string | null | undefined): NormalizedMoney {
  return {
    amountThousandsUah: value ?? null,
    text: text ?? null,
    unit: "thousands-uah",
  };
}

function percentage(value: number | null | undefined, text: string | null | undefined): NormalizedPercentage {
  return {
    value: value ?? null,
    text: text ?? null,
    unit: "percent",
  };
}

function evidenceFor(result: Avk5ParseResult, ...sections: Avk5Evidence["section"][]): Avk5Evidence[] {
  return result.evidence.filter((item) => sections.includes(item.section));
}

function ambiguous(result: Avk5ParseResult, sections: Avk5Evidence["section"][]): boolean {
  return result.errors.length > 0 && sections.some((section) => result.evidence.some((item) => item.section === section));
}

export function createEstimateContext(result: Avk5ParseResult, fileName: string): EstimateContext {
  const finalEvidence = evidenceFor(result, "final-total", "approval-summary", "estimate-table", "explanatory-summary");
  const consolidatedEvidence = evidenceFor(result, "approval-summary", "estimate-table", "explanatory-summary");
  const chaptersEvidence = evidenceFor(result, "chapters1-to-9-total");
  const supervisionRateEvidence = evidenceFor(result, "source-supervision-rate");
  const supervisionAllowanceEvidence = evidenceFor(result, "source-supervision-allowance");

  return {
    source: {
      fileName,
      format: "rtf",
      documentType: result.data.documentType,
      extractionStatus: result.extractionStatus,
      evidence: result.evidence,
      warnings: result.warnings,
      errors: result.errors,
    },
    project: {
      name: field(result.data.projectName, evidenceFor(result, "project-name"), result.data.projectName),
      estimateNumber: field(result.data.estimateNumber, evidenceFor(result, "estimate-number"), result.data.estimateNumber),
    },
    totals: {
      final: field(
        result.data.finalEstimatedTotalThousandsUah === null
          ? null
          : money(result.data.finalEstimatedTotalThousandsUah, result.data.finalEstimatedTotalThousandsUahText),
        finalEvidence,
        result.data.finalEstimatedTotalThousandsUahText,
        ambiguous(result, ["final-total", "approval-summary", "estimate-table", "explanatory-summary"]),
      ),
      consolidated: field(
        result.verification.summaryTotalThousandsUah === null
          ? null
          : money(result.verification.summaryTotalThousandsUah, result.verification.summaryTotalThousandsUah.toLocaleString("uk-UA", { minimumFractionDigits: 3, maximumFractionDigits: 3 })),
        consolidatedEvidence,
        consolidatedEvidence[0]?.matchedText,
        result.errors.length > 0,
      ),
      chapters1To9: field(
        result.data.chapters1To9TotalThousandsUah === undefined
          ? null
          : money(result.data.chapters1To9TotalThousandsUah, result.data.chapters1To9TotalThousandsUah === null ? null : result.data.chapters1To9TotalThousandsUah.toLocaleString("uk-UA", { minimumFractionDigits: 3, maximumFractionDigits: 3 })),
        chaptersEvidence,
        chaptersEvidence[0]?.matchedText,
      ),
      sourceSupervisionRate: field(
        result.data.sourceSupervisionRatePercent === undefined
          ? null
          : percentage(result.data.sourceSupervisionRatePercent, result.data.sourceSupervisionRatePercent === null ? null : `${result.data.sourceSupervisionRatePercent.toLocaleString("uk-UA")} %`),
        supervisionRateEvidence,
        supervisionRateEvidence[0]?.matchedText,
      ),
      sourceSupervisionAllowance: field(
        result.data.sourceSupervisionAllowanceThousandsUah === undefined
          ? null
          : money(result.data.sourceSupervisionAllowanceThousandsUah, result.data.sourceSupervisionAllowanceThousandsUah === null ? null : result.data.sourceSupervisionAllowanceThousandsUah.toLocaleString("uk-UA", { minimumFractionDigits: 3, maximumFractionDigits: 3 })),
        supervisionAllowanceEvidence,
        supervisionAllowanceEvidence[0]?.matchedText,
      ),
    },
    people: {
      projectOrganizationHead: field(result.data.projectOrganization, evidenceFor(result, "project-organization"), result.data.projectOrganization),
      chiefProjectEngineer: field(result.data.chiefProjectEngineer, evidenceFor(result, "chief-engineer"), result.data.chiefProjectEngineer),
      preparedBy: field(result.data.preparedBy, evidenceFor(result, "prepared-by"), result.data.preparedBy),
    },
  };
}

