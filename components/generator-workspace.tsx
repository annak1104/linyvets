"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  FileWarning,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { amountInWordsUkrainian } from "@/lib/ua-currency-to-words";
import type { Avk5ParseResult } from "@/lib/avk5-parser";
import { createEstimateContext } from "@/lib/documents/estimate-context";
import { defaultSelectedDocumentIds, documentRegistry } from "@/lib/documents/registry";
import type { DocumentId, EstimateContext } from "@/lib/documents/types";
import { batchZipFilename } from "@/lib/batch-generation";
import { buildOrderParagraphs, emptyOrderValues, officialOrderCertificateValue, orderSchema, type OrderForm } from "@/lib/order-form";
import { buildTechnicalSupervisionCalculationDefaults, emptyTechnicalSupervisionCalculationValues, technicalSupervisionCalculationSchema, type TechnicalSupervisionCalculationForm } from "@/lib/technical-supervision-calculation";
import { buildTechnicalSupervisionContractDefaults, createEmptyTechnicalSupervisionContractValues, syncContractFromCalculation, technicalSupervisionContractSchema, type TechnicalSupervisionContractForm } from "@/lib/technical-supervision-contract";
import { customerSignatories, defaultCustomerSignatoryId, getCustomerSignatory, type CustomerSignatoryId } from "@/lib/party-profiles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FileDropzone } from "@/components/file-dropzone";
import { SlothLogo } from "@/components/brand/sloth-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Stepper } from "@/components/stepper";
import { ReviewEditStep } from "@/components/review-edit-step";
import { DocumentSelector } from "@/components/document-selector";
import { TechnicalSupervisionCalculationStep } from "@/components/technical-supervision-calculation-step";
import { TechnicalSupervisionContractStep } from "@/components/technical-supervision-contract-step";
import { BatchDownloadStep } from "@/components/batch-download-step";
import { BatchGenerationBar, type BatchDocumentError } from "@/components/batch-generation-bar";

type ParseEstimateResponse =
  | { result: Avk5ParseResult }
  | { error: { code: string; message: string } };

export function GeneratorWorkspace() {
  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const [downloadFilename, setDownloadFilename] = useState("");
  const [parseResult, setParseResult] = useState<Avk5ParseResult | null>(null);
  const [estimateContext, setEstimateContext] = useState<EstimateContext | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<DocumentId[]>(defaultSelectedDocumentIds);
  const [customerSignatoryId, setCustomerSignatoryId] = useState<CustomerSignatoryId>(defaultCustomerSignatoryId);
  const [activeDocumentId, setActiveDocumentId] = useState<DocumentId>("official-estimate-order");
  const [generatedDocumentId, setGeneratedDocumentId] = useState<DocumentId>("official-estimate-order");
  const [batchGenerated, setBatchGenerated] = useState(false);
  const [batchDownloadFilename, setBatchDownloadFilename] = useState("");
  const [batchDocumentIds, setBatchDocumentIds] = useState<DocumentId[]>([]);
  const [batchErrors, setBatchErrors] = useState<BatchDocumentError[]>([]);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const uploadRequestIdRef = useRef(0);
  const generationRequestIdRef = useRef(0);
  const form = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: emptyOrderValues,
    mode: "onBlur",
  });
  const calculationForm = useForm<TechnicalSupervisionCalculationForm>({
    resolver: zodResolver(technicalSupervisionCalculationSchema),
    defaultValues: emptyTechnicalSupervisionCalculationValues,
    mode: "onBlur",
  });
  const contractForm = useForm<TechnicalSupervisionContractForm>({
    resolver: zodResolver(technicalSupervisionContractSchema),
    defaultValues: createEmptyTechnicalSupervisionContractValues(),
    mode: "onBlur",
  });
  const watchedEstimatedAmount = form.watch("estimatedAmountThousandsUah");
  const watchedCalculationAmount = calculationForm.watch("supervisionAmountUah");
  const watchedContractAmount = contractForm.watch("supervisionAmountUah");
  const watchedCalculationValues = useWatch({ control: calculationForm.control });
  const watchedContractValues = useWatch({ control: contractForm.control });

  const handleCustomerSignatoryChange = (nextSignatoryId: CustomerSignatoryId) => {
    if (nextSignatoryId === customerSignatoryId) return;

    const hasManualSignatoryChanges = [
      form.formState.dirtyFields.customerSignatureTitle,
      form.formState.dirtyFields.customerSignature,
      calculationForm.formState.dirtyFields.customerSignatureTitle,
      calculationForm.formState.dirtyFields.customerDirector,
      contractForm.formState.dirtyFields.customerRepresentative,
      contractForm.formState.dirtyFields.customerLegalBasis,
      contractForm.formState.dirtyFields.customerSignatureTitle,
      contractForm.formState.dirtyFields.customerSignature,
    ].some(Boolean);
    if (hasManualSignatoryChanges && !window.confirm("Заміна підписанта перезапише вручну змінені поля підписанта. Продовжити?")) return;

    const signatory = getCustomerSignatory(nextSignatoryId);
    setCustomerSignatoryId(nextSignatoryId);

    form.setValue("customerSignatoryId", nextSignatoryId, { shouldDirty: false, shouldValidate: true });
    form.setValue("customerSignatureTitle", signatory.position, { shouldDirty: false, shouldValidate: true });
    form.setValue("customerSignature", signatory.displayName, { shouldDirty: false, shouldValidate: true });

    calculationForm.setValue("customerSignatoryId", nextSignatoryId, { shouldDirty: false, shouldValidate: true });
    calculationForm.setValue("customerSignatureTitle", signatory.position, { shouldDirty: false, shouldValidate: true });
    calculationForm.setValue("customerDirector", signatory.displayName, { shouldDirty: false, shouldValidate: true });

    contractForm.setValue("customerSignatoryId", nextSignatoryId, { shouldDirty: false, shouldValidate: true });
    contractForm.setValue("customerRepresentative", signatory.fullName ?? "", { shouldDirty: false, shouldValidate: true });
    contractForm.setValue("customerLegalBasis", signatory.authorizationBasis ?? "", { shouldDirty: false, shouldValidate: true });
    contractForm.setValue("customerSignatureTitle", signatory.position, { shouldDirty: false, shouldValidate: true });
    contractForm.setValue("customerSignature", signatory.displayName, { shouldDirty: false, shouldValidate: true });
  };

  useEffect(() => {
    const synced = syncContractFromCalculation(contractForm.getValues(), { ...watchedCalculationValues, customerSignatoryId });
    const dirtyFields = contractForm.formState.dirtyFields;
    const sharedFields: (keyof TechnicalSupervisionContractForm)[] = ["projectName", "chapters1To9TotalUah", "customerProfileId", "customerSignatoryId", "contractorProfileId", "customerName", "customerLegalBasis", "customerRepresentative", "customerSignatureTitle", "customerSignature", "contractorName", "contractorRegistrationDetails", "contractorAuthorizationBasis", "contractorCertificate", "contractorTaxStatus", "contractNumber", "documentDate", "customerDetails", "contractorDetails", "contractorSignatureTitle", "contractorSignature", "calculationRatePercent"];
    for (const field of sharedFields) {
      if (!dirtyFields[field]) contractForm.setValue(field, synced[field], { shouldDirty: false, shouldValidate: false });
    }
    if (!dirtyFields.supervisionAmountUah) contractForm.setValue("supervisionAmountUah", synced.supervisionAmountUah, { shouldDirty: false, shouldValidate: false });
    if (!dirtyFields.supervisionAmountInWords) contractForm.setValue("supervisionAmountInWords", synced.supervisionAmountInWords, { shouldDirty: false, shouldValidate: false });
  }, [contractForm, customerSignatoryId, watchedCalculationValues]);

  useEffect(() => {
    const dirtyFields = calculationForm.formState.dirtyFields;
    const sharedFields: Array<[keyof TechnicalSupervisionCalculationForm, keyof TechnicalSupervisionContractForm]> = [
      ["projectName", "projectName"],
      ["chapters1To9TotalUah", "chapters1To9TotalUah"],
      ["customerProfileId", "customerProfileId"],
      ["contractorProfileId", "contractorProfileId"],
      ["contractNumber", "contractNumber"],
      ["documentDate", "documentDate"],
      ["customerDetails", "customerDetails"],
      ["customerSignatoryId", "customerSignatoryId"],
      ["customerSignatureTitle", "customerSignatureTitle"],
      ["contractorDetails", "contractorDetails"],
      ["contractorSignatureTitle", "contractorSignatureTitle"],
      ["contractorSignature", "contractorSignature"],
      ["calculationRatePercent", "calculationRatePercent"],
    ];
    for (const [calculationField, contractField] of sharedFields) {
      if (!dirtyFields[calculationField]) calculationForm.setValue(calculationField, watchedContractValues[contractField] ?? "", { shouldDirty: false, shouldValidate: false });
    }
    if (!dirtyFields.supervisionAmountUah) calculationForm.setValue("supervisionAmountUah", watchedContractValues.supervisionAmountUah ?? "", { shouldDirty: false, shouldValidate: false });
    if (!dirtyFields.supervisionAmountInWords) calculationForm.setValue("supervisionAmountInWords", watchedContractValues.supervisionAmountInWords ?? "", { shouldDirty: false, shouldValidate: false });
  }, [calculationForm, watchedContractValues]);

  const handleDocumentSelection = (ids: DocumentId[]) => {
    setSelectedDocumentIds(ids);
    setBatchGenerated(false);
    setBatchErrors([]);
    if (ids.length > 0 && !ids.includes(activeDocumentId)) setActiveDocumentId(ids[0]);
  };

  const handleFile = async (file: File) => {
    if (selectedDocumentIds.length === 0) {
      setErrorMessage("Оберіть щонайменше один доступний документ перед завантаженням кошторису.");
      return;
    }
    uploadAbortRef.current?.abort();
    const requestId = ++uploadRequestIdRef.current;
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setErrorMessage("");
    setParseResult(null);
    setDownloaded(false);
    setDownloadFilename("");
    setBatchGenerated(false);
    setBatchDownloadFilename("");
    setBatchDocumentIds([]);
    setBatchErrors([]);
    generationRequestIdRef.current += 1;
    form.reset(emptyOrderValues);
    calculationForm.reset(emptyTechnicalSupervisionCalculationValues);
    contractForm.reset(createEmptyTechnicalSupervisionContractValues());
    setEstimateContext(null);
    setSelectedFile(file);
    setIsParsing(true);

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/parse-estimate", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      const payload = (await response.json()) as ParseEstimateResponse;

      if (!response.ok || !("result" in payload)) {
        throw new Error("error" in payload ? payload.error.message : "Не вдалося прочитати файл.");
      }

      if (requestId !== uploadRequestIdRef.current) return;
      const result = payload.result;
      const context = createEstimateContext(result, file.name);
      setEstimateContext(context);
      const calculationDefaults = buildTechnicalSupervisionCalculationDefaults(context, customerSignatoryId);
      calculationForm.reset(calculationDefaults);
      contractForm.reset(buildTechnicalSupervisionContractDefaults(context, calculationDefaults));
      const amountText = context.totals.final.value?.text ?? "";
      const sourcePeople = {
        projectOrganizationHead: context.people.projectOrganizationHead.value,
        chiefProjectEngineer: context.people.chiefProjectEngineer.value,
      };
      const nextValues: OrderForm = {
        ...emptyOrderValues,
        customerSignatoryId,
        customerSignatureTitle: getCustomerSignatory(customerSignatoryId).position,
        customerSignature: getCustomerSignatory(customerSignatoryId).displayName,
        projectName: context.project.name.value ?? "",
        projectOrganization: context.people.projectOrganizationHead.value ?? "",
        chiefProjectEngineer: context.people.chiefProjectEngineer.value ?? "",
        certificate: officialOrderCertificateValue(context.people.chiefProjectEngineer.value, context.people.chiefProjectEngineer.value),
        estimatedAmountThousandsUah: amountText,
        estimatedAmountInWords: amountText ? amountInWordsUkrainian(amountText) : "",
      };
      form.reset({ ...nextValues, ...buildOrderParagraphs(nextValues, sourcePeople) });
      setParseResult(result);
      setStep(2);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (requestId !== uploadRequestIdRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : "Не вдалося обробити файл. Спробуйте ще раз.");
    } finally {
      if (uploadAbortRef.current === controller) {
        setIsParsing(false);
        uploadAbortRef.current = null;
      }
    }
  };

  const handleGenerateOrder = async (values: OrderForm) => {
    if (!selectedDocumentIds.includes("official-estimate-order")) {
      setErrorMessage("Оберіть офіційний наказ, щоб сформувати доступний DOCX-документ.");
      return;
    }
    const requestId = ++generationRequestIdRef.current;
    setErrorMessage("");
    setDownloaded(false);
    setBatchGenerated(false);
    setGeneratedDocumentId("official-estimate-order");
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "Не вдалося сформувати DOCX.");
      }

      const blob = await response.blob();
      if (requestId !== generationRequestIdRef.current) return;
      const contentDisposition = response.headers.get("Content-Disposition") ?? "";
      const encodedFilename = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      let filename = "avk-5-order.docx";
      if (encodedFilename) {
        try {
          filename = decodeURIComponent(encodedFilename);
        } catch {
          filename = "avk-5-order.docx";
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setDownloadFilename(filename);
      setStep(3);
    } catch (error) {
      if (requestId !== generationRequestIdRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : "Не вдалося сформувати DOCX. Спробуйте ще раз.");
    } finally {
      if (requestId === generationRequestIdRef.current) setIsGenerating(false);
    }
  };

  const handleGenerateCalculation = async (values: TechnicalSupervisionCalculationForm) => {
    const requestId = ++generationRequestIdRef.current;
    setErrorMessage("");
    setDownloaded(false);
    setBatchGenerated(false);
    setGeneratedDocumentId("technical-supervision-calculation");
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-technical-supervision-calculation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "Не вдалося сформувати розрахунок технічного нагляду.");
      }

      const blob = await response.blob();
      if (requestId !== generationRequestIdRef.current) return;
      const contentDisposition = response.headers.get("Content-Disposition") ?? "";
      const encodedFilename = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      let filename = "technical-supervision-calculation.docx";
      if (encodedFilename) {
        try {
          filename = decodeURIComponent(encodedFilename);
        } catch {
          filename = "technical-supervision-calculation.docx";
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setDownloadFilename(filename);
      setStep(3);
    } catch (error) {
      if (requestId !== generationRequestIdRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : "Не вдалося сформувати розрахунок технічного нагляду. Спробуйте ще раз.");
    } finally {
      if (requestId === generationRequestIdRef.current) setIsGenerating(false);
    }
  };

  const handleGenerateContract = async (values: TechnicalSupervisionContractForm) => {
    if (!selectedDocumentIds.includes("technical-supervision-contract")) {
      setErrorMessage("Оберіть договір технічного нагляду, щоб сформувати доступний DOCX-документ.");
      return;
    }
    const requestId = ++generationRequestIdRef.current;
    setErrorMessage("");
    setDownloaded(false);
    setBatchGenerated(false);
    setGeneratedDocumentId("technical-supervision-contract");
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-technical-supervision-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "Не вдалося сформувати договір технічного нагляду.");
      }
      const blob = await response.blob();
      if (requestId !== generationRequestIdRef.current) return;
      const contentDisposition = response.headers.get("Content-Disposition") ?? "";
      const encodedFilename = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      let filename = "technical-supervision-contract.docx";
      if (encodedFilename) {
        try {
          filename = decodeURIComponent(encodedFilename);
        } catch {
          filename = "technical-supervision-contract.docx";
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setDownloadFilename(filename);
      setStep(3);
    } catch (error) {
      if (requestId !== generationRequestIdRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : "Не вдалося сформувати договір технічного нагляду. Спробуйте ще раз.");
    } finally {
      if (requestId === generationRequestIdRef.current) setIsGenerating(false);
    }
  };

  const validateBatchDocuments = async () => {
    const errors: BatchDocumentError[] = [];
    for (const id of selectedDocumentIds) {
      const valid = id === "official-estimate-order"
        ? await form.trigger()
        : id === "technical-supervision-calculation"
          ? await calculationForm.trigger()
          : await contractForm.trigger();
      if (!valid) {
        errors.push({
          id,
          message: id === "official-estimate-order"
            ? "Заповніть обов’язкові поля наказу."
            : id === "technical-supervision-calculation"
              ? "Підтвердіть обов’язкові реквізити розрахунку."
              : "Підтвердіть обов’язкові реквізити договору.",
        });
      }
    }

    setBatchErrors(errors);
    if (errors.length > 0) {
      setActiveDocumentId(errors[0].id);
      setStep(2);
      return null;
    }

    return selectedDocumentIds.map((id) => ({
      id,
      data: id === "official-estimate-order"
        ? form.getValues()
        : id === "technical-supervision-calculation"
          ? calculationForm.getValues()
          : contractForm.getValues(),
    }));
  };

  const handleGenerateBatch = async () => {
    if (selectedDocumentIds.length < 2) return;
    const documents = await validateBatchDocuments();
    if (!documents) return;

    const requestId = ++generationRequestIdRef.current;
    setErrorMessage("");
    setDownloaded(false);
    setBatchErrors([]);
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string; documents?: BatchDocumentError[] } } | null;
        if (requestId !== generationRequestIdRef.current) return;
        setBatchErrors(payload?.error?.documents ?? []);
        throw new Error(payload?.error?.message ?? "Не вдалося сформувати пакет документів.");
      }
      const blob = await response.blob();
      if (requestId !== generationRequestIdRef.current) return;
      const filename = responseFilename(response, batchZipFilename(String(documents[0]?.data && typeof documents[0].data === "object" && "projectName" in documents[0].data ? documents[0].data.projectName : "")));
      downloadBlob(blob, filename);
      setBatchGenerated(true);
      setBatchDocumentIds([...selectedDocumentIds]);
      setBatchDownloadFilename(filename);
      setDownloaded(true);
      setDownloadFilename(filename);
      setStep(3);
    } catch (error) {
      if (requestId !== generationRequestIdRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : "Не вдалося сформувати пакет документів. Спробуйте ще раз.");
    } finally {
      if (requestId === generationRequestIdRef.current) setIsGenerating(false);
    }
  };

  const handleDownloadIndividualFromBatch = async (id: DocumentId) => {
    const valid = id === "official-estimate-order"
      ? await form.trigger()
      : id === "technical-supervision-calculation"
        ? await calculationForm.trigger()
        : await contractForm.trigger();
    if (!valid) {
      setBatchErrors([{ id, message: "Виправте обов’язкові поля цього документа перед завантаженням." }]);
      setActiveDocumentId(id);
      setStep(2);
      return;
    }

    const requestId = ++generationRequestIdRef.current;
    setErrorMessage("");
    setIsGenerating(true);
    try {
      const endpoint = id === "official-estimate-order"
        ? "/api/generate-order"
        : id === "technical-supervision-calculation"
          ? "/api/generate-technical-supervision-calculation"
          : "/api/generate-technical-supervision-contract";
      const data = id === "official-estimate-order"
        ? form.getValues()
        : id === "technical-supervision-calculation"
          ? calculationForm.getValues()
          : contractForm.getValues();
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "Не вдалося сформувати DOCX.");
      }
      const blob = await response.blob();
      if (requestId !== generationRequestIdRef.current) return;
      downloadBlob(blob, responseFilename(response, "document.docx"));
    } catch (error) {
      if (requestId !== generationRequestIdRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : "Не вдалося сформувати DOCX. Спробуйте ще раз.");
    } finally {
      if (requestId === generationRequestIdRef.current) setIsGenerating(false);
    }
  };

  const restart = () => {
    uploadAbortRef.current?.abort();
    uploadRequestIdRef.current += 1;
    setStep(1);
    setSelectedFile(null);
    setDownloaded(false);
    setDownloadFilename("");
    setParseResult(null);
    setEstimateContext(null);
    setSelectedDocumentIds(defaultSelectedDocumentIds);
    setCustomerSignatoryId(defaultCustomerSignatoryId);
    setActiveDocumentId("official-estimate-order");
    setGeneratedDocumentId("official-estimate-order");
    setBatchGenerated(false);
    setBatchDownloadFilename("");
    setBatchDocumentIds([]);
    setBatchErrors([]);
    setErrorMessage("");
    generationRequestIdRef.current += 1;
    form.reset(emptyOrderValues);
    calculationForm.reset(emptyTechnicalSupervisionCalculationValues);
    contractForm.reset(createEmptyTechnicalSupervisionContractValues());
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
          <SlothLogo compact />
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:gap-4">
            <span className="hidden items-center gap-2 sm:flex"><ShieldCheck className="size-4 text-success" /> Дані тільки у вашій сесії</span>
            <span className="rounded-full border bg-accent px-3 py-1.5 text-primary-hover">AVK-5</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-16 pt-7 sm:px-8 sm:pb-20 sm:pt-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-7 flex flex-col justify-between gap-6 sm:mb-9 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary-hover"><Sparkles className="size-3.5" /> Спокійний помічник для кошторисів</div>
              <h1 className="max-w-2xl text-3xl font-semibold leading-[1.1] tracking-[-0.045em] text-foreground sm:text-5xl">Від кошторису до готового документа — без зайвих рухів.</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">Завантажте файл, перевірте реквізити наказу та отримайте охайний DOCX.</p>
            </div>
            <div className="hidden rounded-2xl border bg-card px-4 py-3 text-right sm:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Сесія без акаунта</p>
              <p className="mt-1 text-sm font-semibold text-foreground">3 прості кроки</p>
            </div>
          </div>

          <DocumentSelector selectedDocumentIds={selectedDocumentIds} onChange={handleDocumentSelection} />

          <div className="mb-5 rounded-2xl border bg-card px-4 py-4 surface-shadow sm:px-6">
            <label className="block max-w-xl text-sm font-semibold" htmlFor="customer-signatory-selector">
              Підписант замовника
              <select id="customer-signatory-selector" aria-label="Підписант замовника" value={customerSignatoryId} onChange={(event) => handleCustomerSignatoryChange(event.target.value as CustomerSignatoryId)} className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal outline-none">
                {customerSignatories.map((signatory) => <option key={signatory.id} value={signatory.id}>{signatory.position} — {signatory.displayName}</option>)}
              </select>
            </label>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Вибір синхронізується між наказом, розрахунком і договором. Відсутні повні дані для в.о. директора потрібно внести вручну.</p>
          </div>

          <div className="mb-7 rounded-2xl border bg-card px-4 py-4 surface-shadow sm:mb-8 sm:px-6">
            <Stepper currentStep={step} />
          </div>

          {errorMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border bg-cream px-4 py-3 text-sm text-foreground" role="alert">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-primary-hover" />
              <span>{errorMessage}</span>
            </div>
          )}

          {step === 1 && <UploadStep isParsing={isParsing} selectedFile={selectedFile} uploadDisabled={selectedDocumentIds.length === 0} onFile={(file) => void handleFile(file)} />}
          {step === 2 && (
            <>
              {selectedDocumentIds.length > 1 && <DocumentTabs selectedDocumentIds={selectedDocumentIds} activeDocumentId={activeDocumentId} onChange={setActiveDocumentId} />}
              <BatchGenerationBar selectedDocumentIds={selectedDocumentIds} errors={batchErrors} isGenerating={isGenerating} onGenerate={() => void handleGenerateBatch()} />
              {activeDocumentId === "technical-supervision-calculation" ? (
                <TechnicalSupervisionCalculationStep
                  form={calculationForm}
                  estimateContext={estimateContext}
                  isGenerating={isGenerating}
                  selectedFile={selectedFile}
                  onBack={() => setStep(1)}
                  onInvalid={() => setErrorMessage("Підтвердіть обов’язкові реквізити розрахунку перед формуванням DOCX.")}
                  onSubmit={handleGenerateCalculation}
                />
              ) : activeDocumentId === "technical-supervision-contract" ? (
                <TechnicalSupervisionContractStep
                  form={contractForm}
                  estimateContext={estimateContext}
                  isGenerating={isGenerating}
                  selectedFile={selectedFile}
                  onBack={() => setStep(1)}
                  onInvalid={() => setErrorMessage("Підтвердіть обов’язкові реквізити договору перед формуванням DOCX.")}
                  onSubmit={handleGenerateContract}
                />
              ) : (
                <ReviewEditStep
                  form={form}
                  parseResult={parseResult}
                  estimateContext={estimateContext}
                  isGenerating={isGenerating}
                  selectedFile={selectedFile}
                  generationAvailable={selectedDocumentIds.includes("official-estimate-order")}
                  onBack={() => setStep(1)}
                  onInvalid={() => setErrorMessage("Перевірте обов’язкові поля перед формуванням документа.")}
                  onSubmit={handleGenerateOrder}
                />
              )}
            </>
          )}
          {step === 3 && batchGenerated ? <BatchDownloadStep documentIds={batchDocumentIds} zipFilename={batchDownloadFilename} isGenerating={isGenerating} onBack={() => { setStep(2); }} onRestart={restart} onDownloadZip={() => void handleGenerateBatch()} onDownloadIndividual={(id) => void handleDownloadIndividualFromBatch(id)} /> : step === 3 && <DownloadStep documentName={generatedDocumentId === "technical-supervision-calculation" ? "Розрахунок вартості технічного нагляду" : generatedDocumentId === "technical-supervision-contract" ? "Договір технічного нагляду" : "Офіційний наказ"} downloaded={downloaded} filename={downloadFilename} estimatedAmount={generatedDocumentId === "technical-supervision-calculation" ? watchedCalculationAmount : generatedDocumentId === "technical-supervision-contract" ? watchedContractAmount : watchedEstimatedAmount} isGenerating={isGenerating} onBack={() => { setActiveDocumentId(generatedDocumentId); setStep(2); }} onRestart={restart} onDownload={() => void (generatedDocumentId === "technical-supervision-calculation" ? handleGenerateCalculation(calculationForm.getValues()) : generatedDocumentId === "technical-supervision-contract" ? handleGenerateContract(contractForm.getValues()) : handleGenerateOrder(form.getValues()))} />}
        </div>
      </div>
    </main>
  );
}

function responseFilename(response: Response, fallback: string): string {
  const contentDisposition = response.headers.get("Content-Disposition") ?? "";
  const encodedFilename = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (!encodedFilename) return fallback;
  try {
    return decodeURIComponent(encodedFilename);
  } catch {
    return fallback;
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function UploadStep({ isParsing, selectedFile, uploadDisabled, onFile }: { isParsing: boolean; selectedFile: File | null; uploadDisabled: boolean; onFile: (file: File) => void }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-between border-b p-7 sm:p-10 lg:border-b-0 lg:border-r">
          <div>
            <Badge className="bg-accent text-primary-hover">Крок 1 · Завантаження</Badge>
            <h2 className="mt-5 max-w-sm text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Почнемо з вашого кошторису.</h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">Лінивець підготує структуру замовлення для швидкої перевірки. Ніяких таблиць, які треба форматувати вручну.</p>
          </div>
          <div className="mt-9 space-y-3">
            <TrustRow icon={<ShieldCheck className="size-4" />} title="Приватна сесія" description="Файл не зберігається після завершення." />
            <TrustRow icon={<Clock3 className="size-4" />} title="Кілька хвилин" description="Одразу перейдіть до редагування." />
          </div>
        </div>
        <div className="p-6 sm:p-10">
          {isParsing ? (
            <div className="flex min-h-[310px] flex-col items-center justify-center rounded-[26px] border bg-accent/45 text-center" aria-live="polite">
              <LoaderCircle className="size-8 animate-spin text-primary-hover" />
              <p className="mt-5 text-sm font-semibold">Читаємо {selectedFile?.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">Готуємо реквізити наказу для перевірки…</p>
            </div>
          ) : <FileDropzone disabled={uploadDisabled} onFile={onFile} />}
          <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><FileWarning className="mt-0.5 size-3.5 shrink-0 text-primary-hover" /><span>До 4 МБ · лише RTF. Файл обробляється в пам’яті й не зберігається.</span></div>
        </div>
      </div>
    </Card>
  );
}

function DocumentTabs({ selectedDocumentIds, activeDocumentId, onChange }: { selectedDocumentIds: readonly DocumentId[]; activeDocumentId: DocumentId; onChange: (id: DocumentId) => void }) {
  const documents = documentRegistry.filter((document) => selectedDocumentIds.includes(document.id));
  return <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Документи для редагування">{documents.map((document) => <button key={document.id} type="button" role="tab" aria-selected={activeDocumentId === document.id} className={`focus-ring rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${activeDocumentId === document.id ? "border-primary bg-accent text-primary-hover" : "bg-card text-muted-foreground hover:bg-accent"}`} onClick={() => onChange(document.id)}>{document.name}</button>)}</div>;
}

function TrustRow({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="flex items-start gap-3"><div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-hover">{icon}</div><div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p></div></div>;
}

function DownloadStep({ documentName, downloaded, filename, estimatedAmount, isGenerating, onBack, onRestart, onDownload }: { documentName: string; downloaded: boolean; filename: string; estimatedAmount: string; isGenerating: boolean; onBack: () => void; onRestart: () => void; onDownload: () => void }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_0.92fr] lg:gap-12 lg:p-12">
        <div className="flex flex-col justify-center">
          <div className="flex size-16 items-center justify-center rounded-3xl bg-accent text-success"><CheckCircle2 className="size-8" /></div>
          <Badge className="mt-7 w-fit bg-accent text-success">Крок 3 · Документ готовий</Badge>
          <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">Можна видихнути.</h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">AVK-5 сформовано та завантажено на ваш пристрій. Збережіть файл або поверніться до перевірки, якщо хочете щось уточнити.</p>
          {downloaded && <div className="mt-6 flex w-fit items-center gap-2 rounded-full border bg-background px-3 py-2 text-xs font-semibold text-success"><Check className="size-3.5" /> {filename}</div>}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button variant="primary" onClick={onDownload} disabled={isGenerating}>{isGenerating ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />} Завантажити ще раз</Button><Button variant="outline" onClick={onBack}><ArrowLeft className="size-4" /> Редагувати</Button></div>
          <Button variant="ghost" className="mt-3 w-fit px-0" onClick={onRestart}><RotateCcw className="size-4" /> Створити новий документ</Button>
        </div>
        <div className="rounded-[26px] border bg-background p-5 sm:p-6">
          <div className="rounded-2xl border bg-card p-5 surface-shadow sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b pb-5"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary-hover"><FileText className="size-5" /></div><div><p className="text-sm font-semibold">{documentName}</p><p className="mt-1 text-xs text-muted-foreground">Документ на основі кошторису</p></div></div><Badge className="bg-accent text-success">DOCX</Badge></div>
            <div className="space-y-4 py-5"><SummaryRow label="Статус" value="Підготовлено" success /><SummaryRow label="Сума" value={estimatedAmount ? `${estimatedAmount} ${documentName === "Офіційний наказ" ? "тис. грн" : "грн"}` : "Не визначено"} /></div>
            <div className="border-t pt-5"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Готовність</span><span>100%</span></div><Progress className="mt-2" value={100} /></div>
          </div>
          <p className="mt-4 flex items-start gap-2 px-1 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />Документ сформовано без постійного зберігання.</p>
        </div>
      </div>
    </Card>
  );
}

function SummaryRow({ label, value, success = false }: { label: string; value: string; success?: boolean }) {
  return <div className="flex items-center justify-between gap-4 text-sm"><span className="text-muted-foreground">{label}</span><span className={success ? "font-semibold text-success" : "font-semibold text-foreground"}>{value}</span></div>;
}
