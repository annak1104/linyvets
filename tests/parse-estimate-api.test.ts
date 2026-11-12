import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/parse-estimate/route";
import { MAX_RTF_FILE_SIZE_BYTES } from "@/lib/upload-validation";

const fixture = readFileSync(resolve(process.cwd(), "reference/6_КД_ЗКР.rtf"));

function uploadRequest(name: string, bytes: Buffer, type = "application/rtf") {
  const formData = new FormData();
  formData.append("file", new File([bytes as unknown as BlobPart], name, { type }));
  return new Request("http://localhost/api/parse-estimate", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/parse-estimate", () => {
  it("parses the real RTF fixture in memory and returns typed estimate data", async () => {
    const response = await POST(uploadRequest("estimate.rtf", fixture));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.result.data.projectName).toContain("Поточний ремонт проїзду");
    expect(body.result.data.finalEstimatedTotalThousandsUahText).toBe("197,271");
    expect(body.result.data.chiefProjectEngineer).toBe("Ігор ШЕВЧУК");
    expect(body.result.data.items.length).toBe(8);
    expect(body.result.data.itemsTotalThousandsUah).toBe(197.271);
    expect(body.result.verification.status).toBe("verified");
    expect(body.result.evidence.length).toBeGreaterThan(0);
  });

  it("rejects an unsupported extension even when the bytes are RTF", async () => {
    const response = await POST(uploadRequest("estimate.txt", fixture, "text/plain"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toEqual({
      code: "UNSUPPORTED_EXTENSION",
      message: "Підтримуються лише файли з розширенням .rtf.",
    });
  });

  it("rejects empty, non-RTF, corrupted, and oversized uploads", async () => {
    const cases = [
      { name: "empty.rtf", bytes: Buffer.alloc(0), status: 400, code: "EMPTY_FILE" },
      { name: "plain.rtf", bytes: Buffer.from("not an RTF document"), status: 400, code: "INVALID_RTF_CONTENT" },
      { name: "broken.rtf", bytes: Buffer.from("{\\rtf1\\ansi broken"), status: 400, code: "INVALID_RTF_CONTENT" },
      { name: "large.rtf", bytes: Buffer.alloc(MAX_RTF_FILE_SIZE_BYTES + 1, 0x20), status: 413, code: "FILE_TOO_LARGE" },
    ];

    for (const testCase of cases) {
      const response = await POST(uploadRequest(testCase.name, testCase.bytes));
      const body = await response.json();
      expect(response.status, testCase.name).toBe(testCase.status);
      expect(body.error.code, testCase.name).toBe(testCase.code);
    }
  });

  it("returns a clear error when the multipart field is missing", async () => {
    const response = await POST(new Request("http://localhost/api/parse-estimate", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("FILE_REQUIRED");
  });
});
