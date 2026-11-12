import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/generate-order/route";
import { orderLinesFromEstimate, type OrderForm } from "@/lib/order-form";
import { parseAvk5Estimate } from "@/lib/avk5-parser";

const sourcePath = resolve(process.cwd(), "reference/Кравчука.docx");

const editedOrder: OrderForm = {
  projectName: "Новий проєкт / об’єкт: 2026",
  projectOrganization: "ТОВ «Нова організація»",
  chiefProjectEngineer: "Ігор ШЕВЧУК",
  certificate: "серії АР № 999999",
  estimatedAmountThousandsUah: "197,271",
  estimatedAmountInWords: "Сто дев’яносто сім тисяч двісті сімдесят одна грн 00 коп.",
  orderParagraph1: "Затвердити зведений кошторис\nвартості робіт:",
  orderParagraph2: "Новий проєкт / об’єкт: 2026\nдодатковий рядок абзацу в наказі;",
  orderParagraph3: "Проєктна організація: ТОВ «Нова організація»",
  orderParagraph4: "Головний інженер проєкту - Ігор ШЕВЧУК (сертифікат серії АР № 999999).\nДодаткова примітка.",
  note: "Редаговано користувачем",
  lines: [],
};

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function packagePart(buffer: Buffer, name: string): Buffer {
  const file = new PizZip(buffer).file(name);
  if (!file) throw new Error(`Missing DOCX part: ${name}`);
  return file.asNodeBuffer();
}

describe("POST /api/generate-order", () => {
  it("generates a valid DOCX from final edited values with preserved template structure", async () => {
    const response = await POST(new Request("http://localhost/api/generate-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editedOrder),
    }));
    const document = Buffer.from(await response.arrayBuffer());
    const xml = packagePart(document, "word/document.xml").toString("utf8");
    const source = readFileSync(sourcePath);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const disposition = response.headers.get("content-disposition") ?? "";
    expect(disposition).toContain("filename=\"avk-5-order.docx\"");
    expect(decodeURIComponent(disposition)).toContain("Новий-проєкт-обєкт-2026.docx");

    expect(xml).not.toContain("{{");
    expect(xml).toContain("Новий проєкт / об’єкт: 2026");
    expect(xml).toContain("ТОВ «Нова організація»");
    expect(xml).toContain("Ігор ШЕВЧУК");
    expect(xml).toContain("серії АР № 999999");
    expect(xml).toContain("197,271");
    expect(xml).toContain("Сто дев’яносто сім тисяч двісті сімдесят одна грн 00 коп.");
    expect(xml).toContain("<w:br");
    expect(xml).not.toContain("Кравчука");
    expect(xml).not.toContain("Волинської області");
    expect(xml).not.toContain("Шевчук І.В.");
    expect(xml).not.toContain("012269");
    expect(xml).toContain("ЛУЦЬКА  МІСЬКА  РАДА");
    expect(xml).toContain("Василь Л");

    expect(sha256(packagePart(document, "word/media/image1.png"))).toBe(
      sha256(packagePart(source, "word/media/image1.png")),
    );
    expect(sha256(packagePart(document, "word/embeddings/oleObject1.bin"))).toBe(
      sha256(packagePart(source, "word/embeddings/oleObject1.bin")),
    );
  });

  it("rejects invalid final form data without attempting generation", async () => {
    const response = await POST(new Request("http://localhost/api/generate-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editedOrder, projectName: "", estimatedAmountThousandsUah: "not-a-number" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toEqual({
      code: "INVALID_ORDER_DATA",
      message: "Перевірте обов’язкові поля перед формуванням DOCX.",
    });
  });

  it("accepts extracted items with source-only totals and nullable quantity/price", async () => {
    const parsed = await parseAvk5Estimate(readFileSync(resolve(process.cwd(), "reference/6_КД_ЗКР.rtf")));
    const response = await POST(new Request("http://localhost/api/generate-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editedOrder, lines: orderLinesFromEstimate(parsed.data.items) }),
    }));

    expect(response.status).toBe(200);
  });
});
