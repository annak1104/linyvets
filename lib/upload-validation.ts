// Keep the body below the common Vercel Functions request limit while leaving
// enough room for large AVK-5 RTF estimates.
export const MAX_RTF_FILE_SIZE_BYTES = 4 * 1024 * 1024;

export type RtfUploadValidationCode =
  | "UNSUPPORTED_EXTENSION"
  | "FILE_TOO_LARGE"
  | "EMPTY_FILE"
  | "INVALID_RTF_CONTENT";

export class RtfUploadValidationError extends Error {
  readonly code: RtfUploadValidationCode;

  constructor(code: RtfUploadValidationCode, message: string) {
    super(message);
    this.name = "RtfUploadValidationError";
    this.code = code;
  }
}

function hasValidRtfHeader(bytes: Buffer): boolean {
  const header = bytes.subarray(0, 128).toString("latin1");
  return /^\s*\{\\rtf\d(?:\s|\\|\{)/.test(header);
}

function hasBalancedRtfGroups(bytes: Buffer): boolean {
  let depth = 0;
  let hasRootGroup = false;

  for (let index = 0; index < bytes.length; index += 1) {
    const current = bytes[index];

    if (current === 0x5c) {
      index += 1;
      continue;
    }

    if (current === 0x7b) {
      depth += 1;
      hasRootGroup = true;
    } else if (current === 0x7d) {
      depth -= 1;
      if (depth < 0) return false;
    }
  }

  return hasRootGroup && depth === 0;
}

export function validateRtfUpload(fileName: string, bytes: Buffer): void {
  if (!/\.rtf$/i.test(fileName)) {
    throw new RtfUploadValidationError(
      "UNSUPPORTED_EXTENSION",
      "Підтримуються лише файли з розширенням .rtf.",
    );
  }

  if (bytes.length === 0) {
    throw new RtfUploadValidationError("EMPTY_FILE", "Файл порожній. Оберіть інший RTF-кошторис.");
  }

  if (bytes.length > MAX_RTF_FILE_SIZE_BYTES) {
    throw new RtfUploadValidationError(
      "FILE_TOO_LARGE",
      "Файл завеликий. Максимальний розмір RTF-файлу — 4 МБ.",
    );
  }

  if (!hasValidRtfHeader(bytes) || !hasBalancedRtfGroups(bytes)) {
    throw new RtfUploadValidationError(
      "INVALID_RTF_CONTENT",
      "Файл не схожий на коректний RTF-документ або пошкоджений.",
    );
  }
}
