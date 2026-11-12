import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/generate-order/route";
import { buildOrderParagraphs, type OrderForm } from "@/lib/order-form";
import { parseAvk5Estimate } from "@/lib/avk5-parser";
import { amountInWordsUkrainian } from "@/lib/ua-currency-to-words";

const sourcePath = resolve(process.cwd(), "reference/Кравчука.docx");
const localEstimatePath = resolve(process.cwd(), "reference/8_КД_ЛК1_02-01-01.rtf");

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
  it("uses the real local-estimate values when generating the official DOCX", async () => {
    const estimate = await parseAvk5Estimate(readFileSync(localEstimatePath));
    const values: OrderForm = {
      ...editedOrder,
      projectName: estimate.data.projectName ?? "",
      projectOrganization: estimate.data.projectOrganization ?? "",
      chiefProjectEngineer: estimate.data.chiefProjectEngineer ?? "",
      estimatedAmountThousandsUah: estimate.data.finalEstimatedTotalThousandsUahText ?? "",
      estimatedAmountInWords: amountInWordsUkrainian(estimate.data.finalEstimatedTotalThousandsUahText ?? ""),
    };
    const response = await POST(new Request("http://localhost/api/generate-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }));
    const xml = packagePart(Buffer.from(await response.arrayBuffer()), "word/document.xml").toString("utf8");

    expect(response.status).toBe(200);
    expect(xml).toContain("Поточний ремонт вулиці Ветеранів в місті Луцьку Волинської області");
    expect(xml).toContain("144,079");
    expect(xml).toContain("Сто сорок чотири тисячі сімдесят дев’ять грн 00 коп.");
    expect(xml).not.toContain("Кравчука");
    expect(xml).not.toContain("{{");
  });

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

  it("generates DOCX from the second source fixture without reusing the first project", async () => {
    const parsed = await parseAvk5Estimate(readFileSync(resolve(process.cwd(), "reference/10_КД_ЗКР.rtf")));
    const amountText = parsed.data.finalEstimatedTotalThousandsUahText ?? "";
    const values = {
      ...editedOrder,
      projectName: parsed.data.projectName ?? "",
      estimatedAmountThousandsUah: amountText,
      estimatedAmountInWords: amountInWordsUkrainian(amountText),
      chiefProjectEngineer: parsed.data.chiefProjectEngineer ?? "",
      ...buildOrderParagraphs({
        projectName: parsed.data.projectName ?? "",
        estimatedAmountThousandsUah: amountText,
        estimatedAmountInWords: amountInWordsUkrainian(amountText),
        projectOrganization: parsed.data.projectOrganization ?? "",
        chiefProjectEngineer: parsed.data.chiefProjectEngineer ?? "",
        certificate: "",
      }),
    } satisfies OrderForm;

    const response = await POST(new Request("http://localhost/api/generate-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }));
    const document = Buffer.from(await response.arrayBuffer());
    const xml = packagePart(document, "word/document.xml").toString("utf8");

    expect(response.status).toBe(200);
    expect(xml).toContain("Поточний ремонт вулиці Іова Кондзелевича");
    expect(xml).toContain("215,007");
    expect(xml).not.toContain("Поточний ремонт проїзду до будинку");
  });
});
