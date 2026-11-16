// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TechnicalSupervisionContractStep } from "@/components/technical-supervision-contract-step";
import type { EstimateContext } from "@/lib/documents/types";
import { buildTechnicalSupervisionContractDefaults, technicalSupervisionContractSchema, type TechnicalSupervisionContractForm } from "@/lib/technical-supervision-contract";

const context: EstimateContext = {
  source: { fileName: "67_КД_ЗКР.rtf", format: "rtf", documentType: "consolidated-estimate", extractionStatus: "extracted", evidence: [{ section: "source-supervision-rate", label: "Технічний нагляд у джерелі", paragraphIndex: 1, text: "1,5 %", matchedText: "1,5 %" }], warnings: [], errors: [] },
  project: { name: { value: "Поточний ремонт зупинки громадського транспорту Волинської області", status: "extracted", evidence: [], sourceText: "Поточний ремонт зупинки громадського транспорту Волинської області" }, estimateNumber: { value: "67", status: "extracted", evidence: [], sourceText: "67" } },
  totals: {
    final: { value: { amountThousandsUah: 264.325, text: "264,325", unit: "thousands-uah" }, status: "extracted", evidence: [], sourceText: "264,325" },
    consolidated: { value: { amountThousandsUah: 264.325, text: "264,325", unit: "thousands-uah" }, status: "extracted", evidence: [], sourceText: "264,325" },
    chapters1To9: { value: { amountThousandsUah: 177.135, text: "177,135", unit: "thousands-uah" }, status: "extracted", evidence: [], sourceText: "177,135" },
    sourceSupervisionRate: { value: { value: 1.5, text: "1,5 %", unit: "percent" }, status: "extracted", evidence: [], sourceText: "1,5 %" },
    sourceSupervisionAllowance: { value: { amountThousandsUah: 2.657, text: "2,657", unit: "thousands-uah" }, status: "extracted", evidence: [], sourceText: "2,657" },
  },
  people: { projectOrganizationHead: { value: null, status: "missing", evidence: [], sourceText: null }, chiefProjectEngineer: { value: null, status: "missing", evidence: [], sourceText: null }, preparedBy: { value: null, status: "missing", evidence: [], sourceText: null } },
};

function Harness({ onSubmit = vi.fn(async () => undefined) }: { onSubmit?: (values: TechnicalSupervisionContractForm) => Promise<void> }) {
  const form = useForm<TechnicalSupervisionContractForm>({ resolver: zodResolver(technicalSupervisionContractSchema), defaultValues: buildTechnicalSupervisionContractDefaults(context), mode: "onBlur" });
  return <TechnicalSupervisionContractStep form={form} estimateContext={context} isGenerating={false} selectedFile={new File(["rtf"], "67_КД_ЗКР.rtf", { type: "application/rtf" })} onBack={vi.fn()} onSubmit={onSubmit} />;
}

describe("TechnicalSupervisionContractStep", () => {
  afterEach(() => cleanup());

  it("prefills shared estimate values and keeps reference warnings visible", async () => {
    render(<Harness />);
    expect(screen.getByLabelText(/Назва об’єкта/)).toHaveProperty("value", "Поточний ремонт зупинки громадського транспорту Волинської області");
    expect(screen.getByLabelText(/Сума договору, грн/)).toHaveProperty("value", "1 948,49");
    expect(screen.getByText(/історичне посилання/)).toBeTruthy();
    expect(screen.getByText(/1,5 %/)).toBeTruthy();
    const preview = screen.getByLabelText("Попередній перегляд договору");
    expect(preview.textContent).toContain("1. Визначення окремих термінів договору.");
    expect(preview.textContent).toContain("5. Права і обов’язки Виконавця.");
    expect(preview.textContent).toContain("11. Інші умови.");
    expect(preview.textContent).toContain("12. Юридичні адреси, банківські реквізити і підписи Сторін.");

    fireEvent.change(screen.getByLabelText(/Ставка розрахунку, %/), { target: { value: "1,5" } });
    await waitFor(() => expect(screen.getByLabelText(/Сума договору, грн/)).toHaveProperty("value", "2 657,03"));
    expect(screen.getByLabelText("Живий перегляд договору технічного нагляду").textContent).toContain("2 657,03");
  });

  it("shows missing-data indicators without blocking on profile confirmation", async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Сформувати договір" }));
    await waitFor(() => expect(screen.getAllByText("Підтвердіть це поле").length).toBeGreaterThan(0));
    expect(screen.queryByRole("checkbox", { name: /актуальність реквізитів/i })).toBeNull();
    expect(screen.getAllByText(/Автозаповнено з профілю/).length).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("warns before replacing edited contractor data and keeps profile-specific details isolated", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Harness />);

    const selector = screen.getByLabelText("Профіль виконавця");
    fireEvent.change(screen.getByLabelText(/Реквізити виконавця/), { target: { value: "Власні реквізити" } });
    fireEvent.change(selector, { target: { value: "ik-zahid" } });

    expect(confirm).toHaveBeenCalledOnce();
    expect((screen.getByLabelText("Профіль виконавця") as HTMLSelectElement).value).toBe("fop-shevchuk");
    expect((screen.getByLabelText(/Реквізити виконавця/) as HTMLTextAreaElement).value).toBe("Власні реквізити");

    confirm.mockReturnValue(true);
    fireEvent.change(selector, { target: { value: "ik-zahid" } });
    expect((screen.getByLabelText("Профіль виконавця") as HTMLSelectElement).value).toBe("ik-zahid");
    expect((screen.getByLabelText(/Реквізити виконавця/) as HTMLTextAreaElement).value).toContain("ІК ЗАХІД");
    expect((screen.getByLabelText(/Реєстраційні дані виконавця/) as HTMLTextAreaElement).value).toBe("код ЄДРПОУ 45709671");
    expect((screen.getByLabelText(/Податковий статус виконавця/) as HTMLInputElement).value).toBe("");
    confirm.mockRestore();
  });
});
