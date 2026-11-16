import { z } from "zod";

import { safeOrderFilename } from "@/lib/safe-filename";
import type { DocumentId } from "@/lib/documents/types";

export const batchDocumentIdSchema = z.enum([
  "official-estimate-order",
  "technical-supervision-calculation",
  "technical-supervision-contract",
]);

export const batchGenerationRequestSchema = z.object({
  documents: z
    .array(
      z.object({
        id: batchDocumentIdSchema,
        data: z.unknown(),
      }),
    )
    .min(1, "Оберіть щонайменше один документ")
    .max(3, "Можна сформувати не більше трьох документів за раз")
    .superRefine((documents, context) => {
      const ids = documents.map((document) => document.id);
      if (new Set(ids).size !== ids.length) {
        context.addIssue({
          code: "custom",
          message: "Документи не повинні повторюватися",
          path: ["documents"],
        });
      }
    }),
});

export type BatchGenerationRequest = z.infer<typeof batchGenerationRequestSchema>;

export type BatchValidationError = {
  id: DocumentId;
  name: string;
  fields: Array<{ field: string; message: string }>;
};

const filenameSuffixes: Record<DocumentId, string> = {
  "official-estimate-order": "nakaz",
  "technical-supervision-calculation": "rozrakhunok-tehnichnoho-nahliadu",
  "technical-supervision-contract": "dogovir-tehnichnoho-nahliadu",
};

export function batchDocumentFilename(projectName: string, id: DocumentId, usedNames = new Set<string>()): string {
  const baseName = safeOrderFilename(projectName).replace(/\.docx$/i, "") || "avk-5";
  const rootName = `${baseName}-${filenameSuffixes[id]}`;
  let filename = `${rootName}.docx`;
  let suffix = 2;

  while (usedNames.has(filename)) {
    filename = `${rootName}-${suffix}.docx`;
    suffix += 1;
  }

  usedNames.add(filename);
  return filename;
}

export function batchZipFilename(projectName: string): string {
  const baseName = safeOrderFilename(projectName).replace(/\.docx$/i, "") || "avk-5";
  return `${baseName}-dokumenty.zip`;
}
