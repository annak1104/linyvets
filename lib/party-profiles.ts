import { z } from "zod";

export const customerProfileIdSchema = z.literal("lutsk-city-department");
export const contractorProfileIdSchema = z.enum(["probudkontrol", "ik-zahid", "fop-shevchuk"]);

export type CustomerProfileId = z.infer<typeof customerProfileIdSchema>;
export type ContractorProfileId = z.infer<typeof contractorProfileIdSchema>;
export type ProfileVerificationStatus = "unverified";
export type HistoricalReference = {
  value: string;
  sourceReference: string;
  verificationStatus: "historical-reference";
};

export type PartyProfile = {
  id: CustomerProfileId | ContractorProfileId;
  displayName: string;
  legalName: string;
  address: string;
  identificationCode: string;
  iban: string | null;
  sourceIbanText: string | null;
  accountPrefix: string;
  bank: string;
  contacts: string;
  email: string | null;
  representativeName: string;
  representativePosition: string;
  signatureName: string;
  signaturePosition: string;
  certificate: string | null;
  taxStatus: string | null;
  authorizationBasis: HistoricalReference | null;
  verificationStatus: ProfileVerificationStatus;
  sourceReference: string;
  missingFields: readonly string[];
};

export const customerProfile: PartyProfile & { id: CustomerProfileId } = {
  id: "lutsk-city-department",
  displayName: "Департамент житлово-комунального господарства Луцької міської ради",
  legalName: "Департамент житлово-комунального господарства Луцької міської ради",
  address: "43016, м. Луцьк,\nвул. Б.Хмельницького, 40А",
  identificationCode: "34572192",
  iban: null,
  sourceIbanText: "UA_______________________",
  accountPrefix: "р/р №",
  bank: "Держказначейська служба України\nм. Київ",
  contacts: "тел./факс 0332 773 150, 773 159",
  email: null,
  representativeName: "В.Я.Ліщук",
  representativePosition: "Директор",
  signatureName: "В.Я.Ліщук",
  signaturePosition: "Директор",
  certificate: null,
  taxStatus: null,
  authorizationBasis: {
    value: "Положення про департамент, затверджене рішенням Луцької міської ради від 29.06.2017 № 26/12",
    sourceReference: "Договір ПР Мостозагін.doc",
    verificationStatus: "historical-reference",
  },
  verificationStatus: "unverified",
  sourceReference: "Розрахунок Ветеранів.doc; Розрахунок.doc; Розрахунок технічного нагляду ПР Мостозагін.doc",
  missingFields: ["iban", "email", "taxStatus", "certificate"],
};

export const contractorProfiles: readonly (PartyProfile & { id: ContractorProfileId })[] = [
  {
    id: "probudkontrol",
    displayName: "ТОВ «ПроБудКонтроль»",
    legalName: "Товариство з обмеженою відповідальністю «ПроБудКонтроль»",
    address: "45653, Волинська обл., Луцький р-н,\nсело Чаруків, вулиця Шкільна, будинок 27",
    identificationCode: "46061310",
    iban: "UA233052990000026001040819781",
    sourceIbanText: null,
    accountPrefix: "р/р ",
    bank: "АТ КБ «ПРИВАТБАНК»",
    contacts: "+380992294760",
    email: "probudkontrol@gmail.com",
    representativeName: "О. В. Ношкалюк",
    representativePosition: "Директор",
    signatureName: "О. В. Ношкалюк",
    signaturePosition: "Директор",
    certificate: null,
    taxStatus: null,
    authorizationBasis: null,
    verificationStatus: "unverified",
    sourceReference: "Розрахунок Ветеранів.doc",
    missingFields: ["certificate", "taxStatus"],
  },
  {
    id: "ik-zahid",
    displayName: "ТОВ «ІК ЗАХІД»",
    legalName: "Товариство з обмеженою відповідальністю «ІК ЗАХІД»",
    address: "45744, Волинська обл., Луцький р-н,\nсело Широке, вулиця Молодіжна, буд.  6",
    identificationCode: "45709671",
    iban: "UA973003350000000260012375294",
    sourceIbanText: null,
    accountPrefix: "р/р ",
    bank: "АТ  «РАЙФФАЙЗЕН БАНК»",
    contacts: "+380992781647",
    email: "ikzahid123@gmail.com",
    representativeName: "В.В.Войтович",
    representativePosition: "Директор",
    signatureName: "В.В.Войтович",
    signaturePosition: "Директор",
    certificate: null,
    taxStatus: null,
    authorizationBasis: null,
    verificationStatus: "unverified",
    sourceReference: "Розрахунок.doc",
    missingFields: ["certificate", "taxStatus"],
  },
  {
    id: "fop-shevchuk",
    displayName: "ФОП Шевчук Ігор Вікторович",
    legalName: "ФОП Шевчук Ігор Вікторович",
    address: "45630, Волинська обл., Луцький район,  село Милушин, вул. Хутірська, 59а",
    identificationCode: "3171009013",
    iban: "UA113033980000026009500700621",
    sourceIbanText: null,
    accountPrefix: "р/р №",
    bank: "АТ «Ощадбанк»",
    contacts: "0504029855",
    email: null,
    representativeName: "І. В. Шевчук",
    representativePosition: "ФОП",
    signatureName: "І. В. Шевчук",
    signaturePosition: "ФОП",
    certificate: null,
    taxStatus: null,
    authorizationBasis: null,
    verificationStatus: "unverified",
    sourceReference: "Розрахунок технічного нагляду ПР Мостозагін.doc",
    missingFields: ["email", "certificate", "taxStatus"],
  },
] as const;

export const defaultCustomerProfileId: CustomerProfileId = customerProfile.id;
export const defaultContractorProfileId: ContractorProfileId = "fop-shevchuk";

export function getCustomerProfile(id: CustomerProfileId = defaultCustomerProfileId): PartyProfile & { id: CustomerProfileId } {
  if (id !== customerProfile.id) throw new Error(`Unknown customer profile: ${id}`);
  return customerProfile;
}

export function getContractorProfile(id: ContractorProfileId): PartyProfile & { id: ContractorProfileId } {
  const profile = contractorProfiles.find((item) => item.id === id);
  if (!profile) throw new Error(`Unknown contractor profile: ${id}`);
  return profile;
}

export function formatPartyDetails(profile: PartyProfile): string {
  const accountLine = profile.iban
    ? `${profile.accountPrefix}${profile.iban}`
    : profile.sourceIbanText
      ? `${profile.accountPrefix}${profile.sourceIbanText}`
      : profile.accountPrefix;
  return [
    profile.legalName,
    profile.address,
    accountLine,
    profile.bank,
    `код ЄДРПОУ ${profile.identificationCode}`,
    profile.contacts,
    profile.email,
  ].filter(Boolean).join("\n");
}

export function normalizeProfilePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const value = payload as Record<string, unknown>;
  return {
    ...value,
    customerProfileId: value.customerProfileId ?? defaultCustomerProfileId,
    contractorProfileId: value.contractorProfileId ?? defaultContractorProfileId,
  };
}
