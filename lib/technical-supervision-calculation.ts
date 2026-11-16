import { z } from "zod";

import { amountInWordsUkrainian, parseThousandsUahToKopecks } from "@/lib/ua-currency-to-words";
import type { EstimateContext } from "@/lib/documents/types";
import {
  contractorProfileIdSchema,
  customerProfileIdSchema,
  defaultContractorProfileId,
  defaultCustomerProfileId,
  formatPartyDetails,
  getContractorProfile,
  getCustomerProfile,
} from "@/lib/party-profiles";

const KOPECKS_PER_THOUSAND_UAH = BigInt(100_000);
const RATE_SCALE = BigInt(10_000);
const PERCENT_SCALE = BigInt(100);

const decimalText = z.string().trim().min(1, "Вкажіть значення").refine((value) => {
  try {
    parseDecimal(value);
    return true;
  } catch {
    return false;
  }
}, "Введіть коректне невід’ємне число");

const requiredText = z.string().trim().min(1, "Підтвердіть це поле");
export const technicalSupervisionCalculationSchema = z.object({
  projectName: requiredText.min(2, "Додайте назву об’єкта"),
  customerProfileId: customerProfileIdSchema,
  contractorProfileId: contractorProfileIdSchema,
  consolidatedTotalUah: decimalText,
  chapters1To9TotalUah: decimalText,
  calculationRatePercent: decimalText,
  supervisionAmountUah: z.string(),
  supervisionAmountInWords: z.string(),
  contractNumber: requiredText,
  documentDate: requiredText,
  customerDetails: requiredText,
  customerDirector: requiredText,
  contractorDetails: requiredText,
  contractorSignatureTitle: requiredText,
  contractorSignature: requiredText,
});

export type TechnicalSupervisionCalculationForm = z.infer<typeof technicalSupervisionCalculationSchema>;

export const emptyTechnicalSupervisionCalculationValues: TechnicalSupervisionCalculationForm = {
  projectName: "",
  customerProfileId: defaultCustomerProfileId,
  contractorProfileId: defaultContractorProfileId,
  consolidatedTotalUah: "",
  chapters1To9TotalUah: "",
  calculationRatePercent: "1,1",
  supervisionAmountUah: "",
  supervisionAmountInWords: "",
  contractNumber: "",
  documentDate: "",
  customerDetails: "",
  customerDirector: "",
  contractorDetails: "",
  contractorSignatureTitle: "",
  contractorSignature: "",
};

type ParsedDecimal = { integer: bigint; fraction: string };

function parseDecimal(value: string): ParsedDecimal {
  const normalized = value.replace(/\s+/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new TypeError("Некоректне десяткове число");
  const [integer, fraction = ""] = normalized.split(".");
  return { integer: BigInt(integer), fraction };
}

function parseRateToScaled(value: string): bigint {
  const { integer, fraction } = parseDecimal(value);
  const retained = fraction.slice(0, 4).padEnd(4, "0");
  const discarded = fraction.slice(4);
  let scaled = integer * RATE_SCALE + BigInt(retained || "0");
  if (discarded && BigInt(discarded) * BigInt(2) >= BigInt(10) ** BigInt(discarded.length)) scaled += BigInt(1);
  return scaled;
}

function parseUahToKopecks(value: string): bigint {
  const { integer, fraction } = parseDecimal(value);
  const retained = fraction.slice(0, 2).padEnd(2, "0");
  const discarded = fraction.slice(2);
  let kopecks = integer * BigInt(100) + BigInt(retained || "0");
  if (discarded && BigInt(discarded) * BigInt(2) >= BigInt(10) ** BigInt(discarded.length)) kopecks += BigInt(1);
  return kopecks;
}

function addThousandsSeparators(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatUahKopecks(kopecks: bigint): string {
  const absolute = kopecks < 0 ? -kopecks : kopecks;
  const hryvnias = absolute / BigInt(100);
  const minor = (absolute % BigInt(100)).toString().padStart(2, "0");
  return `${kopecks < 0 ? "-" : ""}${addThousandsSeparators(hryvnias.toString())},${minor}`;
}

export function formatUahFromThousands(value: string): string {
  return formatUahKopecks(parseThousandsUahToKopecks(value));
}

export function formatUahValue(value: string): string {
  return formatUahKopecks(parseUahToKopecks(value));
}

export function calculateSupervisionAmountKopecks(chapters1To9TotalUah: string, ratePercent: string): bigint {
  const baseKopecks = parseUahToKopecks(chapters1To9TotalUah);
  const rate = parseRateToScaled(ratePercent);
  const numerator = baseKopecks * rate;
  const denominator = PERCENT_SCALE * RATE_SCALE;
  return (numerator + denominator / BigInt(2)) / denominator;
}

function kopecksToThousandsInput(kopecks: bigint): string {
  const absolute = kopecks < 0 ? -kopecks : kopecks;
  const integer = absolute / KOPECKS_PER_THOUSAND_UAH;
  const fraction = (absolute % KOPECKS_PER_THOUSAND_UAH).toString().padStart(5, "0").replace(/0+$/, "");
  return `${kopecks < 0 ? "-" : ""}${integer.toString()}${fraction ? `.${fraction}` : ""}`;
}

export function supervisionAmountInWords(kopecks: bigint): string {
  return amountInWordsUkrainian(kopecksToThousandsInput(kopecks));
}

function normalizedRateText(value: string): string {
  const { integer, fraction } = parseDecimal(value);
  const trimmedFraction = fraction.replace(/0+$/, "");
  return `${integer.toString()}${trimmedFraction ? `,${trimmedFraction}` : ""}`;
}

export function buildTechnicalSupervisionCalculationTemplateValues(data: TechnicalSupervisionCalculationForm): Record<string, string> {
  const chaptersTotalUah = formatUahKopecks(parseUahToKopecks(data.chapters1To9TotalUah));
  const consolidatedTotalUah = formatUahKopecks(parseUahToKopecks(data.consolidatedTotalUah));
  const amountKopecks = calculateSupervisionAmountKopecks(chaptersTotalUah, data.calculationRatePercent);

  return {
    projectName: data.projectName,
    consolidatedTotalUah,
    chapters1To9TotalUah: chaptersTotalUah,
    calculationRatePercent: normalizedRateText(data.calculationRatePercent),
    supervisionAmountUah: formatUahKopecks(amountKopecks),
    supervisionAmountInWords: supervisionAmountInWords(amountKopecks),
    chapters1To9Expression: `${chaptersTotalUah} х ${normalizedRateText(data.calculationRatePercent)}%`,
    contractNumber: data.contractNumber,
    documentDate: data.documentDate,
    customerDetails: data.customerDetails,
    customerDirector: data.customerDirector,
    contractorDetails: data.contractorDetails,
    contractorSignatureTitle: data.contractorSignatureTitle,
    contractorSignature: data.contractorSignature,
  };
}

function contextMoneyToUah(contextValue: EstimateContext["totals"]["consolidated"]): string {
  return contextValue.value?.text ? formatUahFromThousands(contextValue.value.text) : "";
}

export function buildTechnicalSupervisionCalculationDefaults(context: EstimateContext): TechnicalSupervisionCalculationForm {
  const customer = getCustomerProfile();
  const contractor = getContractorProfile(defaultContractorProfileId);
  const defaults: TechnicalSupervisionCalculationForm = {
    ...emptyTechnicalSupervisionCalculationValues,
    projectName: context.project.name.value ?? "",
    consolidatedTotalUah: contextMoneyToUah(context.totals.consolidated),
    chapters1To9TotalUah: context.totals.chapters1To9.value?.text ? formatUahFromThousands(context.totals.chapters1To9.value.text) : "",
    customerDetails: formatPartyDetails(customer),
    customerDirector: customer.signatureName,
    contractorDetails: formatPartyDetails(contractor),
    contractorSignatureTitle: contractor.signaturePosition,
    contractorSignature: contractor.signatureName,
  };

  if (defaults.chapters1To9TotalUah && defaults.calculationRatePercent) {
    const amount = calculateSupervisionAmountKopecks(defaults.chapters1To9TotalUah, defaults.calculationRatePercent);
    defaults.supervisionAmountUah = formatUahKopecks(amount);
    defaults.supervisionAmountInWords = supervisionAmountInWords(amount);
  }

  return defaults;
}

