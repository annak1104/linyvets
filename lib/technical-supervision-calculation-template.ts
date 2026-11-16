import { readFile } from "node:fs/promises";
import path from "node:path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

import {
  buildTechnicalSupervisionCalculationTemplateValues,
  type TechnicalSupervisionCalculationForm,
} from "@/lib/technical-supervision-calculation";

export const TECHNICAL_SUPERVISION_CALCULATION_TEMPLATE_PATH = path.join(
  process.cwd(),
  "templates",
  "technical-supervision-calculation-v1.docx",
);

export class TechnicalSupervisionCalculationTemplateError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TechnicalSupervisionCalculationTemplateError";
  }
}

export function generateTechnicalSupervisionCalculationDocx(
  templateBuffer: Buffer,
  data: TechnicalSupervisionCalculationForm,
): Buffer {
  try {
    const document = new Docxtemplater(new PizZip(templateBuffer), {
      delimiters: { start: "{{", end: "}}" },
      linebreaks: true,
      paragraphLoop: true,
    });
    document.render(buildTechnicalSupervisionCalculationTemplateValues(data));
    return document.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
  } catch (error) {
    throw new TechnicalSupervisionCalculationTemplateError("Не вдалося заповнити шаблон розрахунку технічного нагляду.", { cause: error });
  }
}

export async function loadTechnicalSupervisionCalculationTemplate(): Promise<Buffer> {
  try {
    return await readFile(TECHNICAL_SUPERVISION_CALCULATION_TEMPLATE_PATH);
  } catch (error) {
    throw new TechnicalSupervisionCalculationTemplateError(
      `Не вдалося завантажити шаблон DOCX: ${TECHNICAL_SUPERVISION_CALCULATION_TEMPLATE_PATH}`,
      { cause: error },
    );
  }
}

export async function createTechnicalSupervisionCalculationDocx(data: TechnicalSupervisionCalculationForm): Promise<Buffer> {
  return generateTechnicalSupervisionCalculationDocx(await loadTechnicalSupervisionCalculationTemplate(), data);
}

