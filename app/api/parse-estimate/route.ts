import { NextResponse } from "next/server";

import { Avk5ParseError, parseAvk5Estimate } from "@/lib/avk5-parser";
import {
  RtfUploadValidationError,
  validateRtfUpload,
} from "@/lib/upload-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store" };

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

function errorResponse(status: number, code: string, message: string) {
  const body: ErrorResponse = { error: { code, message } };
  return NextResponse.json(body, { status, headers: noStoreHeaders });
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")) {
      return errorResponse(400, "FILE_REQUIRED", "Додайте RTF-файл кошторису.");
    }

    const formData = await request.formData();
    const entry = formData.get("file");

    if (!(entry instanceof File)) {
      return errorResponse(400, "FILE_REQUIRED", "Додайте RTF-файл кошторису.");
    }

    const bytes = Buffer.from(await entry.arrayBuffer());
    validateRtfUpload(entry.name, bytes);
    const result = await parseAvk5Estimate(bytes);

    return NextResponse.json({ result }, { status: 200, headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof RtfUploadValidationError) {
      const status = error.code === "FILE_TOO_LARGE" ? 413 : 400;
      return errorResponse(status, error.code, error.message);
    }

    if (error instanceof Avk5ParseError) {
      return errorResponse(422, error.code, "Не вдалося прочитати RTF-кошторис. Перевірте файл і спробуйте ще раз.");
    }

    return errorResponse(400, "INVALID_UPLOAD", "Не вдалося обробити завантаження. Перевірте файл і спробуйте ще раз.");
  }
}
