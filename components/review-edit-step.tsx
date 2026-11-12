"use client";

import React, { useEffect, useRef } from "react";
import type { FieldArrayWithId, FieldErrors, UseFormReturn } from "react-hook-form";
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
  fields: FieldArrayWithId<OrderForm, "lines", "id">[];
  form: UseFormReturn<OrderForm>;
  parseResult: Avk5ParseResult | null;
  isGenerating: boolean;
  selectedFile: File | null;
  onBack: () => void;
  onSubmit: (values: OrderForm) => Promise<void>;
  onInvalid?: (errors: FieldErrors<OrderForm>) => void;
};

export function ReviewEditStep({
  fields,
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
                <Field label="Назва проєкту" error={form.formState.errors.projectName?.message}>
                  <Input {...form.register("projectName")} aria-invalid={Boolean(form.formState.errors.projectName)} />
                </Field>
                <Field label="Сума, тис. грн" error={form.formState.errors.estimatedAmountThousandsUah?.message}>
                  <Input {...form.register("estimatedAmountThousandsUah")} inputMode="decimal" placeholder="197,271" aria-invalid={Boolean(form.formState.errors.estimatedAmountThousandsUah)} />
                </Field>
                <Field label="Проєктна організація">
                  <Input {...form.register("projectOrganization")} placeholder="Не зазначено у джерелі" />
                </Field>
                <Field label="Головний інженер проєкту">
                  <Input {...form.register("chiefProjectEngineer")} placeholder="Не знайдено" />
                </Field>
                <Field label="Сертифікат">
                  <Input {...form.register("certificate")} placeholder="Не зазначено у джерелі" />
                </Field>
                <Field label="Сума українською" hint="Перераховується автоматично">
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

            <section aria-labelledby="positions-heading">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h3 id="positions-heading" className="text-sm font-semibold">Позиції замовлення</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{fields.length ? `${fields.length} позицій із кошторису` : "У кошторисі окремих позицій не знайдено"}</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border">
                <div className="hidden grid-cols-[minmax(0,1fr)_68px_86px_125px] gap-3 bg-background px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:grid"><span>Найменування</span><span>Од.</span><span>К-сть</span><span>Ціна, тис. грн</span></div>
                <div className="divide-y">
                  {fields.map((field, index) => <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_68px_86px_125px] sm:items-center" key={field.id}>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {field.code && <Badge className="bg-background font-mono text-[10px]">{field.code}</Badge>}
                        <span className="text-[11px] text-muted-foreground">Дані з кошторису</span>
                      </div>
                      <label className="block space-y-1"><span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:sr-only">Найменування</span><Input className="h-10" {...form.register(`lines.${index}.name`)} /></label>
                    </div>
                    <label className="space-y-1 sm:space-y-0"><span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:sr-only">Од.</span><Input className="h-10" {...form.register(`lines.${index}.unit`)} /></label>
                    <label className="space-y-1 sm:space-y-0"><span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:sr-only">К-сть</span><Input className="h-10" type="number" step="any" placeholder="Не зазначено" {...form.register(`lines.${index}.quantity`, { setValueAs: (value) => value == null || value === "" ? null : Number(value) })} /></label>
                    <div className="space-y-2"><label className="block space-y-1"><span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:sr-only">Ціна, тис. грн</span><Input className="h-10" type="number" step="any" placeholder="Не зазначено" {...form.register(`lines.${index}.price`, { setValueAs: (value) => value == null || value === "" ? null : Number(value) })} /></label><p className="text-[11px] leading-4 text-muted-foreground">У кошторисі: {field.sourceTotalThousandsUah ? `${field.sourceTotalThousandsUah} тис. грн` : "не зазначено"}</p></div>
                    {field.sourceMissingFields.length > 0 && <p className="col-span-full rounded-xl bg-cream px-3 py-2 text-xs leading-5 text-foreground">У джерелі не зазначено: {field.sourceMissingFields.map(itemFieldLabel).join(", ")}. Поля залишено порожніми — їх можна уточнити перед формуванням.</p>}
                    {form.formState.errors.lines?.[index] && <p className="col-span-full text-xs font-normal text-primary-hover">{form.formState.errors.lines[index]?.name?.message ?? form.formState.errors.lines[index]?.unit?.message ?? form.formState.errors.lines[index]?.quantity?.message ?? form.formState.errors.lines[index]?.price?.message}</p>}
                  </div>)}
                </div>
              </div>
              {fields.length === 0 && <p className="mt-3 rounded-xl bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">У завантаженому кошторисі окремі позиції не знайдено. Нові позиції не додаються вручну, щоб не змінювати дані джерела.</p>}
            </section>

            <div className="grid gap-5 sm:grid-cols-[1fr_240px] sm:items-end">
              <Field label="Примітка"><Textarea {...form.register("note")} placeholder="Необов’язково" /></Field>
              <div className="rounded-2xl bg-accent p-5"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Сума з кошторису</p><p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">{parseResult?.data.itemsTotalThousandsUah === null || parseResult?.data.itemsTotalThousandsUah === undefined ? "—" : `${parseResult.data.itemsTotalThousandsUah.toLocaleString("uk-UA", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} тис.`}</p><p className="mt-1 text-xs text-muted-foreground">Редагування полів не змінює файл-джерело</p></div>
            </div>

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
  const hasErrors = result.errors.length > 0;
  const warningMessages = [...new Set(result.warnings.map((warning) => warningMessage(warning.code)))];

  return (
    <div className="border-b px-6 py-5 sm:px-8" role="status" aria-live="polite">
      <div className={hasErrors ? "rounded-2xl border border-primary/25 bg-cream px-4 py-4" : "rounded-2xl border border-success/20 bg-accent px-4 py-4"}>
        <div className="flex items-start gap-3">
          {hasErrors ? <TriangleAlert className="mt-0.5 size-5 shrink-0 text-primary-hover" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold">{hasErrors ? "Кошторис прочитано, але потрібна перевірка" : "Кошторис успішно прочитано"}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Дані витягнуто з RTF у пам’яті. Перевірте поля перед формуванням документа.</p>
            {warningMessages.length > 0 && <ul className="mt-3 space-y-1 text-xs text-foreground">{warningMessages.map((message) => <li key={message}>• {message}</li>)}</ul>}
            {result.errors.length > 0 && <p className="mt-3 text-xs font-medium text-primary-hover">Підсумки у джерелі не збігаються — перевірте суму.</p>}
          </div>
        </div>
        {result.evidence.length > 0 && <details className="mt-4 border-t border-current/10 pt-3 text-xs"><summary className="cursor-pointer font-semibold">Показати джерело витягнутих даних</summary><ul className="mt-2 space-y-1.5 text-muted-foreground">{result.evidence.map((item) => <li key={`${item.section}-${item.paragraphIndex}`}><span className="font-medium text-foreground">{item.label}:</span> {item.matchedText ?? item.text}</li>)}</ul></details>}
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
  };
  return messages[code];
}

function itemFieldLabel(field: string): string {
  return { unit: "одиницю виміру", quantity: "кількість", price: "ціну" }[field] ?? field;
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <label className="block space-y-2 text-sm font-semibold"> <span>{label}{hint && <span className="ml-2 text-[11px] font-normal text-muted-foreground">{hint}</span>}</span>{children}{error && <span className="block text-xs font-normal text-primary-hover">{error}</span>}</label>;
}
