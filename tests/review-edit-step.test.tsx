// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Avk5ParseResult } from "@/lib/avk5-parser";
import { emptyOrderValues, orderSchema, type OrderForm } from "@/lib/order-form";
import { ReviewEditStep } from "@/components/review-edit-step";

const parseResult: Avk5ParseResult = {
  extractionStatus: "extracted",
  data: {
    documentType: "consolidated-estimate",
    estimateNumber: null,
    projectName: "Поточний ремонт проїзду до будинку №19б",
    finalEstimatedTotalThousandsUah: 197.271,
    finalEstimatedTotalThousandsUahText: "197,271",
    projectOrganization: null,
    chiefProjectEngineer: "Ігор ШЕВЧУК",
    preparedBy: "Ігор ШЕВЧУК",
    items: [],
    itemsTotalThousandsUah: 131.855,
  },
  evidence: [{
    section: "project-name",
    label: "Проєкт",
    paragraphIndex: 1,
    text: "Поточний ремонт проїзду до будинку №19б",
    matchedText: "Поточний ремонт проїзду до будинку №19б",
  }],
  warnings: [{
    code: "MISSING_PROJECT_ORGANIZATION",
    field: "projectOrganization",
    message: "missing",
  }],
  errors: [],
  verification: {
    status: "verified",
    summaryTotalThousandsUah: 197.271,
    estimateTableTotalThousandsUah: 197.271,
    explanatoryTotalThousandsUah: 197.271,
    estimateItemsTotalThousandsUah: null,
  },
};

function ReviewHarness({ emptyRequiredFields = false, onSubmit = vi.fn(async () => undefined), onInvalid }: { emptyRequiredFields?: boolean; onSubmit?: (values: OrderForm) => Promise<void>; onInvalid?: (errors: Parameters<NonNullable<React.ComponentProps<typeof ReviewEditStep>["onInvalid"]>>[0]) => void }) {
  const form = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      ...emptyOrderValues,
      projectName: emptyRequiredFields ? "" : parseResult.data.projectName ?? "",
      estimatedAmountThousandsUah: emptyRequiredFields ? "" : "197,271",
      estimatedAmountInWords: emptyRequiredFields ? "" : "Сто дев’яносто сім тисяч двісті сімдесят одна грн 00 коп.",
      chiefProjectEngineer: parseResult.data.chiefProjectEngineer ?? "",
    },
    mode: "onBlur",
  });

  return (
    <ReviewEditStep
      form={form}
      parseResult={parseResult}
      isGenerating={false}
      selectedFile={new File(["rtf"], "estimate.rtf", { type: "application/rtf" })}
      onBack={vi.fn()}
      onInvalid={onInvalid}
      onSubmit={onSubmit}
    />
  );
}

describe("ReviewEditStep", () => {
  afterEach(() => cleanup());

  it("prefills parsed values, shows warnings and evidence, and updates the live preview", async () => {
    render(<ReviewHarness />);

    expect(screen.getAllByDisplayValue("Поточний ремонт проїзду до будинку №19б")).toHaveLength(1);
    expect(screen.getByDisplayValue("Ігор ШЕВЧУК")).toBeTruthy();
    await waitFor(() => {
      expect((screen.getByLabelText("Абзац 3 · організація") as HTMLTextAreaElement).value).toBe("Проєктна організація: ");
      expect((screen.getByLabelText("Абзац 4 · інженер") as HTMLTextAreaElement).value).toBe("Головний інженер проєкту: Ігор ШЕВЧУК");
    });
    expect(screen.getByText(/Проєктну організацію не зазначено у джерелі/)).toBeTruthy();
    expect(screen.getByText("Автоматично").classList.contains("whitespace-nowrap")).toBe(true);
    expect(screen.getAllByText("Не знайдено у джерелі").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Знайдено у джерелі")[0].classList.contains("bg-accent")).toBe(true);
    expect(screen.getByText("Показати джерело реквізитів наказу")).toBeTruthy();
    expect(screen.queryByText("Позиції замовлення")).toBeNull();
    expect(screen.queryByText("Дані з кошторису")).toBeNull();

    const amount = screen.getByLabelText(/Сума, тис\. грн/);
    fireEvent.change(amount, { target: { value: "200" } });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Двісті тисяч грн 00 коп.")).toBeTruthy();
      expect(screen.getByDisplayValue(/в сумі 200 тис\. грн\./)).toBeTruthy();
      expect(screen.getByText("Змінено вручну").classList.contains("bg-cream")).toBe(true);
      expect(screen.getAllByText(/200/).length).toBeGreaterThan(0);
    });
  });

  it("shows required-field errors instead of inventing missing values", async () => {
    render(<ReviewHarness emptyRequiredFields />);

    fireEvent.click(screen.getAllByRole("button", { name: /Сформувати AVK-5/ })[0]);

    await waitFor(() => {
      expect(screen.getByText("Додайте назву об’єкта")).toBeTruthy();
      expect(screen.getByText("Вкажіть суму")).toBeTruthy();
    });
  });

  it("submits the official-order fields without item state", async () => {
    const onSubmit = vi.fn(async () => undefined);
    const onInvalid = vi.fn();
    render(<ReviewHarness onSubmit={onSubmit} onInvalid={onInvalid} />);

    fireEvent.click(screen.getByRole("button", { name: /Сформувати AVK-5/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it("preserves manually edited organization and engineer paragraphs during repeated synchronization", async () => {
    render(<ReviewHarness />);

    const organizationParagraph = screen.getByLabelText("Абзац 3 · організація");
    const engineerParagraph = screen.getByLabelText("Абзац 4 · інженер");
    fireEvent.change(organizationParagraph, { target: { value: "Власний абзац організації" } });
    fireEvent.change(engineerParagraph, { target: { value: "Власний абзац інженера" } });
    fireEvent.change(screen.getByLabelText(/Проєктна організація/), { target: { value: "Нове ім’я" } });
    fireEvent.change(screen.getByLabelText(/^Головний інженер проєкту/), { target: { value: "Новий інженер" } });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Власний абзац організації")).toBeTruthy();
      expect(screen.getByDisplayValue("Власний абзац інженера")).toBeTruthy();
    });
  });
});
