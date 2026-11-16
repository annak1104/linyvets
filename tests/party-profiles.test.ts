import { describe, expect, it } from "vitest";

import {
  contractorProfiles,
  customerProfile,
  formatPartyDetails,
  getContractorProfile,
} from "@/lib/party-profiles";

describe("configured party profiles", () => {
  it("keeps the exact customer values and explicit missing IBAN", () => {
    expect(customerProfile.legalName).toBe("Департамент житлово-комунального господарства Луцької міської ради");
    expect(customerProfile.address).toContain("43016, м. Луцьк");
    expect(customerProfile.identificationCode).toBe("34572192");
    expect(customerProfile.iban).toBeNull();
    expect(customerProfile.sourceIbanText).toBe("UA_______________________");
    expect(customerProfile.signatureName).toBe("В.Я.Ліщук");
    expect(customerProfile.authorizationBasis).toEqual({
      value: "Положення про департамент, затверджене рішенням Луцької міської ради від 29.06.2017 № 26/12",
      sourceReference: "Договір ПР Мостозагін.doc",
      verificationStatus: "historical-reference",
    });
    expect(formatPartyDetails(customerProfile)).toContain("р/р №");
  });

  it("contains all four source contractor profiles without invented fields", () => {
    expect(contractorProfiles).toHaveLength(4);
    expect(getContractorProfile("probudkontrol")).toMatchObject({
      legalName: "Товариство з обмеженою відповідальністю «ПроБудКонтроль»",
      identificationCode: "46061310",
      iban: "UA233052990000026001040819781",
      signatureName: "О. В. Ношкалюк",
      signaturePosition: "Директор",
      representativeName: "Ношкалюк Олександр Віталійович",
      authorizationBasis: {
        value: "виписка з Єдиного державного реєстру від 18.12.2025, № 1001871020000003582",
        verificationStatus: "historical-reference",
      },
      email: "probudkontrol@gmail.com",
    });
    expect(getContractorProfile("ik-zahid")).toMatchObject({
      legalName: "Товариство з обмеженою відповідальністю «ІК ЗАХІД»",
      identificationCode: "45709671",
      iban: "UA973003350000000260012375294",
      signatureName: "В.В.Войтович",
      signaturePosition: "Директор",
      representativeName: "Войтович Володимир Васильович",
      authorizationBasis: {
        value: "Статут, затверджений установчими зборами засновників, протокол від 30.01.2025 № 1.",
        verificationStatus: "historical-reference",
      },
    });
    expect(getContractorProfile("fop-shevchuk")).toMatchObject({
      legalName: "ФОП Шевчук Ігор Вікторович",
      identificationCode: "3171009013",
      iban: "UA113033980000026009500700621",
      signatureName: "І. В. Шевчук",
      signaturePosition: "ФОП",
      email: null,
      certificate: "АТ № 007622",
      officialOrder: {
        aliases: expect.arrayContaining(["Ігор Шевчук", "Шевчук І.В."]),
        roles: ["projectOrganizationHead", "chiefProjectEngineer"],
        projectOrganization: "ФОП Шевчук І.В.",
        chiefProjectEngineer: "Шевчук І.В.",
      },
      authorizationBasis: {
        value: "виписка з Єдиного державного реєстру від 14.06.2017, № 2 182 000 0000 002106",
        verificationStatus: "historical-reference",
      },
    });
    expect(getContractorProfile("fop-kras")).toMatchObject({
      legalName: "ФОП Крась Юрій Ігорович",
      address: "м. Луцьк, вул. Рилєєва, 8",
      identificationCode: "3080704216",
      iban: "UA133052990000026004040804630",
      bank: "АТ КБ «ПриватБанк»",
      contacts: "0661475994",
      representativeName: "Крась Юрій Ігорович",
      signatureName: "Крась Ю.І.",
      signaturePosition: "ФОП",
      taxStatus: "Єдина група оподаткування, III група",
      certificate: "АТ № 007840",
      authorizationBasis: {
        value: "виписка з Єдиного державного реєстру від 17.10.2019 № 2 198 000 0000 033585",
        verificationStatus: "historical-reference",
      },
    });
    expect(getContractorProfile("fop-shevchuk").taxStatus).toBeNull();
    expect(getContractorProfile("probudkontrol").certificate).toBeNull();
    expect(getContractorProfile("ik-zahid").certificate).toBeNull();
    expect(getContractorProfile("probudkontrol").taxStatus).toBeNull();
    expect(getContractorProfile("ik-zahid").taxStatus).toBeNull();
  });
});
