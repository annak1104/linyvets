"use client";

import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { buildOrderParagraphs, emptyOrderValues, orderSchema, type OrderForm } from "@/lib/order-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FileDropzone } from "@/components/file-dropzone";
import { SlothLogo } from "@/components/brand/sloth-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Stepper } from "@/components/stepper";
import { ReviewEditStep } from "@/components/review-edit-step";

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
  const uploadAbortRef = useRef<AbortController | null>(null);
  const uploadRequestIdRef = useRef(0);
  const form = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: emptyOrderValues,
    mode: "onBlur",
  });
  const watchedEstimatedAmount = form.watch("estimatedAmountThousandsUah");

  const handleFile = async (file: File) => {
    uploadAbortRef.current?.abort();
    const requestId = ++uploadRequestIdRef.current;
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setErrorMessage("");
    setParseResult(null);
    setDownloaded(false);
    setDownloadFilename("");
    form.reset(emptyOrderValues);
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
      const amountText = result.data.finalEstimatedTotalThousandsUahText ?? "";
      const nextValues: OrderForm = {
        ...emptyOrderValues,
        projectName: result.data.projectName ?? "",
        projectOrganization: result.data.projectOrganization ?? "",
        chiefProjectEngineer: result.data.chiefProjectEngineer ?? "",
        estimatedAmountThousandsUah: amountText,
        estimatedAmountInWords: amountText ? amountInWordsUkrainian(amountText) : "",
      };
      form.reset({ ...nextValues, ...buildOrderParagraphs(nextValues) });
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

  const handleGenerate = async (values: OrderForm) => {
    setErrorMessage("");
    setDownloaded(false);
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
      setErrorMessage(error instanceof Error ? error.message : "Не вдалося сформувати DOCX. Спробуйте ще раз.");
    } finally {
      setIsGenerating(false);
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
    setErrorMessage("");
    form.reset(emptyOrderValues);
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

          <div className="mb-7 rounded-2xl border bg-card px-4 py-4 surface-shadow sm:mb-8 sm:px-6">
            <Stepper currentStep={step} />
          </div>

          {errorMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border bg-cream px-4 py-3 text-sm text-foreground" role="alert">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-primary-hover" />
              <span>{errorMessage}</span>
            </div>
          )}

          {step === 1 && <UploadStep isParsing={isParsing} selectedFile={selectedFile} onFile={(file) => void handleFile(file)} />}
          {step === 2 && (
            <ReviewEditStep
              form={form}
              parseResult={parseResult}
              isGenerating={isGenerating}
              selectedFile={selectedFile}
              onBack={() => setStep(1)}
              onInvalid={() => setErrorMessage("Перевірте обов’язкові поля перед формуванням документа.")}
              onSubmit={handleGenerate}
            />
          )}
          {step === 3 && <DownloadStep downloaded={downloaded} filename={downloadFilename} estimatedAmount={watchedEstimatedAmount} isGenerating={isGenerating} onBack={() => setStep(2)} onRestart={restart} onDownload={() => void handleGenerate(form.getValues())} />}
        </div>
      </div>
    </main>
  );
}

function UploadStep({ isParsing, selectedFile, onFile }: { isParsing: boolean; selectedFile: File | null; onFile: (file: File) => void }) {
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
          ) : <FileDropzone onFile={onFile} />}
          <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><FileWarning className="mt-0.5 size-3.5 shrink-0 text-primary-hover" /><span>До 4 МБ · лише RTF. Файл обробляється в пам’яті й не зберігається.</span></div>
        </div>
      </div>
    </Card>
  );
}

function TrustRow({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="flex items-start gap-3"><div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-hover">{icon}</div><div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p></div></div>;
}

function DownloadStep({ downloaded, filename, estimatedAmount, isGenerating, onBack, onRestart, onDownload }: { downloaded: boolean; filename: string; estimatedAmount: string; isGenerating: boolean; onBack: () => void; onRestart: () => void; onDownload: () => void }) {
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
            <div className="flex items-start justify-between gap-4 border-b pb-5"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary-hover"><FileText className="size-5" /></div><div><p className="text-sm font-semibold">Офіційний наказ</p><p className="mt-1 text-xs text-muted-foreground">Реквізити кошторису</p></div></div><Badge className="bg-accent text-success">DOCX</Badge></div>
            <div className="space-y-4 py-5"><SummaryRow label="Статус" value="Підготовлено" success /><SummaryRow label="Фінальна сума" value={estimatedAmount ? `${estimatedAmount} тис. грн` : "Не визначено"} /></div>
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
