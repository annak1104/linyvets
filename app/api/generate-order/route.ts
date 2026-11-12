import { NextResponse } from "next/server";

import { createOfficialOrderDocx, OfficialOrderTemplateError } from "@/lib/official-order-template";
import { orderSchema } from "@/lib/order-form";
import { safeOrderFilename } from "@/lib/safe-filename";

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

  const parsed = orderSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResponse(400, "INVALID_ORDER_DATA", "Перевірте обов’язкові поля перед формуванням DOCX.");
  }

  try {
    const document = await createOfficialOrderDocx(parsed.data);
    const filename = safeOrderFilename(parsed.data.projectName);

    return new Response(new Blob([document as unknown as BlobPart], { type: docxContentType }), {
      status: 200,
      headers: {
        ...noStoreHeaders,
        "Content-Type": docxContentType,
        "Content-Disposition": `attachment; filename="avk-5-order.docx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof OfficialOrderTemplateError) {
      return errorResponse(500, "DOCX_GENERATION_FAILED", "Не вдалося сформувати DOCX. Спробуйте ще раз.");
    }

    return errorResponse(500, "DOCX_GENERATION_FAILED", "Не вдалося сформувати DOCX. Спробуйте ще раз.");
  }
}
