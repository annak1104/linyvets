"use client";

import { ArrowLeft, Check, CheckCircle2, Download, FileArchive, FileText, LoaderCircle, RotateCcw, ShieldCheck } from "lucide-react";

import { availableDocumentRegistry } from "@/lib/documents/registry";
import type { DocumentId } from "@/lib/documents/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type BatchDownloadStepProps = {
  documentIds: readonly DocumentId[];
  zipFilename: string;
  isGenerating: boolean;
  onBack: () => void;
  onRestart: () => void;
  onDownloadZip: () => void;
  onDownloadIndividual: (id: DocumentId) => void;
};

export function BatchDownloadStep({
  documentIds,
  zipFilename,
  isGenerating,
  onBack,
  onRestart,
  onDownloadZip,
  onDownloadIndividual,
}: BatchDownloadStepProps) {
  const documents = availableDocumentRegistry.filter((document) => documentIds.includes(document.id));

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_0.92fr] lg:gap-12 lg:p-12">
        <div className="flex flex-col justify-center">
          <div className="flex size-16 items-center justify-center rounded-3xl bg-accent text-success"><CheckCircle2 className="size-8" /></div>
          <Badge className="mt-7 w-fit bg-accent text-success">Крок 3 · Пакет готовий</Badge>
          <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">Усі документи підготовлено.</h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">Один ZIP містить тільки успішно сформовані DOCX. Можна завантажити пакет або окремий документ.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button variant="primary" onClick={onDownloadZip} disabled={isGenerating}>{isGenerating ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />} Завантажити ZIP ще раз</Button><Button variant="outline" onClick={onBack}><ArrowLeft className="size-4" /> Редагувати</Button></div>
          <Button variant="ghost" className="mt-3 w-fit px-0" onClick={onRestart}><RotateCcw className="size-4" /> Створити новий документ</Button>
        </div>

        <div className="rounded-[26px] border bg-background p-5 sm:p-6">
          <div className="rounded-2xl border bg-card p-5 surface-shadow sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b pb-5"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary-hover"><FileArchive className="size-5" /></div><div><p className="text-sm font-semibold">Пакет документів</p><p className="mt-1 text-xs text-muted-foreground">{zipFilename}</p></div></div><Badge className="bg-accent text-success">ZIP</Badge></div>
            <div className="space-y-3 py-5">{documents.map((document) => <div key={document.id} className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-3"><div className="flex min-w-0 items-center gap-2"><FileText className="size-4 shrink-0 text-primary-hover" /><span className="truncate text-sm font-medium">{document.name}</span></div><Button type="button" variant="ghost" className="h-8 shrink-0 px-2 text-xs" onClick={() => onDownloadIndividual(document.id)} disabled={isGenerating}><Download className="size-3.5" /> DOCX</Button></div>)}</div>
            <div className="border-t pt-5"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Документів у ZIP</span><span className="font-semibold text-foreground">{documents.length}</span></div><div className="mt-3 flex items-center gap-2 text-xs font-medium text-success"><Check className="size-3.5" /> Без неповних файлів</div></div>
          </div>
          <p className="mt-4 flex items-start gap-2 px-1 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />Пакет сформовано в пам’яті без постійного зберігання.</p>
        </div>
      </div>
    </Card>
  );
}
