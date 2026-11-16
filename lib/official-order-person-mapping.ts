import { getOfficialOrderProfile, normalizePartyPersonName, type OfficialOrderPersonRole as PartyOfficialOrderPersonRole } from "@/lib/party-profiles";

export type { OfficialOrderPersonRole } from "@/lib/party-profiles";

export function normalizeOfficialOrderPersonName(value: string): string {
  return normalizePartyPersonName(value);
}

export function officialOrderPersonProfileId(
  personName: string | null | undefined,
  role: PartyOfficialOrderPersonRole,
): string | null {
  return getOfficialOrderProfile(personName, role as PartyOfficialOrderPersonRole)?.id ?? null;
}

export function officialOrderPersonValue(
  sourceName: string | null | undefined,
  role: PartyOfficialOrderPersonRole,
): string | null {
  if (!sourceName) return null;

  const profile = getOfficialOrderProfile(sourceName, role);
  if (!profile?.officialOrder) return null;

  return role === "projectOrganizationHead" ? profile.officialOrder.projectOrganization : profile.officialOrder.chiefProjectEngineer;
}

export function officialOrderPersonCertificate(
  sourceName: string | null | undefined,
  role: PartyOfficialOrderPersonRole,
): string | null {
  return getOfficialOrderProfile(sourceName, role)?.certificate ?? null;
}
