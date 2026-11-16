"use client";

import { Archive, CircleAlert, LoaderCircle } from "lucide-react";

import { availableDocumentRegistry } from "@/lib/documents/registry";
import type { DocumentId } from "@/lib/documents/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type BatchDocumentError = {
  id: DocumentId;
  message: string;
  fields?: Array<{ field: string; message: string }>;
};

type BatchGenerationBarProps = {
  selectedDocumentIds: readonly DocumentId[];
  errors: readonly BatchDocumentError[];
  isGenerating: boolean;
  onGenerate: () => void;
};

export function BatchGenerationBar({ selectedDocumentIds, errors, isGenerating, onGenerate }: BatchGenerationBarProps) {
  if (selectedDocumentIds.length < 2) return null;

  const documents = availableDocumentRegistry.filter((document) => selectedDocumentIds.includes(document.id));

  return (
    <section className="mb-5 rounded-2xl border bg-card px-4 py-4 surface-shadow sm:px-5" aria-labelledby="batch-generation-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><Badge className="bg-accent text-primary-hover">Пакетний режим</Badge><h2 id="batch-generation-heading" className="text-sm font-semibold">Сформувати вибрані документи разом</h2></div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Перевірка кожного документа виконується окремо. ZIP з’явиться лише після успішної генерації всіх файлів.</p>
          <div className="mt-3 flex flex-wrap gap-2">{documents.map((document) => <span key={document.id} className="rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{document.name}</span>)}</div>
        </div>
        <Button type="button" variant="primary" className="shrink-0" onClick={onGenerate} disabled={isGenerating}>{isGenerating ? <LoaderCircle className="size-4 animate-spin" /> : <Archive className="size-4" />} {isGenerating ? "Формуємо ZIP…" : "Сформувати ZIP"}</Button>
      </div>
      {errors.length > 0 && <div className="mt-4 space-y-2 rounded-xl border border-danger/20 bg-danger-soft px-3 py-3 text-xs text-danger" role="alert"><p className="flex items-center gap-2 font-semibold"><CircleAlert className="size-3.5" /> Потрібно виправити реквізити:</p>{errors.map((error) => <p key={error.id}><span className="font-semibold">{documents.find((document) => document.id === error.id)?.name ?? error.id}:</span> {error.message}</p>)}</div>}
    </section>
  );
}
