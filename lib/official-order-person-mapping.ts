export type OfficialOrderPersonRole = "projectOrganizationHead" | "chiefProjectEngineer";

type OfficialOrderPersonMapping = {
  sourceName: string;
  projectOrganization: string;
  chiefProjectEngineer: string;
};

const KNOWN_OFFICIAL_ORDER_PERSON_MAPPINGS: readonly OfficialOrderPersonMapping[] = [
  {
    sourceName: "ІГОР ШЕВЧУК",
    projectOrganization: "ФОП Шевчук І.В.",
    chiefProjectEngineer: "Шевчук І.В.",
  },
];

export function normalizeOfficialOrderPersonName(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleUpperCase("uk-UA");
}

export function officialOrderPersonValue(
  sourceName: string | null | undefined,
  role: OfficialOrderPersonRole,
): string | null {
  if (!sourceName) return null;

  const mapping = KNOWN_OFFICIAL_ORDER_PERSON_MAPPINGS.find(
    (candidate) => normalizeOfficialOrderPersonName(candidate.sourceName) === normalizeOfficialOrderPersonName(sourceName),
  );
  if (!mapping) return null;

  return role === "projectOrganizationHead" ? mapping.projectOrganization : mapping.chiefProjectEngineer;
}
