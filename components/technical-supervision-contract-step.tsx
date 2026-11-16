"use client";

import React, { useEffect } from "react";
import type { FieldErrors, UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { ArrowLeft, ArrowRight, FileCheck2, FileSpreadsheet, Info, LoaderCircle, TriangleAlert } from "lucide-react";

import type { EstimateContext } from "@/lib/documents/types";
import { contractorProfiles, formatPartyDetails, getContractorProfile, getCustomerProfile } from "@/lib/party-profiles";
import { contractPreviewSections } from "@/lib/technical-supervision-contract-content";
import { buildTechnicalSupervisionContractTemplateValues, CONTRACT_APPENDIX_REFERENCE, EMPTY_CONTRACT_END_DATE_PLACEHOLDER, EMPTY_CONTRACT_NUMBER_PLACEHOLDER, EMPTY_CONTRACT_SIGNING_DATE_PLACEHOLDER, HISTORICAL_CONTRACTOR_TAX_STATUS, type TechnicalSupervisionContractForm } from "@/lib/technical-supervision-contract";
import { calculateSupervisionAmountKopecks, formatUahKopecks, supervisionAmountInWords } from "@/lib/technical-supervision-calculation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TechnicalSupervisionContractStepProps = {
  form: UseFormReturn<TechnicalSupervisionContractForm>;
  estimateContext: EstimateContext | null;
  isGenerating: boolean;
  selectedFile: File | null;
  onBack: () => void;
  onSubmit: (values: TechnicalSupervisionContractForm) => Promise<void>;
  onInvalid?: (errors: FieldErrors<TechnicalSupervisionContractForm>) => void;
};

export function TechnicalSupervisionContractStep({ form, estimateContext, isGenerating, selectedFile, onBack, onSubmit, onInvalid }: TechnicalSupervisionContractStepProps) {
  const values = useWatch({ control: form.control }) as TechnicalSupervisionContractForm;
  const chaptersTotal = useWatch({ control: form.control, name: "chapters1To9TotalUah" });
  const rate = useWatch({ control: form.control, name: "calculationRatePercent" });

  const handleContractorProfileChange = (nextProfileId: TechnicalSupervisionContractForm["contractorProfileId"]) => {
    const manualFields: Array<keyof TechnicalSupervisionContractForm> = ["contractorName", "contractorRegistrationDetails", "contractorAuthorizationBasis", "contractorCertificate", "contractorDetails", "contractorSignatureTitle", "contractorSignature", "contractorTaxStatus"];
    const hasManualChanges = manualFields.some((field) => Boolean(form.formState.dirtyFields[field]));
    if (hasManualChanges && !window.confirm("Заміна профілю перезапише вручну змінені реквізити виконавця. Продовжити?")) return;

    const profile = getContractorProfile(nextProfileId);
    form.setValue("contractorProfileId", nextProfileId, { shouldDirty: false, shouldValidate: true });
    form.setValue("contractorName", profile.legalName, { shouldDirty: false, shouldValidate: true });
    form.setValue("contractorRegistrationDetails", `код ЄДРПОУ ${profile.identificationCode}`, { shouldDirty: false, shouldValidate: true });
    form.setValue("contractorAuthorizationBasis", profile.authorizationBasis?.value ?? "", { shouldDirty: false, shouldValidate: true });
    form.setValue("contractorCertificate", profile.certificate ?? "", { shouldDirty: false, shouldValidate: true });
    form.setValue("contractorDetails", formatPartyDetails(profile), { shouldDirty: false, shouldValidate: true });
    form.setValue("contractorSignatureTitle", profile.signaturePosition, { shouldDirty: false, shouldValidate: true });
    form.setValue("contractorSignature", profile.signatureName, { shouldDirty: false, shouldValidate: true });
    form.setValue("contractorTaxStatus", profile.taxStatus?.trim() || HISTORICAL_CONTRACTOR_TAX_STATUS, { shouldDirty: false, shouldValidate: true });
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

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.82fr)]">
        <Card className="overflow-hidden">
          <div className="border-b p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <Badge className="bg-accent text-primary-hover">Крок 2 · Договір</Badge>
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Підтвердіть договір технічного нагляду.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Кошторисні дані синхронізовані з розрахунком. Реквізити сторін, податковий статус і сертифікат потрібно перевірити та за потреби відредагувати.</p>
              </div>
              <div className="flex w-fit items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs font-medium text-muted-foreground"><FileSpreadsheet className="size-4 text-primary-hover" /><span className="max-w-[190px] truncate">{estimateContext?.source.fileName ?? selectedFile?.name ?? "кошторис"}</span></div>
            </div>
          </div>

          <ContractReviewWarning context={estimateContext} />

          <div className="space-y-7 p-6 sm:p-8">
            <section aria-labelledby="contract-source-heading">
              <SectionHeading id="contract-source-heading" title="Дані кошторису" description="Ці поля походять з одного EstimateContext і використовуються також у Phase 2." />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Назва об’єкта" hint={sourceHint(estimateContext?.project.name.value, Boolean(form.formState.dirtyFields.projectName))} error={form.formState.errors.projectName?.message}><Input {...form.register("projectName")} /></Field>
                <Field label="База: глави 1–9, грн" hint={sourceHint(estimateContext?.totals.chapters1To9.value, Boolean(form.formState.dirtyFields.chapters1To9TotalUah))} error={form.formState.errors.chapters1To9TotalUah?.message}><Input {...form.register("chapters1To9TotalUah")} inputMode="decimal" /></Field>
                <Field label="Ставка розрахунку, %" hint={historicalHint(values.calculationRatePercent, Boolean(form.formState.dirtyFields.calculationRatePercent))} error={form.formState.errors.calculationRatePercent?.message}><Input {...form.register("calculationRatePercent")} inputMode="decimal" /></Field>
                <Field label="Сума договору, грн" hint="Розраховано автоматично"><Input {...form.register("supervisionAmountUah")} readOnly className="bg-background" /></Field>
                <Field label="Сума українською" hint="Розраховано автоматично"><Textarea {...form.register("supervisionAmountInWords")} readOnly className="min-h-24 bg-background" /></Field>
              </div>
            </section>

            <section aria-labelledby="contract-details-heading">
              <SectionHeading id="contract-details-heading" title="Реквізити договору" description="Номер і дати є необов’язковими: їх можна вписати вручну після друку. Посилання на додаток заповнюється автоматично." />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Номер договору" hint={optionalManualHint(values.contractNumber)} error={form.formState.errors.contractNumber?.message}><Input {...form.register("contractNumber")} placeholder={EMPTY_CONTRACT_NUMBER_PLACEHOLDER} /></Field>
                <Field label="Дата договору" hint={optionalManualHint(values.documentDate)} error={form.formState.errors.documentDate?.message}><Input {...form.register("documentDate")} placeholder="____ __________ 2026" /></Field>
                <Field label="Діє до" hint={optionalManualHint(values.contractEndDate)} error={form.formState.errors.contractEndDate?.message}><Input {...form.register("contractEndDate")} placeholder={EMPTY_CONTRACT_END_DATE_PLACEHOLDER} /></Field>
                <Field label="Посилання на додаток" hint={autoHint(values.appendixReference, Boolean(form.formState.dirtyFields.appendixReference))} error={form.formState.errors.appendixReference?.message}><Input {...form.register("appendixReference")} /></Field>
              </div>
            </section>

            <section aria-labelledby="contract-parties-heading">
              <SectionHeading id="contract-parties-heading" title="Сторони та реквізити" description="Профілі заповнюють відомі реквізити, але історичні дані потрібно перевірити та за потреби відредагувати." />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Профіль замовника" hint="Автозаповнено з профілю"><select {...form.register("customerProfileId")} disabled className="h-11 w-full min-w-0 rounded-xl border bg-background px-3 text-sm font-normal outline-none disabled:cursor-not-allowed disabled:opacity-80" aria-label="Профіль замовника"><option value={getCustomerProfile().id}>{getCustomerProfile().displayName}</option></select></Field>
                <Field label="Назва замовника" hint={profileHint(values.customerName, Boolean(form.formState.dirtyFields.customerName))} error={form.formState.errors.customerName?.message}><Input {...form.register("customerName")} /></Field>
                <Field label="Уповноважений представник замовника" hint={profileHint(values.customerRepresentative, Boolean(form.formState.dirtyFields.customerRepresentative))} error={form.formState.errors.customerRepresentative?.message}><Input {...form.register("customerRepresentative")} /></Field>
                <Field label="Підстава повноважень замовника" hint={historicalHint(values.customerLegalBasis, Boolean(form.formState.dirtyFields.customerLegalBasis))} error={form.formState.errors.customerLegalBasis?.message}><Input {...form.register("customerLegalBasis")} /></Field>
                <Field label="Профіль виконавця" hint="Автозаповнено з профілю"><select value={values.contractorProfileId} onChange={(event) => handleContractorProfileChange(event.target.value as TechnicalSupervisionContractForm["contractorProfileId"])} className="h-11 w-full min-w-0 rounded-xl border bg-background px-3 text-sm font-normal outline-none" aria-label="Профіль виконавця">{contractorProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}</select><p className="break-words text-xs font-normal leading-5 text-muted-foreground">{getContractorProfile(values.contractorProfileId).legalName}</p></Field>
                <Field label="Назва виконавця" hint={profileHint(values.contractorName, Boolean(form.formState.dirtyFields.contractorName))} error={form.formState.errors.contractorName?.message}><Input {...form.register("contractorName")} /></Field>
                <Field label="Реєстраційні дані виконавця" hint={profileHint(values.contractorRegistrationDetails, Boolean(form.formState.dirtyFields.contractorRegistrationDetails))} error={form.formState.errors.contractorRegistrationDetails?.message}><Textarea {...form.register("contractorRegistrationDetails")} className="min-h-24" /></Field>
                <Field label="Підстава повноважень/реєстрації виконавця" hint={profileHint(values.contractorAuthorizationBasis, Boolean(form.formState.dirtyFields.contractorAuthorizationBasis))} error={form.formState.errors.contractorAuthorizationBasis?.message}><Textarea {...form.register("contractorAuthorizationBasis")} className="min-h-24" /></Field>
                <Field label="Кваліфікаційний сертифікат" hint={contractorCertificateHint(values.contractorProfileId, Boolean(form.formState.dirtyFields.contractorCertificate))} error={form.formState.errors.contractorCertificate?.message}><Input {...form.register("contractorCertificate")} /></Field>
                <Field label="Податковий статус замовника" hint={historicalTemplateHint(values.customerTaxStatus, Boolean(form.formState.dirtyFields.customerTaxStatus))} error={form.formState.errors.customerTaxStatus?.message}><Input {...form.register("customerTaxStatus")} /></Field>
                <Field label="Податковий статус виконавця" hint={historicalTemplateHint(values.contractorTaxStatus, Boolean(form.formState.dirtyFields.contractorTaxStatus))} error={form.formState.errors.contractorTaxStatus?.message}><Input {...form.register("contractorTaxStatus")} /></Field>
                <Field label="Реквізити замовника" hint={profileHint(values.customerDetails, Boolean(form.formState.dirtyFields.customerDetails))} error={form.formState.errors.customerDetails?.message}><Textarea {...form.register("customerDetails")} className="min-h-32 break-words" placeholder="Адреса, рахунок, код, банк, контакти" /></Field>
                <Field label="Підпис замовника" hint={profileHint(values.customerSignature, Boolean(form.formState.dirtyFields.customerSignature))} error={form.formState.errors.customerSignature?.message}><Input {...form.register("customerSignature")} /></Field>
                <Field label="Посада замовника" hint={profileHint(values.customerSignatureTitle, Boolean(form.formState.dirtyFields.customerSignatureTitle))} error={form.formState.errors.customerSignatureTitle?.message}><Input {...form.register("customerSignatureTitle")} /></Field>
                <Field label="Реквізити виконавця" hint={profileHint(values.contractorDetails, Boolean(form.formState.dirtyFields.contractorDetails))} error={form.formState.errors.contractorDetails?.message}><Textarea {...form.register("contractorDetails")} className="min-h-32 break-words" placeholder="Адреса, рахунок, код, банк, контакти" /></Field>
                <Field label="Посада виконавця" hint={profileHint(values.contractorSignatureTitle, Boolean(form.formState.dirtyFields.contractorSignatureTitle))} error={form.formState.errors.contractorSignatureTitle?.message}><Input {...form.register("contractorSignatureTitle")} /></Field>
                <Field label="Підпис виконавця" hint={profileHint(values.contractorSignature, Boolean(form.formState.dirtyFields.contractorSignature))} error={form.formState.errors.contractorSignature?.message}><Input {...form.register("contractorSignature")} /></Field>
              </div>
            </section>

            <div className="flex items-start gap-2 rounded-xl bg-background px-3 py-2.5 text-xs leading-5 text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0 text-primary-hover" />Фінансові значення перераховуються з бази глав 1–9 і ставки. Історичні правові та податкові формулювання потрібно перевірити перед підписанням.</div>
          </div>

          <div className="flex flex-col-reverse justify-between gap-3 border-t bg-background px-6 py-5 sm:flex-row sm:items-center sm:px-8"><Button type="button" variant="ghost" onClick={onBack}><ArrowLeft className="size-4" /> Назад</Button><Button type="submit" variant="primary" disabled={isGenerating}>{isGenerating ? <LoaderCircle className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}{isGenerating ? "Формуємо договір…" : "Сформувати договір"}<ArrowRight className="size-4" /></Button></div>
        </Card>

        <ContractPreview values={safeTemplateValues(values)} />
      </div>
    </form>
  );
}

function ContractReviewWarning({ context }: { context: EstimateContext | null }) {
  const sourceRate = context?.totals.sourceSupervisionRate.value?.value;
  return <div className="border-b px-6 py-5 sm:px-8"><div className="rounded-2xl border border-warning/30 bg-cream px-4 py-4"><div className="flex items-start gap-3"><TriangleAlert className="mt-0.5 size-5 shrink-0 text-primary-hover" /><div><p className="text-sm font-semibold">Перед підписанням потрібна юридична перевірка</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Шаблон містить історичне посилання на лист Держбуду та податкові формулювання з reference-документа. Вони не вважаються актуально підтвердженими. Джерельна ставка AVK-5 {sourceRate === undefined || sourceRate === null ? "не знайдена" : `${sourceRate.toLocaleString("uk-UA")} %`} збережена окремо й не замінює ставку договору.</p></div></div></div></div>;
}

function ContractPreview({ values }: { values: Record<string, string> | null }) {
  const intro = `${previewValue(values, "customerName", "Замовник")} (далі - Замовник) в особі ${previewValue(values, "customerRepresentative", "представника замовника")}, що діє на підставі ${previewValue(values, "customerLegalBasis", "підстави повноважень")}, з однієї сторони, та ${previewValue(values, "contractorName", "Виконавець")}, що діє на підставі ${previewValue(values, "contractorAuthorizationBasis", "підстави повноважень виконавця")}${previewValue(values, "contractorCertificateClause", "")}, з другої сторони, разом іменовані «Сторони», уклали цей Договір на виконання технічного нагляду (надалі – Договір) про нижчезазначене:`;
  return <aside className="lg:sticky lg:top-6" aria-label="Живий перегляд договору технічного нагляду"><div className="mb-3 flex items-center justify-between px-1"><div><p className="text-sm font-semibold">Живий перегляд</p><p className="mt-1 text-xs text-muted-foreground">Повний текст 12 розділів договору</p></div><Badge className="bg-accent text-primary-hover">DOCX</Badge></div><div className="rounded-[26px] border bg-background p-3 shadow-sm sm:p-5"><div className="mx-auto max-h-[min(78vh,1080px)] max-w-[560px] overflow-y-auto bg-white px-5 py-8 text-[10px] leading-[1.42] text-[#202020] shadow-sm sm:px-8 sm:py-10" aria-label="Попередній перегляд договору"><h3 className="text-center text-[14px] font-bold tracking-[0.18em]">Д О Г О В І Р № {previewValue(values, "contractNumber", "________")}</h3><p className="text-center text-[12px] font-semibold">на виконання технічного нагляду</p><p className="mt-8 flex justify-between gap-4"><span>м. Луцьк</span><span className="text-right">{previewValue(values, "documentDate", EMPTY_CONTRACT_SIGNING_DATE_PLACEHOLDER)}</span></p><p className="mt-8 text-justify">{intro}</p><div className="mt-8 space-y-5">{contractPreviewSections.map((section) => <section key={section.heading} aria-labelledby={`preview-${section.heading.slice(0, 2)}`}><h4 id={`preview-${section.heading.slice(0, 2)}`} className="text-center text-[11px] font-bold">{section.heading}</h4><div className="mt-2 space-y-2">{section.paragraphs.map((paragraph, index) => <p key={`${section.heading}-${index}`} className="whitespace-pre-line break-words text-justify">{resolvePreviewText(paragraph, values)}</p>)}</div></section>)}</div><section className="mt-6" aria-labelledby="preview-signatures"><h4 id="preview-signatures" className="text-center text-[11px] font-bold">12. Юридичні адреси, банківські реквізити і підписи Сторін.</h4><div className="mt-3 grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2"><div className="min-w-0"><p className="font-bold">ЗАМОВНИК</p><p className="mt-2 whitespace-pre-line break-words">{previewValue(values, "customerDetails", "Реквізити замовника")}</p><p className="mt-5 break-words">{previewValue(values, "customerSignatureTitle", "Посада")}</p><p className="mt-4 break-words">________________ {values?.customerSignature || ""}</p><p>М.П.</p></div><div className="min-w-0"><p className="font-bold">ВИКОНАВЕЦЬ</p><p className="mt-2 whitespace-pre-line break-words">{previewValue(values, "contractorDetails", "Реквізити виконавця")}</p><p className="mt-5 break-words">{previewValue(values, "contractorSignatureTitle", "Посада")}</p><p className="mt-4 break-words">________________ {values?.contractorSignature || ""}</p><p>М.П.</p></div></div></section></div></div><p className="mt-3 px-1 text-xs leading-5 text-muted-foreground">Попередній перегляд містить повний стандартний текст. Точна пагінація та Word-верстка формуються затвердженим DOCX-шаблоном.</p></aside>;
}

function previewValue(values: Record<string, string> | null, key: string, fallback: string): string {
  return values?.[key]?.trim() || fallback;
}

function resolvePreviewText(text: string, values: Record<string, string> | null): string {
  const resolved = text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => previewValue(values, key, "________________"));
  return resolved.replace("Додаток: розрахунок кошторисної вартості технічного нагляду.", `Додаток: ${previewValue(values, "appendixReference", CONTRACT_APPENDIX_REFERENCE)}.`);
}

function SectionHeading({ id, title, description }: { id: string; title: string; description: string }) {
  return <div className="mb-4"><h3 id={id} className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>;
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <label className="block min-w-0 space-y-2 text-sm font-semibold"><span className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1 leading-5"><span className="min-w-0 break-words">{label}</span>{hint && <span className={hintClass(hint)}>{hint}</span>}</span>{children}{error && <span className="block text-xs font-normal text-primary-hover">{error}</span>}</label>;
}

function sourceHint(value: unknown, edited: boolean): string {
  if (edited) return "Змінено вручну";
  return value === null || value === undefined || value === "" ? "Потрібно ввести вручну" : "Автозаповнено з кошторису";
}

function manualHint(value: string): string {
  return value.trim() ? "Змінено вручну" : "Потрібно ввести вручну";
}

function optionalManualHint(value: string): string {
  return value.trim() ? "Змінено вручну" : "Не заповнено — можна вписати вручну";
}

function profileHint(value: string, edited: boolean): string {
  if (edited) return "Змінено вручну";
  return value.trim() ? "Автозаповнено з профілю" : "Потрібно ввести вручну";
}

function contractorCertificateHint(profileId: TechnicalSupervisionContractForm["contractorProfileId"], edited: boolean): string {
  if (edited) return "Змінено вручну";
  const profile = getContractorProfile(profileId);
  if (profile.certificate) return "Автозаповнено з профілю";
  return profile.legalType === "ТОВ" ? "Необов'язкове поле" : "Не знайдено у джерелі";
}

function historicalHint(value: string, edited: boolean): string {
  if (edited) return "Змінено вручну";
  return value.trim() ? "Історичне посилання — перевірте" : "Потрібно ввести вручну";
}

function historicalTemplateHint(value: string, edited: boolean): string {
  if (edited) return "Змінено вручну";
  return value.trim() ? "Історичний шаблон — перевірте" : "Потрібно ввести вручну";
}

function autoHint(value: string, edited: boolean): string {
  if (edited) return "Змінено вручну";
  return value.trim() ? "Автозаповнено" : "Потрібно ввести вручну";
}

function hintClass(hint: string): string {
  const layout = "inline-flex max-w-full shrink-0 whitespace-normal break-words rounded-full px-2 py-0.5 text-[10px] leading-4";
  if (/не знайдено|потрібно ввести/i.test(hint)) return `${layout} bg-danger-soft font-semibold text-danger`;
  if (/змінено|історичн/i.test(hint)) return `${layout} bg-cream font-semibold text-primary-hover`;
  return `${layout} bg-accent font-medium text-primary-hover`;
}

function safeTemplateValues(values: TechnicalSupervisionContractForm): Record<string, string> | null {
  try {
    return buildTechnicalSupervisionContractTemplateValues(values);
  } catch {
    return null;
  }
}
