// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TechnicalSupervisionCalculationStep } from "@/components/technical-supervision-calculation-step";
import type { EstimateContext } from "@/lib/documents/types";
import { buildTechnicalSupervisionCalculationDefaults, technicalSupervisionCalculationSchema, type TechnicalSupervisionCalculationForm } from "@/lib/technical-supervision-calculation";

const context: EstimateContext = {
  source: { fileName: "67_КД_ЗКР.rtf", format: "rtf", documentType: "consolidated-estimate", extractionStatus: "extracted", evidence: [{ section: "source-supervision-rate", label: "Технічний нагляд у джерелі", paragraphIndex: 1, text: "1,5 %", matchedText: "1,5 %" }], warnings: [], errors: [] },
  project: { name: { value: "Поточний ремонт вулиці Волинської області", status: "extracted", evidence: [], sourceText: "Поточний ремонт вулиці Волинської області" }, estimateNumber: { value: "67", status: "extracted", evidence: [], sourceText: "67" } },
  totals: {
    final: { value: { amountThousandsUah: 264.325, text: "264,325", unit: "thousands-uah" }, status: "extracted", evidence: [], sourceText: "264,325" },
    consolidated: { value: { amountThousandsUah: 264.325, text: "264,325", unit: "thousands-uah" }, status: "extracted", evidence: [], sourceText: "264,325" },
    chapters1To9: { value: { amountThousandsUah: 177.135, text: "177,135", unit: "thousands-uah" }, status: "extracted", evidence: [], sourceText: "177,135" },
    sourceSupervisionRate: { value: { value: 1.5, text: "1,5 %", unit: "percent" }, status: "extracted", evidence: [], sourceText: "1,5 %" },
    sourceSupervisionAllowance: { value: { amountThousandsUah: 2.657, text: "2,657", unit: "thousands-uah" }, status: "extracted", evidence: [], sourceText: "2,657" },
  },
  people: {
    projectOrganizationHead: { value: null, status: "missing", evidence: [], sourceText: null },
    chiefProjectEngineer: { value: null, status: "missing", evidence: [], sourceText: null },
    preparedBy: { value: null, status: "missing", evidence: [], sourceText: null },
  },
};

function Harness({ onSubmit = vi.fn(async () => undefined) }: { onSubmit?: (values: TechnicalSupervisionCalculationForm) => Promise<void> }) {
  const form = useForm<TechnicalSupervisionCalculationForm>({ resolver: zodResolver(technicalSupervisionCalculationSchema), defaultValues: buildTechnicalSupervisionCalculationDefaults(context), mode: "onBlur" });
  return <TechnicalSupervisionCalculationStep form={form} estimateContext={context} isGenerating={false} selectedFile={new File(["rtf"], "67_КД_ЗКР.rtf", { type: "application/rtf" })} onBack={vi.fn()} onSubmit={onSubmit} />;
}

describe("TechnicalSupervisionCalculationStep", () => {
  afterEach(() => cleanup());

  it("prefills source values, keeps 1.5% evidence separate, and recalculates the editable rate", async () => {
    render(<Harness />);

    expect(screen.getByLabelText(/Всього по зведеному кошторисному розрахунку, грн/)).toHaveProperty("value", "264 325,00");
    expect(screen.getByLabelText(/Разом по главах 1–9, грн/)).toHaveProperty("value", "177 135,00");
    expect(screen.getByLabelText(/Ставка розрахунку, %/)).toHaveProperty("value", "1,1");
    expect(screen.getByLabelText(/Розрахована вартість технічного нагляду, грн/)).toHaveProperty("value", "1 948,49");
    expect(screen.getAllByText(/1,5 %/).length).toBeGreaterThanOrEqual(1);

    fireEvent.change(screen.getByLabelText(/Ставка розрахунку, %/), { target: { value: "1,5" } });
    await waitFor(() => expect(screen.getByLabelText(/Розрахована вартість технічного нагляду, грн/)).toHaveProperty("value", "2 657,03"));
    expect(screen.getByLabelText("Живий перегляд розрахунку технічного нагляду").textContent).toContain("2 657,03");
  });

  it("submits with empty optional shared contract details", async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Сформувати розрахунок" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(screen.getByLabelText(/Номер договору/)).toHaveProperty("value", "");
    expect(screen.getByLabelText(/Дата документа/)).toHaveProperty("value", "");

    expect(screen.queryByRole("checkbox", { name: /актуальність реквізитів/i })).toBeNull();
  });

  it("switches contractor profiles and protects manual edits", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Harness />);

    const selector = screen.getByLabelText("Профіль виконавця");
    expect((screen.getByLabelText(/Реквізити виконавця/) as HTMLTextAreaElement).value).toContain("ФОП Шевчук Ігор Вікторович");
    fireEvent.change(selector, { target: { value: "probudkontrol" } });
    expect((screen.getByLabelText(/Реквізити виконавця/) as HTMLTextAreaElement).value).toContain("ПроБудКонтроль");
    expect((screen.getByLabelText(/Посада виконавця/) as HTMLInputElement).value).toBe("Директор");
    expect(confirm).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Реквізити виконавця/), { target: { value: "Вручну змінені реквізити" } });
    confirm.mockReturnValue(false);
    fireEvent.change(selector, { target: { value: "ik-zahid" } });
    expect(confirm).toHaveBeenCalledOnce();
    expect((screen.getByLabelText(/Реквізити виконавця/) as HTMLTextAreaElement).value).toBe("Вручну змінені реквізити");
    confirm.mockRestore();
  });
});

