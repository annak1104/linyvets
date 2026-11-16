import type {
  Avk5DocumentType,
  Avk5Error,
  Avk5Evidence,
  Avk5ExtractionStatus,
  Avk5Warning,
} from "@/lib/avk5-parser";

export const DOCUMENT_IDS = [
  "official-estimate-order",
  "technical-supervision-calculation",
  "technical-supervision-contract",
] as const;

export type DocumentId = (typeof DOCUMENT_IDS)[number];
export type DocumentCategory = "order" | "calculation" | "contract";
export type DocumentAvailability = "available" | "coming-soon";
export type SourceFormat = "rtf";
export type OutputFormat = "docx";

export type EstimateFieldStatus = "extracted" | "missing" | "ambiguous";

export interface EstimateField<T> {
  value: T | null;
  status: EstimateFieldStatus;
  evidence: Avk5Evidence[];
  sourceText: string | null;
}

export interface NormalizedMoney {
  amountThousandsUah: number | null;
  text: string | null;
  unit: "thousands-uah";
}

export interface NormalizedPercentage {
  value: number | null;
  text: string | null;
  unit: "percent";
}

export interface EstimateContext {
  source: {
    fileName: string;
    format: SourceFormat;
    documentType: Avk5DocumentType;
    extractionStatus: Avk5ExtractionStatus;
    evidence: Avk5Evidence[];
    warnings: Avk5Warning[];
    errors: Avk5Error[];
  };
  project: {
    name: EstimateField<string>;
    estimateNumber: EstimateField<string>;
  };
  totals: {
    final: EstimateField<NormalizedMoney>;
    consolidated: EstimateField<NormalizedMoney>;
    chapters1To9: EstimateField<NormalizedMoney>;
    sourceSupervisionRate: EstimateField<NormalizedPercentage>;
    sourceSupervisionAllowance: EstimateField<NormalizedMoney>;
  };
  people: {
    projectOrganizationHead: EstimateField<string>;
    chiefProjectEngineer: EstimateField<string>;
    preparedBy: EstimateField<string>;
  };
}

export type DocumentFieldId =
  | "projectName"
  | "estimatedAmountThousandsUah"
  | "consolidatedTotalThousandsUah"
  | "chapters1To9TotalThousandsUah"
  | "calculationRatePercent"
  | "sourceSupervisionRate"
  | "sourceSupervisionAllowance"
  | "projectOrganization"
  | "chiefProjectEngineer"
  | "certificate"
  | "contractNumber"
  | "contractDate"
  | "customerProfile"
  | "contractorProfile"
  | "customerDetails"
  | "customerDirector"
  | "contractorDetails"
  | "contractorSignatureTitle"
  | "contractorSignature";

export interface DocumentDefinition {
  id: DocumentId;
  name: string;
  category: DocumentCategory;
  description: string;
  availability: DocumentAvailability;
  sourceFormats: readonly SourceFormat[];
  outputFormats: readonly OutputFormat[];
  parser: {
    adapter: "avk5";
    supportedDocumentTypes: readonly Avk5DocumentType[];
  };
  requiredFields: readonly DocumentFieldId[];
  optionalFields: readonly DocumentFieldId[];
  generation: {
    enabled: boolean;
    adapter: "official-order" | "technical-supervision-calculation" | "technical-supervision-contract";
  };
}
