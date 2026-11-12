import { readFile } from "node:fs/promises";
import path from "node:path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

import {
  amountInWordsUkrainian,
  type DecimalInput,
  formatThousandsUah,
} from "@/lib/ua-currency-to-words";

export type OfficialOrderTemplateData = {
  projectName?: string;
  estimatedAmountThousandsUah?: DecimalInput;
  estimatedAmountInWords?: string;
  projectOrganization?: string;
  chiefProjectEngineer?: string;
  /** Certificate identifier without the surrounding “сертифікат” phrase. */
  certificate?: string;
  orderParagraph1?: string;
  orderParagraph2?: string;
  orderParagraph3?: string;
  orderParagraph4?: string;
};

export class OfficialOrderTemplateError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "OfficialOrderTemplateError";
  }
}

export const OFFICIAL_ORDER_TEMPLATE_PATH = path.join(
  process.cwd(),
  "templates",
  "official-order-template.docx",
);

const DEFAULT_ORDER_PARAGRAPH = "Затвердити зведений кошторис вартості робіт (робочий проєкт):";

function textOrEmpty(value: string | undefined): string {
  return value ?? "";
}

function certificatePhrase(value: string | undefined): string {
  return value ? ` (сертифікат ${value})` : "";
}

function projectParagraph(data: OfficialOrderTemplateData, amount: string, words: string): string {
  if (!data.projectName || !amount || !words) return "";
  return `${data.projectName} в сумі ${amount} тис. грн. (${words});`;
}

function organizationParagraph(value: string | undefined): string {
  return value ? `Проєктна організація: ${value}` : "";
}

function engineerParagraph(data: OfficialOrderTemplateData): string {
  if (!data.chiefProjectEngineer) return "";
  return `Головний інженер проєкту - ${data.chiefProjectEngineer}${certificatePhrase(data.certificate)}.`;
}

export function buildOfficialOrderTemplateValues(data: OfficialOrderTemplateData): Record<string, string> {
  const amount = data.estimatedAmountThousandsUah;
  const estimatedAmount = amount === undefined ? "" : formatThousandsUah(amount);
  const estimatedAmountInWords =
    data.estimatedAmountInWords ?? (amount === undefined ? "" : amountInWordsUkrainian(amount));

  return {
    orderParagraph1: data.orderParagraph1 ?? DEFAULT_ORDER_PARAGRAPH,
    orderParagraph2: data.orderParagraph2 ?? projectParagraph(data, estimatedAmount, estimatedAmountInWords),
    orderParagraph3: data.orderParagraph3 ?? organizationParagraph(data.projectOrganization),
    orderParagraph4: data.orderParagraph4 ?? engineerParagraph(data),
    projectName: textOrEmpty(data.projectName),
    estimatedAmount,
    estimatedAmountInWords,
    projectOrganization: textOrEmpty(data.projectOrganization),
    chiefProjectEngineer: textOrEmpty(data.chiefProjectEngineer),
    certificate: certificatePhrase(data.certificate),
  };
}

export function generateOfficialOrderDocx(
  templateBuffer: Buffer,
  data: OfficialOrderTemplateData,
): Buffer {
  try {
    const zip = new PizZip(templateBuffer);
    const document = new Docxtemplater(zip, {
      delimiters: { start: "{{", end: "}}" },
      linebreaks: true,
      paragraphLoop: true,
    });

    document.render(buildOfficialOrderTemplateValues(data));
    return document.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
  } catch (error) {
    throw new OfficialOrderTemplateError("Не вдалося заповнити шаблон офіційного наказу.", { cause: error });
  }
}

export async function loadOfficialOrderTemplate(): Promise<Buffer> {
  try {
    return await readFile(OFFICIAL_ORDER_TEMPLATE_PATH);
  } catch (error) {
    throw new OfficialOrderTemplateError(
      `Не вдалося завантажити шаблон DOCX: ${OFFICIAL_ORDER_TEMPLATE_PATH}`,
      { cause: error },
    );
  }
}

export async function createOfficialOrderDocx(data: OfficialOrderTemplateData): Promise<Buffer> {
  return generateOfficialOrderDocx(await loadOfficialOrderTemplate(), data);
}
