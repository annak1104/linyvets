"use client";

import { useRef, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileDropzone({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const acceptFile = (file?: File) => {
    if (file) onFile(file);
  };

  return (
    <div
      className={cn("group cursor-pointer rounded-[26px] border border-dashed bg-accent/45 p-7 text-center transition-colors hover:border-primary hover:bg-accent sm:p-10", isDragging && "border-primary bg-accent")}
      onClick={() => inputRef.current?.click()}
      onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => { event.preventDefault(); setIsDragging(false); acceptFile(event.dataTransfer.files?.[0]); }}
      role="button"
      tabIndex={0}
      aria-label="Завантажити файл кошторису"
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
    >
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".rtf,application/rtf,text/rtf"
        onChange={(event) => {
          acceptFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-white text-primary-hover shadow-sm transition-transform group-hover:-translate-y-0.5">
        <UploadCloud className="size-6" />
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">Перетягніть кошторис сюди</h3>
      <p className="mt-2 text-sm text-muted-foreground">або натисніть, щоб обрати файл на пристрої</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5"><FileText className="size-3.5 text-primary-hover" /> RTF</span>
      </div>
    </div>
  );
}
