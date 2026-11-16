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

  it("contains all three source contractor profiles without invented fields", () => {
    expect(contractorProfiles).toHaveLength(3);
    expect(getContractorProfile("probudkontrol")).toMatchObject({
      legalName: "Товариство з обмеженою відповідальністю «ПроБудКонтроль»",
      identificationCode: "46061310",
      iban: "UA233052990000026001040819781",
      signatureName: "О. В. Ношкалюк",
      signaturePosition: "Директор",
      email: "probudkontrol@gmail.com",
    });
    expect(getContractorProfile("ik-zahid")).toMatchObject({
      legalName: "Товариство з обмеженою відповідальністю «ІК ЗАХІД»",
      identificationCode: "45709671",
      iban: "UA973003350000000260012375294",
      signatureName: "В.В.Войтович",
      signaturePosition: "Директор",
    });
    expect(getContractorProfile("fop-shevchuk")).toMatchObject({
      legalName: "ФОП Шевчук Ігор Вікторович",
      identificationCode: "3171009013",
      iban: "UA113033980000026009500700621",
      signatureName: "І. В. Шевчук",
      signaturePosition: "ФОП",
      email: null,
    });
    expect(getContractorProfile("fop-shevchuk").certificate).toBeNull();
    expect(getContractorProfile("fop-shevchuk").taxStatus).toBeNull();
    expect(getContractorProfile("ik-zahid").authorizationBasis).toBeNull();
    expect(getContractorProfile("fop-shevchuk").authorizationBasis).toBeNull();
  });
});
