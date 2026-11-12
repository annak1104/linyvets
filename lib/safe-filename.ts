export function safeOrderFilename(projectName: string): string {
  const normalized = projectName
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/[^\p{L}\p{N}\s._-]/gu, "")
    .trim()
    .replace(/[\s._-]+/g, "-")
    .slice(0, 96)
    .replace(/^[.-]+|[.-]+$/g, "");

  return `${normalized || "avk-5-nakaz"}.docx`;
}
