import { NextResponse } from "next/server";

import {
  createTechnicalSupervisionCalculationDocx,
  TechnicalSupervisionCalculationTemplateError,
} from "@/lib/technical-supervision-calculation-template";
import { technicalSupervisionCalculationSchema } from "@/lib/technical-supervision-calculation";
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

  const parsed = technicalSupervisionCalculationSchema.safeParse(normalizeProfilePayload(payload));
  if (!parsed.success) {
    return errorResponse(400, "INVALID_TECHNICAL_SUPERVISION_DATA", "Підтвердіть усі обов’язкові реквізити розрахунку.");
  }

  try {
    const document = await createTechnicalSupervisionCalculationDocx(parsed.data);
    const baseName = safeOrderFilename(parsed.data.projectName).replace(/\.docx$/i, "");
    const filename = `${baseName}-rozrakhunok-tehnichnoho-nahliadu.docx`;

    return new Response(new Blob([document as unknown as BlobPart], { type: docxContentType }), {
      status: 200,
      headers: {
        ...noStoreHeaders,
        "Content-Type": docxContentType,
        "Content-Disposition": `attachment; filename="technical-supervision-calculation.docx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof TechnicalSupervisionCalculationTemplateError) {
      return errorResponse(500, "DOCX_GENERATION_FAILED", "Не вдалося сформувати розрахунок технічного нагляду. Спробуйте ще раз.");
    }
    return errorResponse(500, "DOCX_GENERATION_FAILED", "Не вдалося сформувати розрахунок технічного нагляду. Спробуйте ще раз.");
  }
}

