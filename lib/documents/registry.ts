import type { DocumentDefinition, DocumentId } from "@/lib/documents/types";

const avk5Types = ["local-estimate", "object-estimate", "consolidated-estimate", "resource-estimate", "unknown"] as const;

export const documentRegistry: readonly DocumentDefinition[] = [
  {
    id: "official-estimate-order",
    name: "Наказ про затвердження кошторису",
    category: "order",
    description: "Документ на основі перевірених реквізитів AVK-5.",
    availability: "available",
    sourceFormats: ["rtf"],
    outputFormats: ["docx"],
    parser: { adapter: "avk5", supportedDocumentTypes: avk5Types },
    requiredFields: ["projectName", "estimatedAmountThousandsUah"],
    optionalFields: ["projectOrganization", "chiefProjectEngineer", "certificate"],
    generation: { enabled: true, adapter: "official-order" },
  },
  {
    id: "technical-supervision-calculation",
    name: "Розрахунок вартості технічного нагляду",
    category: "calculation",
    description: "Підготовка розрахунку технічного нагляду за окремим шаблоном.",
    availability: "available",
    sourceFormats: ["rtf"],
    outputFormats: ["docx"],
    parser: { adapter: "avk5", supportedDocumentTypes: avk5Types },
    requiredFields: ["projectName", "consolidatedTotalThousandsUah", "chapters1To9TotalThousandsUah", "calculationRatePercent", "customerProfile", "contractorProfile", "customerDetails", "customerDirector", "contractorDetails", "contractorSignatureTitle", "contractorSignature"],
    optionalFields: ["sourceSupervisionRate", "sourceSupervisionAllowance", "certificate"],
    generation: { enabled: true, adapter: "technical-supervision-calculation" },
  },
  {
    id: "technical-supervision-contract",
    name: "Договір технічного нагляду",
    category: "contract",
    description: "Договір технічного нагляду з окремими реквізитами сторін.",
    availability: "available",
    sourceFormats: ["rtf"],
    outputFormats: ["docx"],
    parser: { adapter: "avk5", supportedDocumentTypes: avk5Types },
    requiredFields: ["projectName", "chapters1To9TotalThousandsUah", "calculationRatePercent", "customerProfile", "contractorProfile", "customerDetails", "customerDirector", "contractorDetails", "contractorSignatureTitle", "contractorSignature"],
    optionalFields: ["sourceSupervisionRate", "sourceSupervisionAllowance", "certificate"],
    generation: { enabled: true, adapter: "technical-supervision-contract" },
  },
] as const;

export const availableDocumentRegistry = documentRegistry.filter((document) => document.availability === "available");

export const defaultSelectedDocumentIds: DocumentId[] = ["official-estimate-order"];

export function getDocumentDefinition(id: DocumentId): DocumentDefinition {
  const definition = documentRegistry.find((document) => document.id === id);
  if (!definition) throw new Error(`Unknown document id: ${id}`);
  return definition;
}

export function getAvailableDocumentIds(): DocumentId[] {
  return availableDocumentRegistry.map((document) => document.id);
}

