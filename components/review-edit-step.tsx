"use client";

import React, { useEffect, useRef } from "react";
import type { FieldErrors, UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet,
  Info,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import type { Avk5ParseResult } from "@/lib/avk5-parser";
import { amountInWordsUkrainian } from "@/lib/ua-currency-to-words";
import { buildOrderParagraphs, type OrderForm, type OrderParagraphValues } from "@/lib/order-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ReviewEditStepProps = {
  form: UseFormReturn<OrderForm>;
  parseResult: Avk5ParseResult | null;
  isGenerating: boolean;
  selectedFile: File | null;
  onBack: () => void;
  onSubmit: (values: OrderForm) => Promise<void>;
  onInvalid?: (errors: FieldErrors<OrderForm>) => void;
};

export function ReviewEditStep({
  form,
  parseResult,
  isGenerating,
  selectedFile,
  onBack,
  onSubmit,
  onInvalid,
}: ReviewEditStepProps) {
  const values = useWatch({ control: form.control }) as OrderForm;
  const amount = useWatch({ control: form.control, name: "estimatedAmountThousandsUah" });
  const lastGeneratedWords = useRef("");
  const lastGeneratedParagraphs = useRef<OrderParagraphValues>({
    orderParagraph1: form.getValues("orderParagraph1"),
    orderParagraph2: form.getValues("orderParagraph2"),
    orderParagraph3: form.getValues("orderParagraph3"),
    orderParagraph4: form.getValues("orderParagraph4"),
  });

  useEffect(() => {
    lastGeneratedParagraphs.current = {
      orderParagraph1: form.getValues("orderParagraph1"),
      orderParagraph2: form.getValues("orderParagraph2"),
      orderParagraph3: form.getValues("orderParagraph3"),
      orderParagraph4: form.getValues("orderParagraph4"),
    };
  }, [form, parseResult]);

  useEffect(() => {
    const rawAmount = amount.trim();
    if (!rawAmount) {
      if (form.getValues("estimatedAmountInWords")) {
        form.setValue("estimatedAmountInWords", "", { shouldDirty: true, shouldValidate: false });
      }
      lastGeneratedWords.current = "";
      return;
    }

    try {
      const nextWords = amountInWordsUkrainian(rawAmount);
      if (form.getValues("estimatedAmountInWords") !== nextWords) {
        form.setValue("estimatedAmountInWords", nextWords, { shouldDirty: true, shouldValidate: false });
      }
      lastGeneratedWords.current = nextWords;
    } catch {
      if (form.getValues("estimatedAmountInWords") === lastGeneratedWords.current) {
        form.setValue("estimatedAmountInWords", "", { shouldDirty: true, shouldValidate: false });
      }
    }
  }, [amount, form]);

  useEffect(() => {
    const generated = buildOrderParagraphs(values);
    for (const key of ["orderParagraph2", "orderParagraph3", "orderParagraph4"] as const) {
      const current = form.getValues(key);
      if (current === lastGeneratedParagraphs.current[key]) {
        form.setValue(key, generated[key], { shouldDirty: false, shouldValidate: false });
        lastGeneratedParagraphs.current[key] = generated[key];
      }
    }
  }, [form, values, values.certificate, values.chiefProjectEngineer, values.estimatedAmountInWords, values.estimatedAmountThousandsUah, values.projectName, values.projectOrganization]);

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.82fr)]">
        <Card className="overflow-hidden">
          <div className="border-b p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <Badge className="bg-accent text-primary-hover">Крок 2 · Редагування</Badge>
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Перевірте наказ перед формуванням.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Уточніть реквізити та текст. Попередній перегляд праворуч оновлюється одразу.</p>
              </div>
              <div className="flex w-fit items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
                <FileSpreadsheet className="size-4 text-primary-hover" />
                <span className="max-w-[190px] truncate">{selectedFile?.name ?? "кошторис"}</span>
              </div>
            </div>
          </div>

          {parseResult && <ParseResultBanner result={parseResult} />}

          <div className="space-y-7 p-6 sm:p-8">
            <section aria-labelledby="order-fields-heading">
              <div className="mb-4">
                <h3 id="order-fields-heading" className="text-sm font-semibold">Реквізити наказу</h3>
                <p className="mt-1 text-xs text-muted-foreground">Відсутні у джерелі значення залишено порожніми.</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Назва проєкту" hint={fieldStateHint(parseResult?.data.projectName, Boolean(form.formState.dirtyFields.projectName))} error={form.formState.errors.projectName?.message}>
                  <Input {...form.register("projectName")} aria-invalid={Boolean(form.formState.errors.projectName)} />
                </Field>
                <Field label="Сума, тис. грн" hint={fieldStateHint(parseResult?.data.finalEstimatedTotalThousandsUah, Boolean(form.formState.dirtyFields.estimatedAmountThousandsUah))} error={form.formState.errors.estimatedAmountThousandsUah?.message}>
                  <Input {...form.register("estimatedAmountThousandsUah")} inputMode="decimal" placeholder="197,271" aria-invalid={Boolean(form.formState.errors.estimatedAmountThousandsUah)} />
                </Field>
                <Field label="Проєктна організація" hint={fieldStateHint(parseResult?.data.projectOrganization, Boolean(form.formState.dirtyFields.projectOrganization))}>
                  <Input {...form.register("projectOrganization")} placeholder="Не зазначено у джерелі" />
                </Field>
                <Field label="Головний інженер проєкту" hint={fieldStateHint(parseResult?.data.chiefProjectEngineer, Boolean(form.formState.dirtyFields.chiefProjectEngineer))}>
                  <Input {...form.register("chiefProjectEngineer")} placeholder="Не знайдено" />
                </Field>
                <Field label="Сертифікат" hint={fieldStateHint(null, Boolean(form.formState.dirtyFields.certificate))}>
                  <Input {...form.register("certificate")} placeholder="Не зазначено у джерелі" />
                </Field>
                <Field label="Сума українською" hint="Автоматично">
                  <Textarea className="min-h-24 bg-background" readOnly {...form.register("estimatedAmountInWords")} placeholder="З’явиться після введення суми" />
                </Field>
              </div>
            </section>

            <section aria-labelledby="paragraph-heading">
              <div className="mb-4">
                <h3 id="paragraph-heading" className="text-sm font-semibold">Текст наказу</h3>
                <p className="mt-1 text-xs text-muted-foreground">Усі чотири абзаци можна редагувати. Автосинхронізація працює, доки абзац не змінено вручну.</p>
              </div>
              <div className="space-y-4">
                <Field label="Абзац 1 · вступ" error={form.formState.errors.orderParagraph1?.message}>
                  <Textarea className="min-h-24" {...form.register("orderParagraph1")} aria-invalid={Boolean(form.formState.errors.orderParagraph1)} />
                </Field>
                <Field label="Абзац 2 · проєкт"><Textarea className="min-h-24" {...form.register("orderParagraph2")} placeholder="З’явиться після заповнення назви та суми" /></Field>
                <Field label="Абзац 3 · організація"><Textarea className="min-h-20" {...form.register("orderParagraph3")} placeholder="Залишено порожнім, якщо даних немає" /></Field>
                <Field label="Абзац 4 · інженер"><Textarea className="min-h-20" {...form.register("orderParagraph4")} placeholder="Залишено порожнім, якщо даних немає" /></Field>
              </div>
            </section>

            <div className="flex items-start gap-2 rounded-xl bg-background px-3 py-2.5 text-xs leading-5 text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0 text-primary-hover" />Відредаговані значення зберігаються під час переходу між кроками.</div>
          </div>

          <div className="flex flex-col-reverse justify-between gap-3 border-t bg-background px-6 py-5 sm:flex-row sm:items-center sm:px-8"><Button type="button" variant="ghost" onClick={onBack}><ArrowLeft className="size-4" /> Назад</Button><Button type="submit" variant="primary" disabled={isGenerating}>{isGenerating ? <LoaderCircle className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}{isGenerating ? "Формуємо документ…" : "Сформувати AVK-5"}<ArrowRight className="size-4" /></Button></div>
        </Card>

        <OrderPreview values={values} />
      </div>
    </form>
  );
}

function OrderPreview({ values }: { values: OrderForm }) {
  return (
    <aside className="lg:sticky lg:top-6" aria-label="Живий попередній перегляд наказу">
      <div className="mb-3 flex items-center justify-between px-1"><div><p className="text-sm font-semibold">Живий перегляд</p><p className="mt-1 text-xs text-muted-foreground">Орієнтовна візуалізація офіційного наказу</p></div><Badge className="bg-accent text-primary-hover">live</Badge></div>
      <div className="rounded-[26px] border bg-background p-3 shadow-sm sm:p-5">
        <div className="mx-auto min-h-[720px] max-w-[520px] bg-white px-7 py-8 text-[12px] leading-[1.45] text-[#202020] shadow-sm sm:px-10 sm:py-10" aria-label="Попередній перегляд документа">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl border-2 border-[#1f2937] text-[#1f2937]"><ShieldCheck className="size-7" aria-hidden="true" /></div>
          <p className="text-center text-[14px] font-bold tracking-[0.06em]">ЛУЦЬКА МІСЬКА РАДА</p>
          <p className="mt-1 text-center text-[11px] font-bold tracking-[0.04em]">ДЕПАРТАМЕНТ ЖИТЛОВО-КОМУНАЛЬНОГО ГОСПОДАРСТВА</p>
          <p className="mt-5 text-center text-[17px] font-bold">НАКАЗ</p>
          <div className="mt-8 text-[13px] leading-6"><p>Про затвердження</p><p>зведеного кошторису</p></div>
          <p className="mt-12 text-center text-[13px]">НАКАЗУЮ:</p>
          <div className="mt-8 space-y-4 text-justify text-[12px] leading-6">
            <p>{values.orderParagraph1 || "Текст вступного абзацу"}</p>
            <p className="pl-5">— {values.orderParagraph2 || <span className="text-slate-400">Абзац про проєкт</span>}</p>
            <p className="pl-5">{values.orderParagraph3 || <span className="text-slate-400">Абзац про організацію</span>}</p>
            <p className="pl-5">{values.orderParagraph4 || <span className="text-slate-400">Абзац про інженера</span>}</p>
          </div>
          <div className="mt-20 flex items-end justify-between gap-5 text-[12px]"><span>Директор департаменту</span><span className="font-semibold">Василь ЛІЩУК</span></div>
          <p className="mt-14 text-[11px]">Яворський Віктор&nbsp;&nbsp;773 162</p>
        </div>
      </div>
      <p className="mt-3 px-1 text-xs leading-5 text-muted-foreground">Попередній перегляд допомагає перевірити зміст і порядок блоків. Фінальна верстка формується у DOCX-шаблоні.</p>
    </aside>
  );
}

function ParseResultBanner({ result }: { result: Avk5ParseResult }) {
  const hasErrors = result.errors.length > 0 || result.extractionStatus !== "extracted";
  const warningMessages = [...new Set(result.warnings.filter((warning) => !warning.code.includes("ITEM")).map((warning) => warningMessage(warning.code)))];
  const visibleEvidence = result.evidence.filter((item) => !["estimate-item", "estimate-number", "prepared-by"].includes(item.section));

  return (
    <div className="border-b px-6 py-5 sm:px-8" role="status" aria-live="polite">
      <div className={hasErrors ? "rounded-2xl border border-primary/25 bg-cream px-4 py-4" : "rounded-2xl border border-success/20 bg-accent px-4 py-4"}>
        <div className="flex items-start gap-3">
          {hasErrors ? <TriangleAlert className="mt-0.5 size-5 shrink-0 text-primary-hover" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold">{hasErrors ? "Кошторис прочитано, але потрібна перевірка" : "Кошторис успішно прочитано"}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">RTF декодовано у пам’яті. Статус вилучення: {extractionStatusLabel(result.extractionStatus)}.</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Тип документа: <span className="font-medium text-foreground">{documentTypeLabel(result.data.documentType)}</span></p>
            {warningMessages.length > 0 && <ul className="mt-3 space-y-1 text-xs text-foreground">{warningMessages.map((message) => <li key={message}>• {message}</li>)}</ul>}
            {result.errors.length > 0 && <p className="mt-3 text-xs font-medium text-primary-hover">Підсумки у джерелі не збігаються — перевірте суму.</p>}
          </div>
        </div>
        {visibleEvidence.length > 0 && <details className="mt-4 border-t border-current/10 pt-3 text-xs"><summary className="cursor-pointer font-semibold">Показати джерело реквізитів наказу</summary><ul className="mt-2 space-y-1.5 text-muted-foreground">{visibleEvidence.map((item) => <li key={`${item.section}-${item.paragraphIndex}`}><span className="font-medium text-foreground">{item.label}:</span> {item.matchedText ?? item.text}</li>)}</ul></details>}
      </div>
    </div>
  );
}

function warningMessage(code: Avk5ParseResult["warnings"][number]["code"]): string {
  const messages: Record<typeof code, string> = {
    MISSING_PROJECT_NAME: "Назву проєкту не знайдено — поле залишено порожнім.",
    MISSING_FINAL_TOTAL: "Фінальну суму не знайдено — перевірте її вручну.",
    MISSING_PROJECT_ORGANIZATION: "Проєктну організацію не зазначено у джерелі.",
    MISSING_CHIEF_PROJECT_ENGINEER: "Головного інженера проєкту не знайдено.",
    MISSING_APPROVAL_SUMMARY: "Не знайдено підсумок у блоці затвердження.",
    MISSING_ESTIMATE_TABLE_TOTAL: "Не знайдено підсумок таблиці кошторису.",
    MISSING_ESTIMATE_ITEMS: "Окремі позиції кошторису не знайдено — список залишено порожнім.",
    MISSING_ITEM_FIELD: "Для частини позицій у джерелі відсутні кількість або ціна — поля залишено порожніми.",
    AMBIGUOUS_FINAL_TOTAL: "У джерелі знайдено суперечливі фінальні суми — виберіть правильну вручну.",
    MISSING_ESTIMATE_NUMBER: "Номер кошторису не знайдено у заголовку документа.",
    MISSING_PREPARED_BY: "Підписанта або укладача кошторису не знайдено.",
    UNSUPPORTED_DOCUMENT_TYPE: "RTF прочитано, але тип AVK-5 документа не розпізнано.",
  };
  return messages[code];
}

function extractionStatusLabel(status: Avk5ParseResult["extractionStatus"]): string {
  return { extracted: "дані вилучено", partial: "дані вилучено частково", unsupported: "тип документа не розпізнано" }[status];
}

function documentTypeLabel(type: Avk5ParseResult["data"]["documentType"]): string {
  return {
    "local-estimate": "локальний кошторис",
    "object-estimate": "об’єктний кошторис",
    "consolidated-estimate": "зведений кошторис",
    "resource-estimate": "ресурсний кошторис",
    unknown: "невідомий AVK-5 документ",
  }[type];
}

function fieldStateHint(sourceValue: string | number | null | undefined, edited: boolean): string {
  if (edited) return "Змінено вручну";
  return sourceValue === null || sourceValue === undefined || sourceValue === "" ? "Не знайдено у джерелі" : "Знайдено у джерелі";
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <label className="block space-y-2 text-sm font-semibold"><span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 leading-5"><span className="shrink-0">{label}</span>{hint && <span className={fieldHintClass(hint)}>{hint}</span>}</span>{children}{error && <span className="block text-xs font-normal text-primary-hover">{error}</span>}</label>;
}

function fieldHintClass(hint: string): string {
  if (/не знайдено/i.test(hint)) return "inline-flex whitespace-nowrap rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold leading-4 text-rose-700";
  if (/змінено/i.test(hint)) return "inline-flex whitespace-nowrap rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold leading-4 text-primary-hover";
  if (/автоматично/i.test(hint)) return "inline-flex whitespace-nowrap rounded-full bg-background px-2 py-0.5 text-[10px] font-medium leading-4 text-muted-foreground";
  return "inline-flex whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium leading-4 text-primary-hover";
}
