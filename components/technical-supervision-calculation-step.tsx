"use client";

import React, { useEffect } from "react";
import type { FieldErrors, UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { ArrowLeft, ArrowRight, CheckCircle2, FileCheck2, FileSpreadsheet, Info, LoaderCircle } from "lucide-react";

import type { EstimateContext } from "@/lib/documents/types";
import { contractorProfiles, formatPartyDetails, getContractorProfile, getCustomerProfile } from "@/lib/party-profiles";
import {
  buildTechnicalSupervisionCalculationTemplateValues,
  calculateSupervisionAmountKopecks,
  formatUahKopecks,
  supervisionAmountInWords,
  type TechnicalSupervisionCalculationForm,
} from "@/lib/technical-supervision-calculation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TechnicalSupervisionCalculationStepProps = {
  form: UseFormReturn<TechnicalSupervisionCalculationForm>;
  estimateContext: EstimateContext | null;
  isGenerating: boolean;
  selectedFile: File | null;
  onBack: () => void;
  onSubmit: (values: TechnicalSupervisionCalculationForm) => Promise<void>;
  onInvalid?: (errors: FieldErrors<TechnicalSupervisionCalculationForm>) => void;
};

export function TechnicalSupervisionCalculationStep({
  form,
  estimateContext,
  isGenerating,
  selectedFile,
  onBack,
  onSubmit,
  onInvalid,
}: TechnicalSupervisionCalculationStepProps) {
  const values = useWatch({ control: form.control }) as TechnicalSupervisionCalculationForm;
  const chaptersTotal = useWatch({ control: form.control, name: "chapters1To9TotalUah" });
  const rate = useWatch({ control: form.control, name: "calculationRatePercent" });

  const handleContractorProfileChange = (nextProfileId: TechnicalSupervisionCalculationForm["contractorProfileId"]) => {
    const manualFields: Array<keyof TechnicalSupervisionCalculationForm> = ["contractorDetails", "contractorSignatureTitle", "contractorSignature"];
    const hasManualChanges = manualFields.some((field) => Boolean(form.formState.dirtyFields[field]));
    if (hasManualChanges && !window.confirm("Заміна профілю перезапише вручну змінені реквізити виконавця. Продовжити?")) return;

    const profile = getContractorProfile(nextProfileId);
    form.setValue("contractorProfileId", nextProfileId, { shouldDirty: false, shouldValidate: true });
    form.setValue("contractorDetails", formatPartyDetails(profile), { shouldDirty: false, shouldValidate: true });
    form.setValue("contractorSignatureTitle", profile.signaturePosition, { shouldDirty: false, shouldValidate: true });
    form.setValue("contractorSignature", profile.signatureName, { shouldDirty: false, shouldValidate: true });
  };

  useEffect(() => {
    if (!chaptersTotal.trim() || !rate.trim()) {
      form.setValue("supervisionAmountUah", "", { shouldDirty: false, shouldValidate: false });
      form.setValue("supervisionAmountInWords", "", { shouldDirty: false, shouldValidate: false });
      return;
    }

    try {
      const amount = calculateSupervisionAmountKopecks(chaptersTotal, rate);
      form.setValue("supervisionAmountUah", formatUahKopecks(amount), { shouldDirty: false, shouldValidate: false });
      form.setValue("supervisionAmountInWords", supervisionAmountInWords(amount), { shouldDirty: false, shouldValidate: false });
    } catch {
      form.setValue("supervisionAmountUah", "", { shouldDirty: false, shouldValidate: false });
      form.setValue("supervisionAmountInWords", "", { shouldDirty: false, shouldValidate: false });
    }
  }, [chaptersTotal, form, rate]);

  const preview = safeTemplateValues(values);
  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.82fr)]">
        <Card className="overflow-hidden">
          <div className="border-b p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <Badge className="bg-accent text-primary-hover">Крок 2 · Розрахунок</Badge>
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Підтвердіть розрахунок технічного нагляду.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Дані кошторису перенесено автоматично. Реквізити сторін і номер договору потрібно перевірити та за потреби відредагувати.</p>
              </div>
              <div className="flex w-fit items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
                <FileSpreadsheet className="size-4 text-primary-hover" />
                <span className="max-w-[190px] truncate">{estimateContext?.source.fileName ?? selectedFile?.name ?? "кошторис"}</span>
              </div>
            </div>
          </div>

          <CalculationSourceBanner context={estimateContext} />

          <div className="space-y-7 p-6 sm:p-8">
            <section aria-labelledby="calculation-source-fields-heading">
              <div className="mb-4">
                <h3 id="calculation-source-fields-heading" className="text-sm font-semibold">Дані кошторису</h3>
                <p className="mt-1 text-xs text-muted-foreground">Сума по главах 1–9 є базою розрахунку. Ставка 1,1% не змішується з джерельною надбавкою AVK-5.</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Назва об’єкта" hint={sourceHint(estimateContext?.project.name.value, Boolean(form.formState.dirtyFields.projectName))} error={form.formState.errors.projectName?.message}>
                  <Input {...form.register("projectName")} aria-invalid={Boolean(form.formState.errors.projectName)} />
                </Field>
                <Field label="Всього по зведеному кошторисному розрахунку, грн" hint={sourceHint(estimateContext?.totals.consolidated.value, Boolean(form.formState.dirtyFields.consolidatedTotalUah))} error={form.formState.errors.consolidatedTotalUah?.message}>
                  <Input {...form.register("consolidatedTotalUah")} inputMode="decimal" placeholder="264 325,00" aria-invalid={Boolean(form.formState.errors.consolidatedTotalUah)} />
                </Field>
                <Field label="Разом по главах 1–9, грн" hint={sourceHint(estimateContext?.totals.chapters1To9.value, Boolean(form.formState.dirtyFields.chapters1To9TotalUah))} error={form.formState.errors.chapters1To9TotalUah?.message}>
                  <Input {...form.register("chapters1To9TotalUah")} inputMode="decimal" placeholder="177 135,00" aria-invalid={Boolean(form.formState.errors.chapters1To9TotalUah)} />
                </Field>
                <Field label="Ставка розрахунку, %" hint="Редагується" error={form.formState.errors.calculationRatePercent?.message}>
                  <Input {...form.register("calculationRatePercent")} inputMode="decimal" placeholder="1,1" aria-invalid={Boolean(form.formState.errors.calculationRatePercent)} />
                </Field>
                <Field label="Розрахована вартість технічного нагляду, грн" hint="Автоматично">
                  <Input {...form.register("supervisionAmountUah")} readOnly className="bg-background" />
                </Field>
                <Field label="Сума українською" hint="Автоматично">
                  <Textarea {...form.register("supervisionAmountInWords")} readOnly className="min-h-24 bg-background" />
                </Field>
              </div>
            </section>

            <section aria-labelledby="calculation-document-fields-heading">
              <div className="mb-4">
                <h3 id="calculation-document-fields-heading" className="text-sm font-semibold">Реквізити документа</h3>
                <p className="mt-1 text-xs text-muted-foreground">Профілі заповнюють відомі реквізити, але історичні дані потрібно підтвердити та за потреби відредагувати.</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Номер договору" hint={optionalManualHint(values.contractNumber)} error={form.formState.errors.contractNumber?.message}><Input {...form.register("contractNumber")} placeholder="__________" /></Field>
                <Field label="Дата документа" hint={optionalManualHint(values.documentDate)} error={form.formState.errors.documentDate?.message}><Input {...form.register("documentDate")} placeholder="____ __________ 2026" /></Field>
                <Field label="Профіль замовника" hint="Перевірте актуальність реквізитів"><select {...form.register("customerProfileId")} disabled className="h-11 w-full min-w-0 rounded-xl border bg-background px-3 text-sm font-normal outline-none disabled:cursor-not-allowed disabled:opacity-80" aria-label="Профіль замовника"><option value={getCustomerProfile().id}>{getCustomerProfile().displayName}</option></select></Field>
                <Field label="Реквізити замовника" hint={manualHint(values.customerDetails)} error={form.formState.errors.customerDetails?.message}><Textarea {...form.register("customerDetails")} className="min-h-32 break-words" placeholder="Назва, адреса, рахунок, код та контакти" /></Field>
                <Field label="Директор замовника" hint={manualHint(values.customerDirector)} error={form.formState.errors.customerDirector?.message}><Input {...form.register("customerDirector")} placeholder="ПІБ директора" /></Field>
                <Field label="Профіль виконавця" hint="Перевірте актуальність реквізитів"><select value={values.contractorProfileId} onChange={(event) => handleContractorProfileChange(event.target.value as TechnicalSupervisionCalculationForm["contractorProfileId"])} className="h-11 w-full min-w-0 rounded-xl border bg-background px-3 text-sm font-normal outline-none" aria-label="Профіль виконавця">{contractorProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}</select><p className="break-words text-xs font-normal leading-5 text-muted-foreground">{getContractorProfile(values.contractorProfileId).legalName}</p></Field>
                <Field label="Реквізити виконавця" hint={manualHint(values.contractorDetails)} error={form.formState.errors.contractorDetails?.message}><Textarea {...form.register("contractorDetails")} className="min-h-32 break-words" placeholder="Назва, адреса, рахунок, код, банк та контакти" /></Field>
                <Field label="Посада виконавця" hint={manualHint(values.contractorSignatureTitle)} error={form.formState.errors.contractorSignatureTitle?.message}><Input {...form.register("contractorSignatureTitle")} placeholder="Наприклад, ФОП" /></Field>
                <Field label="Підпис виконавця" hint={manualHint(values.contractorSignature)} error={form.formState.errors.contractorSignature?.message}><Input {...form.register("contractorSignature")} placeholder="ПІБ для підпису" /></Field>
              </div>
            </section>

            <div className="flex items-start gap-2 rounded-xl bg-background px-3 py-2.5 text-xs leading-5 text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0 text-primary-hover" />Фінальна сума й слова перераховуються з бази та ставки. Відредаговані джерельні поля зберігаються під час переходу між кроками.</div>
          </div>

          <div className="flex flex-col-reverse justify-between gap-3 border-t bg-background px-6 py-5 sm:flex-row sm:items-center sm:px-8"><Button type="button" variant="ghost" onClick={onBack}><ArrowLeft className="size-4" /> Назад</Button><Button type="submit" variant="primary" disabled={isGenerating}>{isGenerating ? <LoaderCircle className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}{isGenerating ? "Формуємо документ…" : "Сформувати розрахунок"}<ArrowRight className="size-4" /></Button></div>
        </Card>

        <CalculationPreview values={preview} />
      </div>
    </form>
  );
}

function CalculationSourceBanner({ context }: { context: EstimateContext | null }) {
  const sourceRate = context?.totals.sourceSupervisionRate.value?.value;
  const sourceAllowance = context?.totals.sourceSupervisionAllowance.value?.text;
  const evidence = context?.source.evidence.filter((item) => ["chapters1-to-9-total", "source-supervision-rate", "source-supervision-allowance"].includes(item.section)) ?? [];

  return <div className="border-b px-6 py-5 sm:px-8" role="status" aria-live="polite"><div className="rounded-2xl border border-success/20 bg-accent px-4 py-4"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /><div className="min-w-0"><p className="text-sm font-semibold">Кошторис прочитано для розрахунку</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Джерельна надбавка {sourceRate === undefined || sourceRate === null ? "не знайдена" : `${sourceRate.toLocaleString("uk-UA")} %`}{sourceAllowance ? ` (${sourceAllowance} тис. грн)` : ""} збережена як evidence і не використовується замість ставки розрахунку 1,1%.</p>{evidence.length > 0 && <details className="mt-3 border-t border-current/10 pt-3 text-xs"><summary className="cursor-pointer font-semibold">Показати джерело розрахунку</summary><ul className="mt-2 space-y-1.5 text-muted-foreground">{evidence.map((item) => <li key={`${item.section}-${item.paragraphIndex}`}><span className="font-medium text-foreground">{item.label}:</span> {item.matchedText ?? item.text}</li>)}</ul></details>}</div></div></div></div>;
}

function CalculationPreview({ values }: { values: Record<string, string> | null }) {
  return <aside className="lg:sticky lg:top-6" aria-label="Живий перегляд розрахунку технічного нагляду"><div className="mb-3 flex items-center justify-between px-1"><div><p className="text-sm font-semibold">Живий перегляд</p><p className="mt-1 text-xs text-muted-foreground">Орієнтовна візуалізація офіційного розрахунку</p></div><Badge className="bg-accent text-primary-hover">DOCX</Badge></div><div className="overflow-hidden rounded-[26px] border bg-background p-3 shadow-sm sm:p-5"><div className="mx-auto min-h-[720px] max-w-[560px] overflow-hidden bg-white px-4 py-8 text-[9px] leading-[1.35] text-[#202020] shadow-sm sm:px-7 sm:py-10 sm:text-[10px]" aria-label="Попередній перегляд розрахунку"><div className="text-right font-bold leading-4">Додаток<br />до договору на виконання<br />технічного нагляду<br />від {values?.documentDate || "«____» __________ 2026 року"}<br />№ {values?.contractNumber || "__________"}</div><p className="mt-16 text-center text-[13px] font-bold">РОЗРАХУНОК КОШТОРИСНОЇ ВАРТОСТІ ТЕХНІЧНОГО НАГЛЯДУ</p><div className="mt-7 overflow-x-auto"><table className="w-full min-w-[460px] table-fixed border-collapse text-center"><thead><tr><th rowSpan={2} className="w-[32%] border p-1 align-middle">Найменування об’єкта</th><th colSpan={3} className="border p-1">Вартість робіт</th></tr><tr><th className="w-[23%] border p-1 font-normal">Всього по зведеному кошторисному розрахунку, грн</th><th className="w-[25%] border p-1 font-normal">З них:<br />разом по главах 1–9</th><th className="w-[20%] border p-1 font-normal">Технічний нагляд, {values?.calculationRatePercent || "1,1"}%, грн</th></tr><tr><th className="border p-1">1</th><th className="border p-1">2</th><th className="border p-1">3</th><th className="border p-1">4</th></tr></thead><tbody><tr><td className="break-words border p-2 text-left font-semibold italic">«{values?.projectName || "Назва об’єкта"}»</td><td className="break-words border p-2">{values?.consolidatedTotalUah || "—"}</td><td className="break-words border p-2">{values?.chapters1To9TotalUah || "—"}</td><td className="break-words border p-2">{values?.supervisionAmountUah || "—"}</td></tr><tr><td className="border p-2 text-left font-bold">Разом:</td><td className="border p-2 font-bold" colSpan={2}>{values?.chapters1To9Expression || "—"}</td><td className="border p-2 font-bold">{values?.supervisionAmountUah || "—"}</td></tr></tbody></table></div><p className="mt-8 break-words font-bold">Всього: {values?.supervisionAmountUah || "—"} грн ({values?.supervisionAmountInWords || "сума українською"}) без ПДВ</p><table className="mt-10 w-full table-fixed border-collapse"><tbody><tr><td className="w-1/2 border p-3 align-top"><p className="text-center font-semibold">ЗАМОВНИК</p><p className="mt-3 whitespace-pre-line break-words">{values?.customerDetails || "Реквізити замовника"}</p><p className="mt-6">Директор</p><p className="mt-5 break-words">________________ {values?.customerDirector || ""}</p><p>М.П.</p></td><td className="w-1/2 border p-3 align-top"><p className="text-center font-semibold">ВИКОНАВЕЦЬ</p><p className="mt-3 whitespace-pre-line break-words">{values?.contractorDetails || "Реквізити виконавця"}</p><p className="mt-6">{values?.contractorSignatureTitle || "Посада"}</p><p className="mt-5 break-words">________________ {values?.contractorSignature || ""}</p><p>М.П.</p></td></tr></tbody></table></div></div><p className="mt-3 px-1 text-xs leading-5 text-muted-foreground">Попередній перегляд відтворює структуру таблиці, фінансові колонки та підписні блоки. Фінальна верстка формується у DOCX-шаблоні.</p></aside>;
}

function safeTemplateValues(values: TechnicalSupervisionCalculationForm): Record<string, string> | null {
  try {
    return buildTechnicalSupervisionCalculationTemplateValues(values);
  } catch {
    return null;
  }
}

function sourceHint(sourceValue: unknown, edited: boolean): string {
  if (edited) return "Змінено вручну";
  return sourceValue === null || sourceValue === undefined || sourceValue === "" ? "Не знайдено у джерелі" : "Знайдено у джерелі";
}

function manualHint(value: string): string {
  return value.trim() ? "Підтверджено вручну" : "Потрібно підтвердити";
}

function optionalManualHint(value: string): string {
  return value.trim() ? "Підтверджено вручну" : "Не заповнено — можна вписати вручну";
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <label className="block min-w-0 space-y-2 text-sm font-semibold"><span className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1 leading-5"><span className="min-w-0 break-words">{label}</span>{hint && <span className={hintClass(hint)}>{hint}</span>}</span>{children}{error && <span className="block text-xs font-normal text-primary-hover">{error}</span>}</label>;
}

function hintClass(hint: string): string {
  const layout = "inline-flex max-w-full shrink-0 whitespace-normal break-words rounded-full px-2 py-0.5 text-[10px] leading-4";
  if (/не знайдено|потрібно підтвердити/i.test(hint)) return `${layout} bg-danger-soft font-semibold text-danger`;
  if (/змінено|підтверджено/i.test(hint)) return `${layout} bg-cream font-semibold text-primary-hover`;
  return `${layout} bg-accent font-medium text-primary-hover`;
}

