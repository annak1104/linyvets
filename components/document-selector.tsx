"use client";

import { Check, FileText, LockKeyhole } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { availableDocumentRegistry, documentRegistry } from "@/lib/documents/registry";
import type { DocumentId } from "@/lib/documents/types";

type DocumentSelectorProps = {
  selectedDocumentIds: readonly DocumentId[];
  onChange: (ids: DocumentId[]) => void;
};

export function DocumentSelector({ selectedDocumentIds, onChange }: DocumentSelectorProps) {
  const selectedAvailableCount = availableDocumentRegistry.filter((document) => selectedDocumentIds.includes(document.id)).length;
  const allAvailableSelected = selectedAvailableCount === availableDocumentRegistry.length;

  const toggle = (id: DocumentId, checked: boolean) => {
    if (!availableDocumentRegistry.some((document) => document.id === id)) return;
    onChange(checked ? [...new Set([...selectedDocumentIds, id])] : selectedDocumentIds.filter((selectedId) => selectedId !== id));
  };

  return (
    <Card className="mb-7 overflow-hidden sm:mb-8">
      <div className="flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-hover">Тип вихідного документа</p>
          <h2 className="mt-1.5 text-lg font-semibold tracking-[-0.02em]">Оберіть документи для підготовки</h2>
          <p className="mt-1.5 text-sm leading-5 text-muted-foreground">Один кошторис можна використати для кількох документів. Оберіть потрібні доступні формати.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={() => onChange(availableDocumentRegistry.map((document) => document.id))} disabled={allAvailableSelected}>Обрати всі</Button>
          <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={() => onChange([])} disabled={selectedAvailableCount === 0}>Очистити вибір</Button>
        </div>
      </div>
      <fieldset className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
        <legend className="sr-only">Доступні типи вихідних документів</legend>
        {documentRegistry.map((document) => {
          const available = document.availability === "available";
          const checked = selectedDocumentIds.includes(document.id);
          return (
            <label key={document.id} className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${available ? "cursor-pointer hover:bg-accent" : "cursor-not-allowed bg-background/60 opacity-70"}`}>
              <input
                type="checkbox"
                className="peer sr-only"
                checked={checked}
                disabled={!available}
                onChange={(event) => toggle(document.id, event.target.checked)}
                aria-label={document.name}
              />
              <span aria-hidden="true" className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${checked ? "border-primary bg-primary text-primary-foreground" : "bg-card text-transparent"}`}>
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <span className="min-w-0">
                <span className="flex items-start gap-2 text-sm font-semibold leading-5"><FileText className="mt-0.5 size-4 shrink-0 text-primary-hover" />{document.name}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{document.description}</span>
                <Badge className={available ? "mt-3 bg-accent text-primary-hover" : "mt-3 bg-background text-muted-foreground"}>{available ? "Доступно" : <><LockKeyhole className="mr-1 size-3" /> Незабаром</>}</Badge>
              </span>
            </label>
          );
        })}
      </fieldset>
      {selectedAvailableCount === 0 && <p className="border-t bg-cream px-5 py-3 text-xs font-medium text-foreground sm:px-6">Оберіть щонайменше один доступний документ, щоб завантажити кошторис.</p>}
    </Card>
  );
}

