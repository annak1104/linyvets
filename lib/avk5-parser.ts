import parseRTF, { type RtfDocument, type RtfParagraph } from "rtf-parser";

export type Avk5EvidenceSection =
  | "project-name"
  | "approval-summary"
  | "estimate-table"
  | "estimate-item"
  | "explanatory-summary"
  | "chief-engineer"
  | "organization-placeholder";

export type Avk5WarningCode =
  | "MISSING_PROJECT_NAME"
  | "MISSING_FINAL_TOTAL"
  | "MISSING_PROJECT_ORGANIZATION"
  | "MISSING_CHIEF_PROJECT_ENGINEER"
  | "MISSING_APPROVAL_SUMMARY"
  | "MISSING_ESTIMATE_TABLE_TOTAL"
  | "MISSING_ESTIMATE_ITEMS"
  | "MISSING_ITEM_FIELD";

export type Avk5ErrorCode = "INCONSISTENT_TOTALS";

export interface Avk5Evidence {
  section: Avk5EvidenceSection;
  label: string;
  paragraphIndex: number;
  text: string;
  matchedText?: string;
}

export interface Avk5EstimateData {
  projectName: string | null;
  finalEstimatedTotalThousandsUah: number | null;
  finalEstimatedTotalThousandsUahText: string | null;
  projectOrganization: string | null;
  chiefProjectEngineer: string | null;
  items: Avk5EstimateItem[];
  itemsTotalThousandsUah: number | null;
}

export type Avk5EstimateItemField = "unit" | "quantity" | "price";

export interface Avk5EstimateItem {
  id: string;
  code: string | null;
  name: string;
  unit: string | null;
  quantity: number | null;
  price: number | null;
  totalThousandsUah: number | null;
  totalThousandsUahText: string | null;
  sourceRowIndex: number;
  sourceText: string;
  missingFields: Avk5EstimateItemField[];
}

export interface Avk5TotalsVerification {
  status: "verified" | "mismatch" | "unavailable";
  summaryTotalThousandsUah: number | null;
  estimateTableTotalThousandsUah: number | null;
  explanatoryTotalThousandsUah: number | null;
  estimateItemsTotalThousandsUah: number | null;
}

export interface Avk5Warning {
  code: Avk5WarningCode;
  field: keyof Avk5EstimateData | "verification";
  message: string;
}

export interface Avk5Error {
  code: Avk5ErrorCode;
  message: string;
  values: number[];
}

export interface Avk5ParseResult {
  data: Avk5EstimateData;
  evidence: Avk5Evidence[];
  warnings: Avk5Warning[];
  errors: Avk5Error[];
  verification: Avk5TotalsVerification;
}

export type Avk5ParseErrorCode = "INVALID_RTF" | "RTF_PARSE_FAILED" | "EMPTY_RTF";

export class Avk5ParseError extends Error {
  readonly code: Avk5ParseErrorCode;

  constructor(code: Avk5ParseErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "Avk5ParseError";
    this.code = code;
  }
}

const RTF_HEADER = /^\s*\{\\rtf\d/;
const PROJECT_NAME_SECTION = "ЗВЕДЕНИЙ КОШТОРИСНИЙ РОЗРАХУНОК ВАРТОСТІ";
const APPROVAL_SUMMARY_LABEL = "Зведений кошторисний розрахунок в сумі";
const ESTIMATE_TOTAL_LABEL = "Всього по зведеному кошторисному розрахунку";

/**
 * Parse an AVK-5 estimate from its original RTF bytes.
 *
 * The fixture is ANSI/CP1251 and contains raw high-bit bytes rather than
 * RTF hex escapes. rtf-parser handles CP1251 through its hex escape path,
 * so the normalizer converts those bytes before handing the document to it.
 */
export async function parseAvk5Estimate(input: Buffer | Uint8Array | string): Promise<Avk5ParseResult> {
  const normalizedRtf = normalizeRtfForParser(input);
  const document = await parseDocument(normalizedRtf);
  const paragraphs = document.content.map((paragraph) => collapseWhitespace(flattenParagraph(paragraph)));

  if (paragraphs.every((paragraph) => paragraph.length === 0)) {
    throw new Avk5ParseError("EMPTY_RTF", "The RTF document contains no readable text.");
  }

  return extractAvk5Data(paragraphs, extractEstimateItems(normalizedRtf));
}

export function normalizeRtfForParser(input: Buffer | Uint8Array | string): string {
  const bytes = typeof input === "string" ? Buffer.from(input, "latin1") : Buffer.from(input);
  const binary = bytes.toString("latin1");

  if (!RTF_HEADER.test(binary)) {
    throw new Avk5ParseError("INVALID_RTF", "The input does not start with a valid RTF header.");
  }

  let normalized = binary.replace(/\{\\\*\\defchp\b[^{}]*\}/g, "");
  const fontTableStart = normalized.indexOf("{\\fonttbl");
  const colorTableStart = normalized.indexOf("{\\colortbl");
  const fontTable = fontTableStart >= 0
    ? normalized.slice(fontTableStart, colorTableStart > fontTableStart ? colorTableStart : fontTableStart + 1200)
    : "";

  // This file declares \deff0 but omits f0 from its font table. The parser
  // expects every referenced font to exist, so add a neutral CP1251 fallback.
  if (fontTableStart >= 0 && !/\{\\f0(?:\D|$)/.test(fontTable)) {
    normalized = normalized.replace(/\{\\fonttbl\{/, "{\\fonttbl{\\f0\\fnil\\fcharset204 Arial;}{");
  }

  // Keep the RTF control syntax ASCII and turn raw CP1251 text bytes into
  // standard RTF hex escapes. This preserves exact decoded source text.
  return Array.from(Buffer.from(normalized, "latin1"), (byte) => byte >= 0x80
    ? `\\'${byte.toString(16).padStart(2, "0")}`
    : String.fromCharCode(byte)).join("");
}

async function parseDocument(normalizedRtf: string): Promise<RtfDocument> {
  return new Promise((resolve, reject) => {
    try {
      parseRTF.string(normalizedRtf, (error, document) => {
        if (error) {
          reject(new Avk5ParseError("RTF_PARSE_FAILED", `Unable to parse the RTF document: ${error.message}`, { cause: error }));
          return;
        }
        if (!document) {
          reject(new Avk5ParseError("RTF_PARSE_FAILED", "The RTF parser returned no document."));
          return;
        }
        resolve(document);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown parser error";
      reject(new Avk5ParseError("RTF_PARSE_FAILED", `Unable to parse the RTF document: ${message}`, { cause: error }));
    }
  });
}

function extractAvk5Data(paragraphs: string[], items: Avk5EstimateItem[]): Avk5ParseResult {
  const evidence: Avk5Evidence[] = [];
  const warnings: Avk5Warning[] = [];
  const errors: Avk5Error[] = [];

  const projectNameMatch = findProjectName(paragraphs);
  if (projectNameMatch) {
    evidence.push({ section: "project-name", label: PROJECT_NAME_SECTION, ...projectNameMatch.evidence });
  }

  const summaryMatch = findApprovalSummaryTotal(paragraphs);
  if (summaryMatch) {
    evidence.push({ section: "approval-summary", label: APPROVAL_SUMMARY_LABEL, ...summaryMatch.evidence });
  }

  const estimateTableMatch = findEstimateTableTotal(paragraphs);
  if (estimateTableMatch) {
    evidence.push({ section: "estimate-table", label: ESTIMATE_TOTAL_LABEL, ...estimateTableMatch.evidence });
  }

  const explanatoryMatch = findExplanatoryTotal(paragraphs);
  if (explanatoryMatch) {
    evidence.push({ section: "explanatory-summary", label: "Всього за зведеним кошторисним розрахунком", ...explanatoryMatch.evidence });
  }

  const engineerMatch = findChiefEngineer(paragraphs);
  if (engineerMatch) {
    evidence.push({ section: "chief-engineer", label: "Головний інженер проєкту", ...engineerMatch.evidence });
  }

  for (const [index, item] of items.entries()) {
    evidence.push({
      section: "estimate-item",
      label: `Позиція ${item.code ?? index + 1}`,
      paragraphIndex: item.sourceRowIndex,
      text: item.sourceText,
      matchedText: item.sourceText,
    });
  }

  const organizationMatch = findExplicitOrganization(paragraphs);
  if (!organizationMatch) {
    const placeholder = findEvidence(paragraphs, (text) => text.includes("назва організації"));
    if (placeholder) {
      evidence.push({ section: "organization-placeholder", label: "( назва організації, що затверджує )", ...placeholder });
    }
  }

  const itemsTotalThousandsUah = sumItemTotals(items);
  const totalCandidates = [summaryMatch?.value, estimateTableMatch?.value, explanatoryMatch?.value, itemsTotalThousandsUah].filter((value): value is number => value !== undefined && value !== null);
  const uniqueTotals = [...new Set(totalCandidates)];
  const verificationStatus: Avk5TotalsVerification["status"] = uniqueTotals.length === 0
    ? "unavailable"
    : uniqueTotals.length === 1 && totalCandidates.length >= 2
      ? "verified"
      : uniqueTotals.length > 1
        ? "mismatch"
        : "unavailable";

  if (verificationStatus === "mismatch") {
    errors.push({
      code: "INCONSISTENT_TOTALS",
      message: `The source total sections do not agree: ${uniqueTotals.map(formatThousandsUah).join(", ")}.`,
      values: uniqueTotals,
    });
  }

  const data: Avk5EstimateData = {
    projectName: projectNameMatch?.value ?? null,
    finalEstimatedTotalThousandsUah: summaryMatch?.value ?? estimateTableMatch?.value ?? explanatoryMatch?.value ?? null,
    finalEstimatedTotalThousandsUahText: summaryMatch?.sourceText ?? estimateTableMatch?.sourceText ?? explanatoryMatch?.sourceText ?? null,
    projectOrganization: organizationMatch?.value ?? null,
    chiefProjectEngineer: engineerMatch?.value ?? null,
    items,
    itemsTotalThousandsUah,
  };

  if (!data.projectName) warnings.push({ code: "MISSING_PROJECT_NAME", field: "projectName", message: "The AVK-5 project name was not found after the estimate title section." });
  if (data.finalEstimatedTotalThousandsUah === null) warnings.push({ code: "MISSING_FINAL_TOTAL", field: "finalEstimatedTotalThousandsUah", message: "No final estimated total in thousands of UAH was found." });
  if (!summaryMatch) warnings.push({ code: "MISSING_APPROVAL_SUMMARY", field: "verification", message: `The labeled summary section “${APPROVAL_SUMMARY_LABEL}” was not found.` });
  if (!estimateTableMatch) warnings.push({ code: "MISSING_ESTIMATE_TABLE_TOTAL", field: "verification", message: `The labeled estimate-table total “${ESTIMATE_TOTAL_LABEL}” was not found.` });
  if (!data.projectOrganization) warnings.push({ code: "MISSING_PROJECT_ORGANIZATION", field: "projectOrganization", message: "The source contains an organization placeholder but does not name a project organization explicitly." });
  if (!data.chiefProjectEngineer) warnings.push({ code: "MISSING_CHIEF_PROJECT_ENGINEER", field: "chiefProjectEngineer", message: "The chief project engineer was not found." });
  if (!items.length) warnings.push({ code: "MISSING_ESTIMATE_ITEMS", field: "items", message: "No separate estimate items were found in the source table." });
  for (const item of items) {
    if (item.missingFields.length > 0) {
      warnings.push({
        code: "MISSING_ITEM_FIELD",
        field: "items",
        message: `Estimate item ${item.code ?? item.name} is missing: ${item.missingFields.join(", ")}.`,
      });
    }
  }

  return {
    data,
    evidence,
    warnings,
    errors,
    verification: {
      status: verificationStatus,
      summaryTotalThousandsUah: summaryMatch?.value ?? null,
      estimateTableTotalThousandsUah: estimateTableMatch?.value ?? null,
      explanatoryTotalThousandsUah: explanatoryMatch?.value ?? null,
      estimateItemsTotalThousandsUah: itemsTotalThousandsUah,
    },
  };
}

function extractEstimateItems(normalizedRtf: string): Avk5EstimateItem[] {
  const items: Avk5EstimateItem[] = [];
  const seen = new Set<string>();
  const rows = normalizedRtf.split(/\\trowd\b/).slice(1);

  for (const [rowIndex, rowChunk] of rows.entries()) {
    const row = rowChunk.split(/\\row\b/, 1)[0];
    const contentStart = row.indexOf("\\pard");
    if (contentStart < 0) continue;

    // AVK-5 uses both {\cell } and formatted cells such as
    // {\f1\fs16  \cell}; split at the control word, not at the wrapper.
    const rawCells = row.slice(contentStart).split(/\\cell\b/).slice(0, -1);
    if (rawCells.length < 7) continue;
    const cells = rawCells.map(decodeRtfFragment);
    const itemNumber = cells[0].match(/^\d+$/)?.[0] ?? String(items.length + 1);
    const code = cells[1] || null;
    const name = cells[2] || "";
    const totalIndex = cells.length - 1;
    const totalText = cells[totalIndex] || "";
    if (!code || !name || !parseTableAmount(totalText)) continue;

    const dedupeKey = `${code}\u0000${name}\u0000${totalText}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const totalThousandsUah = parseTableAmount(totalText);
    const sourceValues = inferItemSourceValues(cells);
    items.push({
      id: `estimate-${rowIndex}-${itemNumber}`,
      code,
      name,
      unit: sourceValues.unit,
      quantity: sourceValues.quantity,
      price: sourceValues.price,
      totalThousandsUah,
      totalThousandsUahText: totalText,
      sourceRowIndex: rowIndex,
      sourceText: cells.slice(1).join(" | "),
      missingFields: (["unit", "quantity", "price"] as const).filter((field) => sourceValues[field] === null),
    });
  }

  return items;
}

function inferItemSourceValues(cells: string[]): {
  unit: string | null;
  quantity: number | null;
  price: number | null;
} {
  const candidateUnit = cells[3] || "";
  const hasExplicitUnit = candidateUnit.length > 0 && candidateUnit !== "-" && parseDecimalValue(candidateUnit) === null;
  if (hasExplicitUnit) {
    return {
      unit: candidateUnit,
      quantity: parseDecimalValue(cells[4]),
      price: parseDecimalValue(cells[5]),
    };
  }

  return {
    // The consolidated table labels monetary columns as “тис. грн”, but it
    // does not provide a per-item unit. Keep the item unit missing rather than
    // turning the table's currency measure into an invented unit.
    unit: null,
    quantity: null,
    price: null,
  };
}

function decodeRtfFragment(fragment: string): string {
  const bytes: number[] = [];
  const parts: string[] = [];
  const flushBytes = () => {
    if (bytes.length > 0) {
      parts.push(new TextDecoder("windows-1251").decode(Uint8Array.from(bytes)));
      bytes.length = 0;
    }
  };

  for (let index = 0; index < fragment.length;) {
    const character = fragment[index];
    if (character === "{") {
      index += 1;
      continue;
    }
    if (character === "}") {
      index += 1;
      continue;
    }
    if (character !== "\\") {
      bytes.push(fragment.charCodeAt(index));
      index += 1;
      continue;
    }

    const next = fragment[index + 1];
    if (next === "'") {
      const hex = fragment.slice(index + 2, index + 4);
      if (/^[0-9a-f]{2}$/i.test(hex)) bytes.push(Number.parseInt(hex, 16));
      index += 4;
      continue;
    }
    if (next === "u") {
      const match = fragment.slice(index).match(/^\\u(-?\d+)\??/);
      if (match) {
        flushBytes();
        const codePoint = Number(match[1]);
        parts.push(String.fromCharCode(codePoint < 0 ? codePoint + 65536 : codePoint));
        index += match[0].length;
        continue;
      }
    }
    if (next === "~") {
      bytes.push(0xa0);
      index += 2;
      continue;
    }
    if (next === "-" || next === "_") {
      if (next === "_") bytes.push(0x2d);
      index += 2;
      continue;
    }
    if (next === "\\" || next === "{" || next === "}") {
      bytes.push(next.charCodeAt(0));
      index += 2;
      continue;
    }

    const control = fragment.slice(index).match(/^\\([a-z]+)(-?\d+)? ?/i);
    if (control) {
      if (control[1].toLowerCase() === "par" || control[1].toLowerCase() === "line" || control[1].toLowerCase() === "tab") {
        bytes.push(0x20);
      }
      index += control[0].length;
      continue;
    }
    index += 1;
  }

  flushBytes();
  return collapseWhitespace(parts.join(""));
}

function parseTableAmount(value: string): number | null {
  if (!value || value === "-") return null;
  const match = value.match(/\d{1,3}(?:[ .]\d{3})*[.,]\d{3}/);
  return match ? parseThousandsUah(match[0]) : null;
}

function parseDecimalValue(value: string | undefined): number | null {
  if (!value || value === "-") return null;
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function sumItemTotals(items: Avk5EstimateItem[]): number | null {
  if (items.length === 0 || items.some((item) => item.totalThousandsUah === null)) return null;
  return Number(items.reduce((sum, item) => sum + (item.totalThousandsUah ?? 0), 0).toFixed(3));
}

function findProjectName(paragraphs: string[]) {
  const index = paragraphs.findIndex((text) => text.includes(PROJECT_NAME_SECTION) && text.includes("Складений в поточних цінах"));
  if (index === -1) return undefined;
  const text = paragraphs[index];
  const match = text.match(new RegExp(`${escapeRegExp(PROJECT_NAME_SECTION)}[\\s\\S]*?№\\s*(.+?)\\s+Складений в поточних цінах`));
  if (!match) return undefined;
  return { value: match[1].trim(), evidence: makeEvidence(paragraphs, index, match[1].trim()) };
}

function findApprovalSummaryTotal(paragraphs: string[]) {
  const index = paragraphs.findIndex((text) => text.includes("Затверджено (схвалено)") && text.includes(APPROVAL_SUMMARY_LABEL));
  if (index === -1) return undefined;
  const text = paragraphs[index];
  const match = text.match(new RegExp(`${escapeRegExp(APPROVAL_SUMMARY_LABEL)}\\s+([0-9][0-9 .]*[.,][0-9]{3})\\s+тис\\.\\s*грн`, "i"));
  if (!match) return undefined;
  return { value: parseThousandsUah(match[1]), sourceText: match[1], evidence: makeEvidence(paragraphs, index, match[0]) };
}

function findEstimateTableTotal(paragraphs: string[]) {
  const index = paragraphs.findIndex((text) => text.includes(ESTIMATE_TOTAL_LABEL));
  if (index === -1) return undefined;
  const text = paragraphs[index];
  const match = text.match(/(\d{1,3}(?:[ .]\d{3})*[.,]\d{3})$/);
  if (!match) return undefined;
  return { value: parseThousandsUah(match[1]), sourceText: match[1], evidence: makeEvidence(paragraphs, index, match[0]) };
}

function findExplanatoryTotal(paragraphs: string[]) {
  const index = paragraphs.findIndex((text) => /у тому числ[іi]:/i.test(text) && /податок на додану варт[іi]сть/i.test(text));
  if (index === -1) return undefined;
  const text = paragraphs[index];
  const match = text.match(/у тому числ[іi]:\s*(\d{1,3}(?:[ .]\d{3})*[.,]\d{3})\s*тис\./i);
  if (!match) return undefined;
  return { value: parseThousandsUah(match[1]), sourceText: match[1], evidence: makeEvidence(paragraphs, index, match[0]) };
}

function findChiefEngineer(paragraphs: string[]) {
  const index = paragraphs.findIndex((text) => text.includes("Головний інженер проєкту"));
  if (index === -1) return undefined;
  const text = paragraphs[index];
  const match = text.match(/Головний інженер проєкту\s*_*\s*([А-ЯІЇЄҐ][\p{L}'’\-]+(?:\s+[А-ЯІЇЄҐ][\p{L}'’\-]+)+?)(?=\s+(?:Керівник|$))/u);
  if (!match) return undefined;
  return { value: match[1].trim(), evidence: makeEvidence(paragraphs, index, match[0]) };
}

function findExplicitOrganization(paragraphs: string[]) {
  for (const [index, text] of paragraphs.entries()) {
    const match = text.match(/(?:назва організації|організація)\s*[:\-]\s*([^()\n]+)$/i);
    if (match && !/що затверджує/i.test(match[1])) {
      const value = match[1].trim();
      if (value) return { value, evidence: makeEvidence(paragraphs, index, match[0]) };
    }
  }
  return undefined;
}

function findEvidence(paragraphs: string[], predicate: (text: string) => boolean) {
  const index = paragraphs.findIndex(predicate);
  return index >= 0 ? makeEvidence(paragraphs, index) : undefined;
}

function makeEvidence(paragraphs: string[], paragraphIndex: number, matchedText?: string) {
  return { paragraphIndex, text: paragraphs[paragraphIndex], ...(matchedText ? { matchedText } : {}) };
}

function flattenParagraph(paragraph: RtfParagraph): string {
  return (paragraph.content ?? []).map((span) => span.value ?? "").join("");
}

function collapseWhitespace(value: string): string {
  return value.replace(/[\u00a0\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function parseThousandsUah(value: string): number {
  const parsed = Number(value.replace(/[ .]/g, "").replace(",", "."));
  if (!Number.isFinite(parsed)) throw new Avk5ParseError("RTF_PARSE_FAILED", `Invalid thousands-of-UAH amount: ${value}`);
  return parsed;
}

function formatThousandsUah(value: number): string {
  return value.toLocaleString("uk-UA", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
