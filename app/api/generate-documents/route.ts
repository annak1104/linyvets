import { NextResponse } from "next/server";
import PizZip from "pizzip";

import { createOfficialOrderDocx, OfficialOrderTemplateError } from "@/lib/official-order-template";
import { orderSchema, type OrderForm } from "@/lib/order-form";
import {
  batchDocumentFilename,
  batchGenerationRequestSchema,
  batchZipFilename,
  type BatchValidationError,
} from "@/lib/batch-generation";
import {
  createTechnicalSupervisionCalculationDocx,
  TechnicalSupervisionCalculationTemplateError,
} from "@/lib/technical-supervision-calculation-template";
import {
  technicalSupervisionCalculationSchema,
  type TechnicalSupervisionCalculationForm,
} from "@/lib/technical-supervision-calculation";
import {
  createTechnicalSupervisionContractDocx,
  TechnicalSupervisionContractTemplateError,
} from "@/lib/technical-supervision-contract-template";
import {
  technicalSupervisionContractSchema,
  type TechnicalSupervisionContractForm,
} from "@/lib/technical-supervision-contract";
import { normalizeProfilePayload } from "@/lib/party-profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const zipContentType = "application/zip";
const noStoreHeaders = { "Cache-Control": "no-store" };

const documentNames = {
  "official-estimate-order": "Наказ про затвердження кошторису",
  "technical-supervision-calculation": "Розрахунок вартості технічного нагляду",
  "technical-supervision-contract": "Договір технічного нагляду",
} as const;

type ValidatedDocument =
  | { id: "official-estimate-order"; data: OrderForm }
  | { id: "technical-supervision-calculation"; data: TechnicalSupervisionCalculationForm }
  | { id: "technical-supervision-contract"; data: TechnicalSupervisionContractForm };

function errorResponse(status: number, code: string, message: string, documents?: BatchValidationError[]) {
  return NextResponse.json(
    { error: { code, message, ...(documents ? { documents } : {}) } },
    { status, headers: noStoreHeaders },
  );
}

function validationError(id: ValidatedDocument["id"], error: { issues: Array<{ path: PropertyKey[]; message: string }> }): BatchValidationError {
  return {
    id,
    name: documentNames[id],
    fields: error.issues.map((issue) => ({
      field: issue.path.map(String).join(".") || "document",
      message: issue.message,
    })),
  };
}

function validateDocument(document: { id: ValidatedDocument["id"]; data: unknown }):
  | { success: true; document: ValidatedDocument }
  | { success: false; error: BatchValidationError } {
  if (document.id === "official-estimate-order") {
    const parsed = orderSchema.safeParse(document.data);
    return parsed.success
      ? { success: true, document: { id: document.id, data: parsed.data } }
      : { success: false, error: validationError(document.id, parsed.error) };
  }

  if (document.id === "technical-supervision-calculation") {
    const parsed = technicalSupervisionCalculationSchema.safeParse(normalizeProfilePayload(document.data));
    return parsed.success
      ? { success: true, document: { id: document.id, data: parsed.data } }
      : { success: false, error: validationError(document.id, parsed.error) };
  }

  const parsed = technicalSupervisionContractSchema.safeParse(normalizeProfilePayload(document.data));
  return parsed.success
    ? { success: true, document: { id: document.id, data: parsed.data } }
    : { success: false, error: validationError(document.id, parsed.error) };
}

function projectNameOf(document: ValidatedDocument): string {
  return document.data.projectName;
}

async function generateDocument(document: ValidatedDocument): Promise<Buffer> {
  if (document.id === "official-estimate-order") return createOfficialOrderDocx(document.data);
  if (document.id === "technical-supervision-calculation") return createTechnicalSupervisionCalculationDocx(document.data);
  return createTechnicalSupervisionContractDocx(document.data);
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Не вдалося прочитати дані форми.");
  }

  const requestData = batchGenerationRequestSchema.safeParse(payload);
  if (!requestData.success) {
    return errorResponse(400, "INVALID_BATCH_DATA", "Перевірте список вибраних документів.");
  }

  const validationResults = requestData.data.documents.map(validateDocument);
  const validationErrors = validationResults.flatMap((result) => result.success ? [] : [result.error]);
  if (validationErrors.length > 0) {
    return errorResponse(
      400,
      "BATCH_VALIDATION_FAILED",
      "Підтвердіть обов’язкові реквізити для кожного вибраного документа.",
      validationErrors,
    );
  }

  const documents = validationResults.flatMap((result) => result.success ? [result.document] : []) as ValidatedDocument[];
  const usedNames = new Set<string>();

  try {
    const archive = new PizZip();
    const generatedFiles = await Promise.all(documents.map(async (document) => ({
      filename: batchDocumentFilename(projectNameOf(document), document.id, usedNames),
      content: await generateDocument(document),
    })));

    for (const file of generatedFiles) archive.file(file.filename, file.content);

    const zip = archive.generate({ type: "nodebuffer", compression: "DEFLATE" });
    const filename = batchZipFilename(projectNameOf(documents[0]));

    return new Response(new Blob([zip as unknown as BlobPart], { type: zipContentType }), {
      status: 200,
      headers: {
        ...noStoreHeaders,
        "Content-Type": zipContentType,
        "Content-Disposition": `attachment; filename="linyvets-documents.zip"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "X-Content-Type-Options": "nosniff",
        "X-Linyvets-Document-Count": String(generatedFiles.length),
      },
    });
  } catch (error) {
    if (error instanceof OfficialOrderTemplateError || error instanceof TechnicalSupervisionCalculationTemplateError || error instanceof TechnicalSupervisionContractTemplateError) {
      return errorResponse(500, "BATCH_GENERATION_FAILED", "Не вдалося сформувати всі вибрані документи. Жоден ZIP не створено.");
    }
    return errorResponse(500, "BATCH_GENERATION_FAILED", "Не вдалося сформувати всі вибрані документи. Жоден ZIP не створено.");
  }
}
