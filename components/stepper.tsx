import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const steps = [
  { number: 1, label: "Завантаження", shortLabel: "Файл" },
  { number: 2, label: "Перевірка", shortLabel: "Замовлення" },
  { number: 3, label: "Документ", shortLabel: "Готово" },
];

export function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Кроки створення документа" className="flex w-full items-start">
      {steps.map((step, index) => {
        const isDone = currentStep > step.number;
        const isCurrent = currentStep === step.number;
        return (
          <div className="flex min-w-0 flex-none items-start sm:flex-1" key={step.number}>
            <div className="flex min-w-0 items-center gap-2.5">
              <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors", isDone && "border-success bg-success text-white", isCurrent && "border-primary bg-primary text-white", !isDone && !isCurrent && "bg-white text-muted-foreground")}>
                {isDone ? <Check className="size-4" /> : step.number}
              </div>
              <div className="min-w-0">
                <p className={cn("hidden truncate text-[11px] font-medium uppercase tracking-[0.12em] sm:block", isCurrent ? "text-primary-hover" : "text-muted-foreground")}>Крок {step.number}</p>
                <p className={cn("whitespace-nowrap text-xs font-semibold sm:hidden", isCurrent ? "text-foreground" : "text-muted-foreground")}>{step.shortLabel}</p>
                <p className={cn("hidden whitespace-nowrap text-sm font-semibold sm:block", isCurrent ? "text-foreground" : "text-muted-foreground")}>{step.label}</p>
              </div>
            </div>
            {index < steps.length - 1 && <div className={cn("mx-2 mt-4 h-px min-w-[10px] flex-1 sm:mx-3", currentStep > step.number ? "bg-success" : "bg-border")} />}
          </div>
        );
      })}
    </nav>
  );
}
