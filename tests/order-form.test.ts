import { describe, expect, it } from "vitest";

import { buildOrderParagraphs, officialOrderCertificateValue } from "@/lib/order-form";

const baseValues = {
  projectName: "Тестовий проєкт",
  estimatedAmountThousandsUah: "1",
  estimatedAmountInWords: "Одна тисяча гривень 00 копійок",
  projectOrganization: "Ігор ШЕВЧУК",
  chiefProjectEngineer: "Ігор ШЕВЧУК",
  certificate: "",
};

describe("official order person defaults", () => {
  it.each(["Ігор ШЕВЧУК", "Ігор Шевчук", "  ІГОР   ШЕВЧУК  "]) (
    "maps the known person despite source formatting: %s",
    (sourceName) => {
      const paragraphs = buildOrderParagraphs(
        { ...baseValues, projectOrganization: sourceName, chiefProjectEngineer: sourceName },
        { projectOrganizationHead: sourceName, chiefProjectEngineer: sourceName },
      );

      expect(paragraphs.orderParagraph3).toBe("Проєктна організація: ФОП Шевчук І.В.");
      expect(paragraphs.orderParagraph4).toBe("Головний інженер проєкту: Шевчук І.В.");
    },
  );

  it.each(["Ігор ШЕВЧУК", "Ігор Шевчук", "Шевчук І.В.", "Шевчук І. В."]) (
    "resolves the approved certificate from the matched chief-engineer profile: %s",
    (sourceName) => {
      expect(officialOrderCertificateValue(sourceName, sourceName)).toBe("АТ № 007622");
    },
  );

  it("maps only the corresponding source role", () => {
    const organizationOnly = buildOrderParagraphs(
      { ...baseValues, chiefProjectEngineer: "Петро ІВАНЕНКО" },
      { projectOrganizationHead: "Ігор ШЕВЧУК", chiefProjectEngineer: "Петро ІВАНЕНКО" },
    );
    const engineerOnly = buildOrderParagraphs(
      { ...baseValues, projectOrganization: "ТОВ «Приклад»" },
      { projectOrganizationHead: "ТОВ «Приклад»", chiefProjectEngineer: "Ігор Шевчук" },
    );

    expect(organizationOnly.orderParagraph3).toBe("Проєктна організація: ФОП Шевчук І.В.");
    expect(organizationOnly.orderParagraph4).toBe("Головний інженер проєкту: Петро ІВАНЕНКО");
    expect(engineerOnly.orderParagraph3).toBe("Проєктна організація: ТОВ «Приклад»");
    expect(engineerOnly.orderParagraph4).toBe("Головний інженер проєкту: Шевчук І.В.");
  });

  it("does not infer the mapping for other or missing source roles", () => {
    const otherPerson = buildOrderParagraphs(
      { ...baseValues, projectOrganization: "Олена КОВАЛЕНКО", chiefProjectEngineer: "Петро ІВАНЕНКО" },
      { projectOrganizationHead: "Олена КОВАЛЕНКО", chiefProjectEngineer: "Петро ІВАНЕНКО" },
    );
    const missingEngineer = buildOrderParagraphs(
      { ...baseValues, chiefProjectEngineer: "" },
      { projectOrganizationHead: "Ігор ШЕВЧУК", chiefProjectEngineer: null },
    );

    expect(otherPerson.orderParagraph3).toBe("Проєктна організація: Олена КОВАЛЕНКО");
    expect(otherPerson.orderParagraph4).toBe("Головний інженер проєкту: Петро ІВАНЕНКО");
    expect(missingEngineer.orderParagraph3).toBe("Проєктна організація: ФОП Шевчук І.В.");
    expect(missingEngineer.orderParagraph4).toBe("Головний інженер проєкту: ");
  });

  it("does not infer a mapping without an identified AVK-5 source role", () => {
    const paragraphs = buildOrderParagraphs(baseValues);

    expect(paragraphs.orderParagraph3).toBe("Проєктна організація: Ігор ШЕВЧУК");
    expect(paragraphs.orderParagraph4).toBe("Головний інженер проєкту: Ігор ШЕВЧУК");
  });

  it("does not assign a certificate from surname alone or an unrelated engineer", () => {
    expect(officialOrderCertificateValue("Шевчук", "Шевчук")).toBe("");
    expect(officialOrderCertificateValue("Петро ІВАНЕНКО", "Ігор ШЕВЧУК")).toBe("");
  });

  it("keeps a manually edited role value as an ordinary editable value", () => {
    const paragraphs = buildOrderParagraphs(
      { ...baseValues, projectOrganization: "Власна організація" },
      { projectOrganizationHead: "Ігор ШЕВЧУК", chiefProjectEngineer: "Ігор ШЕВЧУК" },
    );

    expect(paragraphs.orderParagraph3).toBe("Проєктна організація: Власна організація");
    expect(paragraphs.orderParagraph4).toBe("Головний інженер проєкту: Шевчук І.В.");
  });
});
