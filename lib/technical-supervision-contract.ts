import { z } from "zod";

import type { EstimateContext } from "@/lib/documents/types";
import {
  contractorProfileIdSchema,
  customerProfileIdSchema,
  customerSignatoryIdSchema,
  defaultCustomerSignatoryId,
  defaultContractorProfileId,
  defaultCustomerProfileId,
  formatPartyDetails,
  getContractorProfile,
  getCustomerProfile,
  getCustomerSignatory,
} from "@/lib/party-profiles";
import {
  buildTechnicalSupervisionCalculationDefaults,
  calculateSupervisionAmountKopecks,
  formatUahValue,
  formatUahKopecks,
  supervisionAmountInWords,
  type TechnicalSupervisionCalculationForm,
} from "@/lib/technical-supervision-calculation";

const decimalText = z.string().trim().min(1, "Вкажіть значення").refine((value) => {
  try {
    calculateSupervisionAmountKopecks("1", value);
    return true;
  } catch {
    return false;
  }
}, "Введіть коректну невід’ємну ставку");

const requiredText = z.string().trim().min(1, "Підтвердіть це поле");
const optionalText = z.string().trim();
export const CONTRACT_APPENDIX_REFERENCE = "Розрахунок кошторисної вартості технічного нагляду";
export const HISTORICAL_CUSTOMER_TAX_STATUS = "не є платником податку";
export const HISTORICAL_CONTRACTOR_TAX_STATUS = "є платником Єдиного податку 5%";
export const EMPTY_CONTRACT_NUMBER_PLACEHOLDER = "__________";
export const EMPTY_CONTRACT_SIGNING_DATE_PLACEHOLDER = "«____» __________ 2026 року";
export const EMPTY_CONTRACT_END_DATE_PLACEHOLDER = "**.**.2026";
const KYIV_TIME_ZONE = "Europe/Kyiv";

export function getKyivCurrentYear(now: Date = new Date()): number {
  const yearPart = new Intl.DateTimeFormat("en-US", { timeZone: KYIV_TIME_ZONE, year: "numeric" })
    .formatToParts(now)
    .find((part) => part.type === "year")?.value;
  if (!yearPart) throw new Error("Не вдалося визначити поточний рік у часовому поясі Europe/Kyiv");
  return Number(yearPart);
}

export function getDefaultContractEndDate(now: Date = new Date()): string {
  return `31.12.${getKyivCurrentYear(now)}`;
}

export const technicalSupervisionContractSchema = z.object({
  projectName: requiredText.min(2, "Додайте назву об’єкта"),
  customerProfileId: customerProfileIdSchema,
  customerSignatoryId: customerSignatoryIdSchema,
  contractorProfileId: contractorProfileIdSchema,
  chapters1To9TotalUah: decimalText,
  contractNumber: optionalText,
  documentDate: optionalText,
  contractEndDate: optionalText,
  customerName: requiredText,
  customerRepresentative: requiredText,
  customerLegalBasis: requiredText,
  contractorName: requiredText,
  contractorRegistrationDetails: requiredText,
  contractorAuthorizationBasis: requiredText,
  contractorCertificate: optionalText,
  calculationRatePercent: decimalText,
  supervisionAmountUah: z.string(),
  supervisionAmountInWords: z.string(),
  customerTaxStatus: requiredText,
  contractorTaxStatus: requiredText,
  appendixReference: requiredText,
  customerDetails: requiredText,
  customerSignatureTitle: requiredText,
  customerSignature: requiredText,
  contractorDetails: requiredText,
  contractorSignatureTitle: requiredText,
  contractorSignature: requiredText,
}).superRefine((data, context) => {
  const contractor = getContractorProfile(data.contractorProfileId);
  if (contractor.legalType === "ФОП" && !data.contractorCertificate) {
    context.addIssue({ path: ["contractorCertificate"], code: "custom", message: "Підтвердіть це поле" });
  }
});

export type TechnicalSupervisionContractForm = z.infer<typeof technicalSupervisionContractSchema>;

export const emptyTechnicalSupervisionContractValues: TechnicalSupervisionContractForm = {
  projectName: "",
  customerProfileId: defaultCustomerProfileId,
  customerSignatoryId: defaultCustomerSignatoryId,
  contractorProfileId: defaultContractorProfileId,
  chapters1To9TotalUah: "",
  contractNumber: "",
  documentDate: "",
  contractEndDate: "",
  customerName: "",
  customerRepresentative: "",
  customerLegalBasis: "",
  contractorName: "",
  contractorRegistrationDetails: "",
  contractorAuthorizationBasis: "",
  contractorCertificate: "",
  calculationRatePercent: "1,1",
  supervisionAmountUah: "",
  supervisionAmountInWords: "",
  customerTaxStatus: HISTORICAL_CUSTOMER_TAX_STATUS,
  contractorTaxStatus: HISTORICAL_CONTRACTOR_TAX_STATUS,
  appendixReference: CONTRACT_APPENDIX_REFERENCE,
  customerDetails: "",
  customerSignatureTitle: getCustomerSignatory(defaultCustomerSignatoryId).position,
  customerSignature: "",
  contractorDetails: "",
  contractorSignatureTitle: "",
  contractorSignature: "",
};

export function createEmptyTechnicalSupervisionContractValues(now: Date = new Date()): TechnicalSupervisionContractForm {
  return {
    ...emptyTechnicalSupervisionContractValues,
    contractEndDate: getDefaultContractEndDate(now),
  };
}

function derivedValues(data: Pick<TechnicalSupervisionContractForm, "chapters1To9TotalUah" | "calculationRatePercent">) {
  const amount = calculateSupervisionAmountKopecks(data.chapters1To9TotalUah, data.calculationRatePercent);
  return {
    supervisionAmountUah: formatUahKopecks(amount),
    supervisionAmountInWords: supervisionAmountInWords(amount),
  };
}

export function buildTechnicalSupervisionContractDefaults(
  context: EstimateContext,
  calculation?: Partial<TechnicalSupervisionCalculationForm>,
): TechnicalSupervisionContractForm {
  const calculationDefaults = buildTechnicalSupervisionCalculationDefaults(context);
  const customer = getCustomerProfile(calculation?.customerProfileId ?? calculationDefaults.customerProfileId);
  const contractor = getContractorProfile(calculation?.contractorProfileId ?? calculationDefaults.contractorProfileId);
  const signatory = getCustomerSignatory(calculation?.customerSignatoryId ?? defaultCustomerSignatoryId);
  const hasExplicitSignatory = calculation?.customerSignatoryId !== undefined;
  const values: TechnicalSupervisionContractForm = {
    ...createEmptyTechnicalSupervisionContractValues(),
    projectName: calculation?.projectName ?? calculationDefaults.projectName,
    chapters1To9TotalUah: calculation?.chapters1To9TotalUah ?? calculationDefaults.chapters1To9TotalUah,
    customerProfileId: calculation?.customerProfileId ?? calculationDefaults.customerProfileId,
    customerSignatoryId: calculation?.customerSignatoryId ?? defaultCustomerSignatoryId,
    contractorProfileId: calculation?.contractorProfileId ?? calculationDefaults.contractorProfileId,
    contractNumber: calculation?.contractNumber ?? "",
    documentDate: calculation?.documentDate ?? "",
    customerName: customer.legalName,
    customerDetails: calculation?.customerDetails ?? formatPartyDetails(customer),
    customerRepresentative: hasExplicitSignatory ? signatory.fullName ?? "" : calculation?.customerDirector ?? signatory.fullName ?? customer.representativeName,
    customerLegalBasis: hasExplicitSignatory ? signatory.authorizationBasis ?? "" : customer.authorizationBasis?.value ?? "",
    customerTaxStatus: customer.taxStatus ?? HISTORICAL_CUSTOMER_TAX_STATUS,
    customerSignatureTitle: signatory.position,
    customerSignature: signatory.displayName,
    contractorName: contractor.legalName,
    contractorRegistrationDetails: `код ЄДРПОУ ${contractor.identificationCode}`,
    contractorAuthorizationBasis: contractor.authorizationBasis?.value ?? "",
    contractorCertificate: contractor.certificate ?? "",
    contractorDetails: calculation?.contractorDetails ?? formatPartyDetails(contractor),
    contractorSignatureTitle: calculation?.contractorSignatureTitle ?? contractor.signaturePosition,
    contractorSignature: calculation?.contractorSignature ?? contractor.signatureName,
    contractorTaxStatus: contractor.taxStatus ?? HISTORICAL_CONTRACTOR_TAX_STATUS,
    calculationRatePercent: calculation?.calculationRatePercent ?? calculationDefaults.calculationRatePercent,
  };

  if (values.chapters1To9TotalUah && values.calculationRatePercent) {
    Object.assign(values, derivedValues(values));
  }
  return values;
}

export function buildTechnicalSupervisionContractTemplateValues(data: TechnicalSupervisionContractForm): Record<string, string> {
  const derived = derivedValues(data);
  return {
    projectName: data.projectName,
    chapters1To9TotalUah: formatUahValue(data.chapters1To9TotalUah),
    contractNumber: data.contractNumber || EMPTY_CONTRACT_NUMBER_PLACEHOLDER,
    documentDate: data.documentDate ? `«${data.documentDate}»` : EMPTY_CONTRACT_SIGNING_DATE_PLACEHOLDER,
    contractEndDate: data.contractEndDate || EMPTY_CONTRACT_END_DATE_PLACEHOLDER,
    customerName: data.customerName,
    customerRepresentative: data.customerRepresentative,
    customerLegalBasis: data.customerLegalBasis,
    contractorName: data.contractorName,
    contractorRegistrationDetails: data.contractorRegistrationDetails,
    contractorAuthorizationBasis: data.contractorAuthorizationBasis,
    contractorCertificate: data.contractorCertificate,
    contractorCertificateClause: data.contractorCertificate.trim() ? ` та ${data.contractorCertificate}` : "",
    calculationRatePercent: data.calculationRatePercent.replace(/\s+/g, ""),
    supervisionAmountUah: derived.supervisionAmountUah,
    supervisionAmountInWords: derived.supervisionAmountInWords,
    customerTaxStatus: data.customerTaxStatus,
    contractorTaxStatus: data.contractorTaxStatus,
    appendixReference: data.appendixReference,
    customerDetails: data.customerDetails,
    customerSignatureTitle: data.customerSignatureTitle,
    customerSignature: data.customerSignature,
    contractorDetails: data.contractorDetails,
    contractorSignatureTitle: data.contractorSignatureTitle,
    contractorSignature: data.contractorSignature,
  };
}

export function syncContractFromCalculation(
  contract: TechnicalSupervisionContractForm,
  calculation: Partial<TechnicalSupervisionCalculationForm>,
): TechnicalSupervisionContractForm {
  const customer = getCustomerProfile(calculation.customerProfileId ?? contract.customerProfileId);
  const contractor = getContractorProfile(calculation.contractorProfileId ?? contract.contractorProfileId);
  const signatoryId = calculation.customerSignatoryId ?? contract.customerSignatoryId;
  const signatory = getCustomerSignatory(signatoryId);
  const next = {
    ...contract,
    projectName: calculation.projectName ?? contract.projectName,
    chapters1To9TotalUah: calculation.chapters1To9TotalUah ?? contract.chapters1To9TotalUah,
    customerProfileId: calculation.customerProfileId ?? contract.customerProfileId,
    customerSignatoryId: signatoryId,
    contractorProfileId: calculation.contractorProfileId ?? contract.contractorProfileId,
    customerName: customer.legalName,
    contractorName: contractor.legalName,
    contractorRegistrationDetails: `код ЄДРПОУ ${contractor.identificationCode}`,
    contractorAuthorizationBasis: contractor.authorizationBasis?.value ?? contract.contractorAuthorizationBasis,
    contractorCertificate: contractor.certificate ?? "",
    contractorTaxStatus: contractor.taxStatus?.trim() || HISTORICAL_CONTRACTOR_TAX_STATUS,
    contractNumber: calculation.contractNumber ?? contract.contractNumber,
    documentDate: calculation.documentDate ?? contract.documentDate,
    customerDetails: calculation.customerDetails ?? contract.customerDetails,
    customerRepresentative: signatory.fullName ?? "",
    customerLegalBasis: signatory.authorizationBasis ?? "",
    customerSignatureTitle: signatory.position,
    customerSignature: signatory.displayName,
    contractorDetails: calculation.contractorDetails ?? contract.contractorDetails,
    contractorSignatureTitle: calculation.contractorSignatureTitle ?? contract.contractorSignatureTitle,
    contractorSignature: calculation.contractorSignature ?? contract.contractorSignature,
    calculationRatePercent: calculation.calculationRatePercent ?? contract.calculationRatePercent,
  };
  if (next.chapters1To9TotalUah && next.calculationRatePercent) Object.assign(next, derivedValues(next));
  return next;
}
