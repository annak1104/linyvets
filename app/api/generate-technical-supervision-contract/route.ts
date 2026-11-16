import { NextResponse } from "next/server";

import { createTechnicalSupervisionContractDocx, TechnicalSupervisionContractTemplateError } from "@/lib/technical-supervision-contract-template";
import { technicalSupervisionContractSchema } from "@/lib/technical-supervision-contract";
import { safeOrderFilename } from "@/lib/safe-filename";
import { normalizeProfilePayload } from "@/lib/party-profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const docxContentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const noStoreHeaders = { "Cache-Control": "no-store" };

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: noStoreHeaders });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Не вдалося прочитати дані форми.");
  }

  const parsed = technicalSupervisionContractSchema.safeParse(normalizeProfilePayload(payload));
  if (!parsed.success) return errorResponse(400, "INVALID_TECHNICAL_SUPERVISION_CONTRACT_DATA", "Підтвердіть усі обов’язкові реквізити договору перед формуванням DOCX.");

  try {
    const document = await createTechnicalSupervisionContractDocx(parsed.data);
    const baseName = safeOrderFilename(parsed.data.projectName).replace(/\.docx$/i, "");
    const filename = `${baseName}-dogovir-tekhnichnoho-nahliadu.docx`;

    return new Response(new Blob([document as unknown as BlobPart], { type: docxContentType }), {
      status: 200,
      headers: {
        ...noStoreHeaders,
        "Content-Type": docxContentType,
        "Content-Disposition": `attachment; filename="technical-supervision-contract.docx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof TechnicalSupervisionContractTemplateError) return errorResponse(500, "DOCX_GENERATION_FAILED", "Не вдалося сформувати договір технічного нагляду. Спробуйте ще раз.");
    return errorResponse(500, "DOCX_GENERATION_FAILED", "Не вдалося сформувати договір технічного нагляду. Спробуйте ще раз.");
  }
}
