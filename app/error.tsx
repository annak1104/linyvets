"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-cream text-primary-hover">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Щось пішло не так</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Не вдалося завантажити робоче місце. Спробуйте ще раз.</p>
        <Button className="mt-6" onClick={() => reset()}>
          <RotateCcw className="size-4" />
          Повторити
        </Button>
      </div>
    </main>
  );
}
