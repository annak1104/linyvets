import { z } from "zod";

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
export const technicalSupervisionContractSchema = z.object({
  projectName: requiredText.min(2, "Додайте назву об’єкта"),
  customerProfileId: customerProfileIdSchema,
  contractorProfileId: contractorProfileIdSchema,
  chapters1To9TotalUah: decimalText,
  contractNumber: requiredText,
  documentDate: requiredText,
  contractEndDate: requiredText,
  customerName: requiredText,
  customerRepresentative: requiredText,
  customerLegalBasis: requiredText,
  contractorName: requiredText,
  contractorRegistrationDetails: requiredText,
  contractorCertificate: requiredText,
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
});

export type TechnicalSupervisionContractForm = z.infer<typeof technicalSupervisionContractSchema>;

export const emptyTechnicalSupervisionContractValues: TechnicalSupervisionContractForm = {
  projectName: "",
  customerProfileId: defaultCustomerProfileId,
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
  contractorCertificate: "",
  calculationRatePercent: "1,1",
  supervisionAmountUah: "",
  supervisionAmountInWords: "",
  customerTaxStatus: "",
  contractorTaxStatus: "",
  appendixReference: "розрахунок кошторисної вартості технічного нагляду",
  customerDetails: "",
  customerSignatureTitle: "Директор",
  customerSignature: "",
  contractorDetails: "",
  contractorSignatureTitle: "",
  contractorSignature: "",
};

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
  const values: TechnicalSupervisionContractForm = {
    ...emptyTechnicalSupervisionContractValues,
    projectName: calculation?.projectName ?? calculationDefaults.projectName,
    chapters1To9TotalUah: calculation?.chapters1To9TotalUah ?? calculationDefaults.chapters1To9TotalUah,
    customerProfileId: calculation?.customerProfileId ?? calculationDefaults.customerProfileId,
    contractorProfileId: calculation?.contractorProfileId ?? calculationDefaults.contractorProfileId,
    contractNumber: calculation?.contractNumber ?? "",
    documentDate: calculation?.documentDate ?? "",
    customerName: customer.legalName,
    customerDetails: calculation?.customerDetails ?? formatPartyDetails(customer),
    customerRepresentative: calculation?.customerDirector ?? customer.representativeName,
    customerSignature: calculation?.customerDirector ?? customer.signatureName,
    contractorName: contractor.legalName,
    contractorRegistrationDetails: `код ЄДРПОУ ${contractor.identificationCode}`,
    contractorDetails: calculation?.contractorDetails ?? formatPartyDetails(contractor),
    contractorSignatureTitle: calculation?.contractorSignatureTitle ?? contractor.signaturePosition,
    contractorSignature: calculation?.contractorSignature ?? contractor.signatureName,
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
    contractNumber: data.contractNumber,
    documentDate: data.documentDate,
    contractEndDate: data.contractEndDate,
    customerName: data.customerName,
    customerRepresentative: data.customerRepresentative,
    customerLegalBasis: data.customerLegalBasis,
    contractorName: data.contractorName,
    contractorRegistrationDetails: data.contractorRegistrationDetails,
    contractorCertificate: data.contractorCertificate,
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
  const next = {
    ...contract,
    projectName: calculation.projectName ?? contract.projectName,
    chapters1To9TotalUah: calculation.chapters1To9TotalUah ?? contract.chapters1To9TotalUah,
    customerProfileId: calculation.customerProfileId ?? contract.customerProfileId,
    contractorProfileId: calculation.contractorProfileId ?? contract.contractorProfileId,
    customerName: customer.legalName,
    contractorName: contractor.legalName,
    contractorRegistrationDetails: `код ЄДРПОУ ${contractor.identificationCode}`,
    contractNumber: calculation.contractNumber ?? contract.contractNumber,
    documentDate: calculation.documentDate ?? contract.documentDate,
    customerDetails: calculation.customerDetails ?? contract.customerDetails,
    customerRepresentative: calculation.customerDirector ?? contract.customerRepresentative,
    customerSignature: calculation.customerDirector ?? contract.customerSignature,
    contractorDetails: calculation.contractorDetails ?? contract.contractorDetails,
    contractorSignatureTitle: calculation.contractorSignatureTitle ?? contract.contractorSignatureTitle,
    contractorSignature: calculation.contractorSignature ?? contract.contractorSignature,
    calculationRatePercent: calculation.calculationRatePercent ?? contract.calculationRatePercent,
  };
  if (next.chapters1To9TotalUah && next.calculationRatePercent) Object.assign(next, derivedValues(next));
  return next;
}
