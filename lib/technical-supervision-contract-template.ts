import { readFile } from "node:fs/promises";
import path from "node:path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

import { buildTechnicalSupervisionContractTemplateValues, type TechnicalSupervisionContractForm } from "@/lib/technical-supervision-contract";

export const TECHNICAL_SUPERVISION_CONTRACT_TEMPLATE_PATH = path.join(process.cwd(), "templates", "technical-supervision-contract-v1.docx");

export class TechnicalSupervisionContractTemplateError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TechnicalSupervisionContractTemplateError";
  }
}

export function generateTechnicalSupervisionContractDocx(templateBuffer: Buffer, data: TechnicalSupervisionContractForm): Buffer {
  try {
    const zip = new PizZip(templateBuffer);
    const document = new Docxtemplater(zip, {
      delimiters: { start: "{{", end: "}}" },
      linebreaks: true,
      paragraphLoop: true,
    });
    document.render(buildTechnicalSupervisionContractTemplateValues(data));
    return document.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
  } catch (error) {
    throw new TechnicalSupervisionContractTemplateError("Не вдалося заповнити шаблон договору технічного нагляду.", { cause: error });
  }
}

export async function loadTechnicalSupervisionContractTemplate(): Promise<Buffer> {
  try {
    return await readFile(TECHNICAL_SUPERVISION_CONTRACT_TEMPLATE_PATH);
  } catch (error) {
    throw new TechnicalSupervisionContractTemplateError(`Не вдалося завантажити шаблон DOCX: ${TECHNICAL_SUPERVISION_CONTRACT_TEMPLATE_PATH}`, { cause: error });
  }
}

export async function createTechnicalSupervisionContractDocx(data: TechnicalSupervisionContractForm): Promise<Buffer> {
  return generateTechnicalSupervisionContractDocx(await loadTechnicalSupervisionContractTemplate(), data);
}
