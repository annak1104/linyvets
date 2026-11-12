import parseRTF, { type RtfDocument, type RtfParagraph } from "rtf-parser";

export type Avk5EvidenceSection =
  | "project-name"
  | "estimate-number"
  | "approval-summary"
  | "estimate-table"
  | "final-total"
  | "estimate-item"
  | "explanatory-summary"
  | "chief-engineer"
  | "project-organization"
  | "prepared-by"
  | "organization-placeholder";

export type Avk5DocumentType =
  | "local-estimate"
  | "object-estimate"
  | "consolidated-estimate"
  | "resource-estimate"
  | "unknown";

export type Avk5ExtractionStatus = "extracted" | "partial" | "unsupported";

export type Avk5WarningCode =
  | "MISSING_PROJECT_NAME"
  | "MISSING_FINAL_TOTAL"
  | "MISSING_PROJECT_ORGANIZATION"
  | "MISSING_CHIEF_PROJECT_ENGINEER"
  | "MISSING_APPROVAL_SUMMARY"
  | "MISSING_ESTIMATE_TABLE_TOTAL"
  | "MISSING_ESTIMATE_ITEMS"
  | "MISSING_ITEM_FIELD"
  | "MISSING_ESTIMATE_NUMBER"
  | "MISSING_PREPARED_BY"
  | "UNSUPPORTED_DOCUMENT_TYPE"
  | "AMBIGUOUS_FINAL_TOTAL";

export type Avk5ErrorCode = "INCONSISTENT_TOTALS";

export interface Avk5Evidence {
  section: Avk5EvidenceSection;
  label: string;
  paragraphIndex: number;
  text: string;
  matchedText?: string;
}

export interface Avk5EstimateData {
  documentType: Avk5DocumentType;
  estimateNumber: string | null;
  projectName: string | null;
  finalEstimatedTotalThousandsUah: number | null;
  finalEstimatedTotalThousandsUahText: string | null;
  projectOrganization: string | null;
  chiefProjectEngineer: string | null;
  preparedBy: string | null;
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
  priceUnit: Avk5MoneyUnit | null;
  total: number | null;
  totalUnit: Avk5MoneyUnit | null;
  sourceTotalText: string | null;
  totalThousandsUah: number | null;
  totalThousandsUahText: string | null;
  sourceRowIndex: number;
  sourceText: string;
  missingFields: Avk5EstimateItemField[];
}

export type Avk5MoneyUnit = "uah" | "thousands-uah";

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
  extractionStatus: Avk5ExtractionStatus;
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

  const documentType = detectAvk5DocumentType(paragraphs);
  return extractAvk5Data(paragraphs, extractEstimateItems(normalizedRtf, documentType), documentType);
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

type Avk5ValueMatch = {
  value: number;
  sourceText: string;
  evidence: { paragraphIndex: number; text: string; matchedText?: string };
};

interface Avk5DocumentAdapter {
  findFinalTotal: (paragraphs: string[]) => Avk5ValueMatch | undefined;
}

const AVK5_DOCUMENT_ADAPTERS: Record<Avk5DocumentType, Avk5DocumentAdapter> = {
  "local-estimate": { findFinalTotal: (paragraphs) => findGenericFinalTotal(paragraphs, "local-estimate") },
  "object-estimate": { findFinalTotal: (paragraphs) => findGenericFinalTotal(paragraphs, "object-estimate") },
  "consolidated-estimate": { findFinalTotal: findConsolidatedTotal },
  "resource-estimate": { findFinalTotal: (paragraphs) => findGenericFinalTotal(paragraphs, "resource-estimate") },
  unknown: { findFinalTotal: (paragraphs) => findGenericFinalTotal(paragraphs, "unknown") },
};

function extractAvk5Data(
  paragraphs: string[],
  items: Avk5EstimateItem[],
  documentType: Avk5DocumentType,
): Avk5ParseResult {
  const evidence: Avk5Evidence[] = [];
  const warnings: Avk5Warning[] = [];
  const errors: Avk5Error[] = [];

  const projectNameMatch = findProjectName(paragraphs);
  const estimateNumberMatch = findEstimateNumber(paragraphs);
  const preparedByMatch = findPreparedBy(paragraphs);
  const finalTotalMatch = AVK5_DOCUMENT_ADAPTERS[documentType].findFinalTotal(paragraphs);

  if (projectNameMatch) {
    evidence.push({ section: "project-name", label: PROJECT_NAME_SECTION, ...projectNameMatch.evidence });
  }

  if (estimateNumberMatch) {
    evidence.push({ section: "estimate-number", label: "Номер кошторису", ...estimateNumberMatch.evidence });
  }

  const summaryMatch = findApprovalSummaryTotal(paragraphs);
  if (summaryMatch) {
    evidence.push({ section: "approval-summary", label: APPROVAL_SUMMARY_LABEL, ...summaryMatch.evidence });
  }

  const estimateTableMatch = findEstimateTableTotal(paragraphs);
  if (estimateTableMatch) {
    evidence.push({ section: "estimate-table", label: documentType === "local-estimate" ? "Всього по кошторису" : ESTIMATE_TOTAL_LABEL, ...estimateTableMatch.evidence });
  }

  const explanatoryMatch = findExplanatoryTotal(paragraphs);
  if (explanatoryMatch) {
    evidence.push({ section: "explanatory-summary", label: "Всього за зведеним кошторисним розрахунком", ...explanatoryMatch.evidence });
  }

  const engineerMatch = findChiefEngineer(paragraphs);
  if (engineerMatch) {
    evidence.push({ section: "chief-engineer", label: "Головний інженер проєкту", ...engineerMatch.evidence });
  }

  if (preparedByMatch) {
    evidence.push({ section: "prepared-by", label: "Склав", ...preparedByMatch.evidence });
  }

  if (finalTotalMatch && documentType !== "consolidated-estimate") {
    evidence.push({ section: "final-total", label: "Підсумок документа", ...finalTotalMatch.evidence });
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
  if (organizationMatch) {
    evidence.push({ section: "project-organization", label: "Керівник проєктної організації", ...organizationMatch.evidence });
  }
  if (!organizationMatch) {
    const placeholder = findEvidence(paragraphs, (text) => text.includes("назва організації"));
    if (placeholder) {
      evidence.push({ section: "organization-placeholder", label: "( назва організації, що затверджує )", ...placeholder });
    }
  }

  const itemsTotalThousandsUah = sumItemTotals(items);
  const totalCandidates = [summaryMatch?.value, estimateTableMatch?.value, explanatoryMatch?.value, finalTotalMatch?.value].filter((value): value is number => value !== undefined && value !== null);
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
    warnings.push({ code: "AMBIGUOUS_FINAL_TOTAL", field: "verification", message: "The source contains conflicting final totals; no final total was selected automatically." });
  }

  const verifiedFinalTotal = verificationStatus === "mismatch" ? null : finalTotalMatch?.value ?? null;
  const verifiedFinalTotalText = verificationStatus === "mismatch" ? null : finalTotalMatch?.sourceText ?? null;

  const data: Avk5EstimateData = {
    documentType,
    estimateNumber: estimateNumberMatch?.value ?? null,
    projectName: projectNameMatch?.value ?? null,
    // An item sum is verification evidence only; it must never replace the
    // document's own total, especially when a local estimate is nested in a
    // larger consolidated document.
    finalEstimatedTotalThousandsUah: verifiedFinalTotal,
    finalEstimatedTotalThousandsUahText: verifiedFinalTotalText,
    projectOrganization: organizationMatch?.value ?? null,
    chiefProjectEngineer: engineerMatch?.value ?? null,
    preparedBy: preparedByMatch?.value ?? null,
    items,
    itemsTotalThousandsUah,
  };

  if (!data.projectName) warnings.push({ code: "MISSING_PROJECT_NAME", field: "projectName", message: "The AVK-5 project name was not found after the estimate title section." });
  if (!estimateNumberMatch) warnings.push({ code: "MISSING_ESTIMATE_NUMBER", field: "estimateNumber", message: "The estimate number was not found in the document title." });
  if (data.finalEstimatedTotalThousandsUah === null) warnings.push({ code: "MISSING_FINAL_TOTAL", field: "finalEstimatedTotalThousandsUah", message: "No final estimated total in thousands of UAH was found." });
  if (documentType === "consolidated-estimate" && !summaryMatch) warnings.push({ code: "MISSING_APPROVAL_SUMMARY", field: "verification", message: `The labeled summary section “${APPROVAL_SUMMARY_LABEL}” was not found.` });
  if (documentType === "consolidated-estimate" && !estimateTableMatch) warnings.push({ code: "MISSING_ESTIMATE_TABLE_TOTAL", field: "verification", message: `The labeled estimate-table total “${ESTIMATE_TOTAL_LABEL}” was not found.` });
  if (!data.projectOrganization) warnings.push({ code: "MISSING_PROJECT_ORGANIZATION", field: "projectOrganization", message: "The source contains an organization placeholder but does not name a project organization explicitly." });
  if (!data.chiefProjectEngineer) warnings.push({ code: "MISSING_CHIEF_PROJECT_ENGINEER", field: "chiefProjectEngineer", message: "The chief project engineer was not found." });
  if (!data.preparedBy) warnings.push({ code: "MISSING_PREPARED_BY", field: "preparedBy", message: "The person who prepared the estimate was not found." });
  if (documentType === "unknown") warnings.push({ code: "UNSUPPORTED_DOCUMENT_TYPE", field: "verification", message: "The RTF was decoded, but its AVK-5 document type was not recognized." });
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
    extractionStatus: documentType === "unknown"
      ? "unsupported"
      : data.projectName && data.finalEstimatedTotalThousandsUah !== null
        ? "extracted"
        : "partial",
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

type Avk5ColumnRoles = Partial<Record<"code" | "name" | "unit" | "quantity" | "price" | "total", number>>;

export interface Avk5RawTableRow {
  index: number;
  cells: string[];
  sourceText: string;
}

function extractEstimateItems(normalizedRtf: string, documentType: Avk5DocumentType): Avk5EstimateItem[] {
  const items: Avk5EstimateItem[] = [];
  const seen = new Set<string>();
  const rows = extractRtfTableRows(normalizedRtf);

  for (const row of rows) {
    if (row.cells.length < 6) continue;
    const roles = documentType === "consolidated-estimate" ? {} : findNearestColumnRoles(rows, row.index);
    const cells = row.cells;
    const itemNumber = cells[0].match(/^\d+$/)?.[0] ?? String(items.length + 1);
    const code = cells[roles.code ?? 1].trim().split(/\n+/, 1)[0].trim() || null;
    const name = normalizeTableCell(cells[roles.name ?? 2]);
    const sourceValues = inferItemSourceValues(cells, roles, documentType);
    const totalIndex = sourceValues.totalIndex ?? roles.total ?? cells.length - 1;
    const totalText = normalizeTableCell(cells[totalIndex]);
    const total = parseTableAmount(totalText);
    if (!code || !name || total === null) continue;
    if (/^\d+$/.test(code) && /^\d+$/.test(name)) continue;
    if (documentType === "local-estimate" && (/^Розр\./i.test(code) || !/[A-Za-zА-ЯІЇЄҐІ]/.test(code))) continue;

    const dedupeKey = `${code}\u0000${name}\u0000${totalText}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const totalUnit: Avk5MoneyUnit = documentType === "local-estimate" ? "uah" : "thousands-uah";
    const totalThousandsUah = totalUnit === "uah" ? Number((total / 1000).toFixed(3)) : total;
    items.push({
      id: `estimate-${row.index}-${itemNumber}`,
      code,
      name,
      unit: sourceValues.unit,
      quantity: sourceValues.quantity,
      price: sourceValues.price,
      priceUnit: sourceValues.price === null ? null : totalUnit,
      total,
      totalUnit,
      sourceTotalText: totalText,
      totalThousandsUah,
      totalThousandsUahText: formatThousandsUah(totalThousandsUah),
      sourceRowIndex: row.index,
      sourceText: row.sourceText,
      missingFields: (["unit", "quantity", "price"] as const).filter((field) => sourceValues[field] === null),
    });
  }

  return items;
}

export function extractRtfTableRows(normalizedRtf: string): Avk5RawTableRow[] {
  const rows: Avk5RawTableRow[] = [];
  const chunks = normalizedRtf.split(/\\trowd\b/).slice(1);

  for (const [index, rowChunk] of chunks.entries()) {
    const row = rowChunk.split(/\\row\b/, 1)[0];
    const contentStart = row.indexOf("\\pard");
    if (contentStart < 0) continue;
    // AVK-5 uses both {\cell } and formatted cells such as
    // {\f1\fs16  \cell}; split at the control word, not at the wrapper.
    const rawCells = row.slice(contentStart).split(/\\cell\b/).slice(0, -1);
    if (rawCells.length < 2) continue;
    const cells = rawCells.map(decodeRtfFragment);
    rows.push({ index, cells, sourceText: cells.join(" | ") });
  }

  return rows;
}

function findNearestColumnRoles(rows: Avk5RawTableRow[], rowIndex: number): Avk5ColumnRoles {
  for (let index = rows.findIndex((row) => row.index === rowIndex) - 1; index >= 0; index -= 1) {
    const candidate = rows[index];
    if (rowIndex - candidate.index > 12) break;
    const roles = detectColumnRoles(candidate.cells);
    if (Object.keys(roles).length >= 2) return roles;
  }
  return {};
}

function detectColumnRoles(cells: string[]): Avk5ColumnRoles {
  const roles: Avk5ColumnRoles = {};
  for (const [index, cell] of cells.entries()) {
    const text = cell.toLocaleLowerCase("uk-UA");
    if (roles.name === undefined && /найменув|опис\s+(?:робіт|витрат)|робіт\s+і\s+витрат/.test(text)) roles.name = index;
    else if (roles.unit === undefined && /одиниц|вимір|од\.?$/.test(text)) roles.unit = index;
    else if (roles.quantity === undefined && /кільк|обсяг/.test(text)) roles.quantity = index;
    else if (roles.price === undefined && /ціна|за\s+одиниц/.test(text)) roles.price = index;
    else if (roles.total === undefined && /разом|всього|сума|вартість/.test(text)) roles.total = index;
    else if (roles.code === undefined && /код|шифр|номери?\s+кошторис/.test(text)) roles.code = index;
  }
  return roles;
}

function inferItemSourceValues(cells: string[], roles: Avk5ColumnRoles, documentType: Avk5DocumentType): {
  unit: string | null;
  quantity: number | null;
  price: number | null;
  totalIndex: number | null;
} {
  const unitIndex = roles.unit ?? cells.findIndex((cell, index) => index >= 3 && index < cells.length - 1 && isLikelyUnit(cell));
  if (unitIndex < 0 && roles.quantity === undefined && roles.price === undefined) {
    return { unit: null, quantity: null, price: null, totalIndex: null };
  }
  const startIndex = Math.max(unitIndex, 2);
  const quantityIndex = roles.quantity ?? cells.findIndex((cell, index) => index > startIndex && parseDecimalValue(cell) !== null);
  const priceIndex = roles.price ?? cells.findIndex((cell, index) => index > quantityIndex && parseDecimalValue(cell) !== null);
  const quantity = quantityIndex >= 0 ? parseDecimalValue(cells[quantityIndex]) : null;
  const price = priceIndex >= 0 ? parseDecimalValue(cells[priceIndex]) : null;

  let totalIndex: number | null = roles.total ?? null;
  if (documentType === "local-estimate" && quantity !== null && price !== null) {
    const expectedTotal = quantity * price;
    totalIndex = cells.findIndex((cell, index) => index > priceIndex && Math.abs((parseDecimalValue(cell) ?? Number.NaN) - expectedTotal) <= 1);
    if (totalIndex < 0) totalIndex = null;
  }

  return {
    unit: unitIndex >= 0 ? normalizeTableCell(cells[unitIndex]) || null : null,
    quantity,
    price,
    totalIndex,
  };
}

function isLikelyUnit(value: string): boolean {
  if (!value || value === "-" || parseDecimalValue(value) !== null) return false;
  return value.length <= 24 && /[a-zа-яіїєґ%²³]/i.test(value) && !/(?:вартість|разом|всього|будівельн)/i.test(value);
}

function normalizeTableCell(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
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
        flushBytes();
        parts.push(control[1].toLowerCase() === "tab" ? "\t" : "\n");
      }
      index += control[0].length;
      continue;
    }
    index += 1;
  }

  flushBytes();
  return parts.join("")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function parseTableAmount(value: string): number | null {
  if (!value || value === "-") return null;
  const match = value.match(/\d{1,3}(?:[ .]\d{3})*(?:[.,]\d+)|\d+/);
  return match ? parseThousandsUah(match[0]) : null;
}

function parseDecimalValue(value: string | undefined): number | null {
  if (!value || value === "-") return null;
  const match = value.trim().match(/^\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const normalized = match[0].replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseUahToThousands(value: string): number {
  const normalized = value.replace(/[ .]/g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Avk5ParseError("RTF_PARSE_FAILED", `Invalid UAH amount: ${value}`);
  return Number((parsed / 1000).toFixed(3));
}

function sumItemTotals(items: Avk5EstimateItem[]): number | null {
  if (items.length === 0 || items.some((item) => item.totalThousandsUah === null)) return null;
  return Number(items.reduce((sum, item) => sum + (item.totalThousandsUah ?? 0), 0).toFixed(3));
}

function detectAvk5DocumentType(paragraphs: string[]): Avk5DocumentType {
  const titleText = paragraphs.slice(0, 40).join(" ").toLowerCase();
  if (/зведен[а-яіїєґ\s-]*кошторис|зведен[а-яіїєґ\s-]*розрахунок/.test(titleText)) return "consolidated-estimate";
  if (/відомість\s+ресурсів|ресурсний\s+кошторис/.test(titleText)) return "resource-estimate";
  if (/локальн[а-яіїєґ\s-]*кошторис|локальн[а-яіїєґ\s-]*розрахунок/.test(titleText)) return "local-estimate";
  if (/об['’`ʼ]?єктн[а-яіїєґ\s-]*кошторис|об['’`ʼ]?єктн[а-яіїєґ\s-]*розрахунок/.test(titleText)) return "object-estimate";
  return "unknown";
}

function findEstimateNumber(paragraphs: string[]) {
  for (const [index, text] of paragraphs.entries()) {
    const match = text.match(/(?:кошторис(?:ний)?|розрахунок)[^№\n]{0,100}№\s*([0-9]{2}-[0-9]{2}(?:-[0-9]{2})?)/i);
    if (match) return { value: match[1], evidence: makeEvidence(paragraphs, index, match[0]) };
  }
  return undefined;
}

function findPreparedBy(paragraphs: string[]) {
  for (const [index, text] of paragraphs.entries()) {
    const match = text.match(/(?:Склав|Підготував|Виконав)\s*:?\s*_*(?:\s*)?([А-ЯІЇЄҐІ][\p{L}'’ʼ-]+\s+[А-ЯІЇЄҐІ][\p{L}'’ʼ-]+?)(?=[,.;:]|\s|Перевірив|$)/u);
    if (match) return { value: match[1].trim(), evidence: makeEvidence(paragraphs, index, match[0]) };
  }
  return undefined;
}

function findConsolidatedTotal(paragraphs: string[]) {
  const summaryMatch = findApprovalSummaryTotal(paragraphs);
  if (summaryMatch) return summaryMatch;
  const estimateTableMatch = findEstimateTableTotal(paragraphs);
  if (estimateTableMatch) return estimateTableMatch;
  return findExplanatoryTotal(paragraphs);
}

function findGenericFinalTotal(paragraphs: string[], documentType: Avk5DocumentType) {
  if (documentType === "local-estimate") {
    for (const [index, text] of paragraphs.entries()) {
      const headerMatch = text.match(/кошторисна\s+вартість\s*([\d .]+[.,]\d+)\s*тис\.?\s*грн/i);
      if (headerMatch) {
        return { value: parseThousandsUah(headerMatch[1]), sourceText: headerMatch[1], evidence: makeEvidence(paragraphs, index, headerMatch[0]) };
      }
    }

    for (let index = paragraphs.length - 1; index >= 0; index -= 1) {
      const text = paragraphs[index];
      const match = text.match(/(?:всього\s+по\s+кошторису|всього\s+будівельні\s+роботи\s*,\s*грн\.)\s*([\d .]+(?:[.,]\d+)?)/i);
      if (match) {
        return { value: parseUahToThousands(match[1]), sourceText: match[1], evidence: makeEvidence(paragraphs, index, match[0]) };
      }
    }
  }

  const labels = documentType === "local-estimate"
    ? /(?:всього|разом|кошторисна\s+вартість|вартість\s+(?:робіт|будівництва)|підсумок)/i
    : /(?:всього|разом|кошторисна\s+вартість|підсумок)/i;

  for (let index = paragraphs.length - 1; index >= 0; index -= 1) {
    const text = paragraphs[index];
    if (!labels.test(text) || /у тому числ[іi]/i.test(text)) continue;
    const matches = [...text.matchAll(/(\d{1,3}(?:[ .]\d{3})*[.,]\d{3})\s*(?:тис\.?\s*грн|грн)/gi)];
    const match = matches.at(-1);
    if (match) return { value: parseThousandsUah(match[1]), sourceText: match[1], evidence: makeEvidence(paragraphs, index, match[0]) };
  }
  return undefined;
}

function findProjectName(paragraphs: string[]) {
  const index = paragraphs.findIndex((text) => text.includes(PROJECT_NAME_SECTION) && text.includes("Складений в поточних цінах"));
  if (index >= 0) {
    const text = paragraphs[index];
    const match = text.match(new RegExp(`${escapeRegExp(PROJECT_NAME_SECTION)}[\\s\\S]*?№\\s*(.+?)\\s+Складений в поточних цінах`));
    if (match) return { value: match[1].trim(), evidence: makeEvidence(paragraphs, index, match[1].trim()) };
  }

  const explanationIndex = paragraphs.findIndex((text) => /ПОЯСНЮВАЛЬНА\s+ЗАПИСКА/i.test(text));
  if (explanationIndex >= 0) {
    const text = paragraphs[explanationIndex].replace(/^.*?ПОЯСНЮВАЛЬНА\s+ЗАПИСКА\s*/i, "").trim();
    if (text && !/^(?:до|щодо)\s/i.test(text)) return { value: text, evidence: makeEvidence(paragraphs, explanationIndex, text) };
  }

  const objectLabelIndex = paragraphs.findIndex((text) => /\(найменування\s+об['’ʼ]єкта\s+будівництва\)/i.test(text));
  if (objectLabelIndex >= 0) {
    const text = paragraphs[objectLabelIndex];
    const match = text.match(/^(.+?)\s*\(найменування\s+об['’ʼ]єкта\s+будівництва\)/i);
    if (match) return { value: match[1].trim(), evidence: makeEvidence(paragraphs, objectLabelIndex, match[1].trim()) };
  }
  return undefined;
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
  const consolidatedIndex = paragraphs.findIndex((text) => text.includes(ESTIMATE_TOTAL_LABEL));
  if (consolidatedIndex >= 0) {
    const text = paragraphs[consolidatedIndex];
    const match = text.match(/(\d{1,3}(?:[ .]\d{3})*[.,]\d{3})$/);
    if (match) return { value: parseThousandsUah(match[1]), sourceText: match[1], evidence: makeEvidence(paragraphs, consolidatedIndex, match[0]) };
  }

  const localIndex = paragraphs.findIndex((text) => /всього\s+по\s+кошторису/i.test(text));
  if (localIndex >= 0) {
    const text = paragraphs[localIndex];
    const match = text.match(/всього\s+по\s+кошторису\s*([\d .]+(?:[.,]\d+)?)/i);
    if (match) return { value: parseUahToThousands(match[1]), sourceText: match[1], evidence: makeEvidence(paragraphs, localIndex, match[0]) };
  }
  return undefined;
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
    const headMatch = text.match(/Керівник\s+проєктної\s+організації\s*_*(?:\s*)?([А-ЯІЇЄҐІ][\p{L}'’ʼ-]+(?:\s+[А-ЯІЇЄҐІ][\p{L}'’ʼ-]+)+?)(?=\s+Головний\s+інженер|$)/u);
    if (headMatch) {
      const value = headMatch[1].trim();
      if (value) return { value, evidence: makeEvidence(paragraphs, index, headMatch[0]) };
    }

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
