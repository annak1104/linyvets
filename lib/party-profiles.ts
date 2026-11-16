import { z } from "zod";

export const customerProfileIdSchema = z.literal("lutsk-city-department");
export const contractorProfileIdSchema = z.enum(["probudkontrol", "ik-zahid", "fop-shevchuk", "fop-kras"]);

export type CustomerProfileId = z.infer<typeof customerProfileIdSchema>;
export type ContractorProfileId = z.infer<typeof contractorProfileIdSchema>;
export type ProfileVerificationStatus = "unverified";
export type PartyLegalType = "ТОВ" | "ФОП" | "державний орган";
export type OfficialOrderPersonRole = "projectOrganizationHead" | "chiefProjectEngineer";
export type OfficialOrderProfileData = {
  aliases: readonly string[];
  roles: readonly OfficialOrderPersonRole[];
  projectOrganization: string;
  chiefProjectEngineer: string;
};
export type HistoricalReference = {
  value: string;
  sourceReference: string;
  verificationStatus: "historical-reference";
};

export type PartyProfile = {
  id: CustomerProfileId | ContractorProfileId;
  displayName: string;
  legalName: string;
  legalType: PartyLegalType;
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
  officialOrder?: OfficialOrderProfileData;
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
  legalType: "державний орган",
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

export const customerSignatoryIdSchema = z.enum(["director-lishchuk", "acting-havryliuk", "acting-hrelia"]);
export type CustomerSignatoryId = z.infer<typeof customerSignatoryIdSchema>;
export type CustomerSignatory = {
  id: CustomerSignatoryId;
  position: string;
  displayName: string;
  fullName: string | null;
  authorizationBasis: string | null;
};

export const customerSignatories: readonly CustomerSignatory[] = [
  {
    id: "director-lishchuk",
    position: "Директор",
    displayName: "Ліщук В.Я.",
    fullName: "Ліщук Василь Ярославович",
    authorizationBasis: customerProfile.authorizationBasis?.value ?? null,
  },
  {
    id: "acting-havryliuk",
    position: "В.о. директора",
    displayName: "Гаврилюк С.В.",
    fullName: null,
    authorizationBasis: null,
  },
  {
    id: "acting-hrelia",
    position: "В.о. директора",
    displayName: "Греля А.Ю.",
    fullName: null,
    authorizationBasis: null,
  },
] as const;

export const defaultCustomerSignatoryId: CustomerSignatoryId = "director-lishchuk";

export function getCustomerSignatory(id: CustomerSignatoryId = defaultCustomerSignatoryId): CustomerSignatory {
  const signatory = customerSignatories.find((item) => item.id === id);
  if (!signatory) throw new Error(`Unknown customer signatory: ${id}`);
  return signatory;
}

export const contractorProfiles: readonly (PartyProfile & { id: ContractorProfileId })[] = [
  {
    id: "probudkontrol",
    displayName: "ТОВ «ПроБудКонтроль»",
    legalName: "Товариство з обмеженою відповідальністю «ПроБудКонтроль»",
    legalType: "ТОВ",
    address: "45653, Волинська обл., Луцький р-н,\nсело Чаруків, вулиця Шкільна, будинок 27",
    identificationCode: "46061310",
    iban: "UA233052990000026001040819781",
    sourceIbanText: null,
    accountPrefix: "р/р ",
    bank: "АТ КБ «ПРИВАТБАНК»",
    contacts: "+380992294760",
    email: "probudkontrol@gmail.com",
    representativeName: "Ношкалюк Олександр Віталійович",
    representativePosition: "Директор",
    signatureName: "О. В. Ношкалюк",
    signaturePosition: "Директор",
    certificate: null,
    taxStatus: null,
    authorizationBasis: {
      value: "виписка з Єдиного державного реєстру від 18.12.2025, № 1001871020000003582",
      sourceReference: "Історичні реквізити, надані користувачем",
      verificationStatus: "historical-reference",
    },
    verificationStatus: "unverified",
    sourceReference: "Розрахунок Ветеранів.doc",
    missingFields: ["certificate", "taxStatus"],
  },
  {
    id: "ik-zahid",
    displayName: "ТОВ «ІК ЗАХІД»",
    legalName: "Товариство з обмеженою відповідальністю «ІК ЗАХІД»",
    legalType: "ТОВ",
    address: "45744, Волинська обл., Луцький р-н,\nсело Широке, вулиця Молодіжна, буд.  6",
    identificationCode: "45709671",
    iban: "UA973003350000000260012375294",
    sourceIbanText: null,
    accountPrefix: "р/р ",
    bank: "АТ  «РАЙФФАЙЗЕН БАНК»",
    contacts: "+380992781647",
    email: "ikzahid123@gmail.com",
    representativeName: "Войтович Володимир Васильович",
    representativePosition: "Директор",
    signatureName: "В.В.Войтович",
    signaturePosition: "Директор",
    certificate: null,
    taxStatus: null,
    authorizationBasis: {
      value: "Статут, затверджений установчими зборами засновників, протокол від 30.01.2025 № 1.",
      sourceReference: "Історичні реквізити, надані користувачем",
      verificationStatus: "historical-reference",
    },
    verificationStatus: "unverified",
    sourceReference: "Розрахунок.doc",
    missingFields: ["certificate", "taxStatus"],
  },
  {
    id: "fop-shevchuk",
    displayName: "ФОП Шевчук Ігор Вікторович",
    legalName: "ФОП Шевчук Ігор Вікторович",
    legalType: "ФОП",
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
    certificate: "АТ № 007622",
    officialOrder: {
      aliases: ["ІГОР ШЕВЧУК", "Ігор Шевчук", "Шевчук І.В.", "Шевчук І. В.", "І. В. Шевчук", "ФОП Шевчук Ігор Вікторович"],
      roles: ["projectOrganizationHead", "chiefProjectEngineer"],
      projectOrganization: "ФОП Шевчук І.В.",
      chiefProjectEngineer: "Шевчук І.В.",
    },
    taxStatus: null,
    authorizationBasis: {
      value: "виписка з Єдиного державного реєстру від 14.06.2017, № 2 182 000 0000 002106",
      sourceReference: "Історичні реквізити, надані користувачем",
      verificationStatus: "historical-reference",
    },
    verificationStatus: "unverified",
    sourceReference: "Розрахунок технічного нагляду ПР Мостозагін.doc",
    missingFields: ["email", "taxStatus"],
  },
  {
    id: "fop-kras",
    displayName: "ФОП Крась Юрій Ігорович",
    legalName: "ФОП Крась Юрій Ігорович",
    legalType: "ФОП",
    address: "м. Луцьк, вул. Рилєєва, 8",
    identificationCode: "3080704216",
    iban: "UA133052990000026004040804630",
    sourceIbanText: null,
    accountPrefix: "р/р №",
    bank: "АТ КБ «ПриватБанк»",
    contacts: "0661475994",
    email: null,
    representativeName: "Крась Юрій Ігорович",
    representativePosition: "ФОП",
    signatureName: "Крась Ю.І.",
    signaturePosition: "ФОП",
    certificate: "АТ № 007840",
    taxStatus: "Єдина група оподаткування, III група",
    authorizationBasis: {
      value: "виписка з Єдиного державного реєстру від 17.10.2019 № 2 198 000 0000 033585",
      sourceReference: "Історичні реквізити, надані користувачем",
      verificationStatus: "historical-reference",
    },
    verificationStatus: "unverified",
    sourceReference: "Історичні реквізити, надані користувачем",
    missingFields: ["email"],
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

export function normalizePartyPersonName(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleUpperCase("uk-UA");
}

export function getOfficialOrderProfile(
  personName: string | null | undefined,
  role: OfficialOrderPersonRole,
): (PartyProfile & { id: ContractorProfileId }) | null {
  if (!personName) return null;
  const normalizedName = normalizePartyPersonName(personName);
  return contractorProfiles.find((profile) => profile.officialOrder?.roles.includes(role) && profile.officialOrder.aliases.some((alias) => normalizePartyPersonName(alias) === normalizedName)) ?? null;
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
  const signatoryId = customerSignatoryIdSchema.safeParse(value.customerSignatoryId).success
    ? value.customerSignatoryId as CustomerSignatoryId
    : defaultCustomerSignatoryId;
  const signatory = getCustomerSignatory(signatoryId);
  return {
    ...value,
    customerProfileId: value.customerProfileId ?? defaultCustomerProfileId,
    contractorProfileId: value.contractorProfileId ?? defaultContractorProfileId,
    customerSignatoryId: signatoryId,
    customerSignatureTitle: value.customerSignatureTitle ?? signatory.position,
    customerSignature: value.customerSignature ?? signatory.displayName,
  };
}
