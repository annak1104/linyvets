// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { useForm } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Avk5ParseResult } from "@/lib/avk5-parser";
import { emptyOrderValues, orderLinesFromEstimate, orderSchema, type OrderForm } from "@/lib/order-form";
import { ReviewEditStep } from "@/components/review-edit-step";

const parseResult: Avk5ParseResult = {
  data: {
    projectName: "Поточний ремонт проїзду до будинку №19б",
    finalEstimatedTotalThousandsUah: 197.271,
    finalEstimatedTotalThousandsUahText: "197,271",
    projectOrganization: null,
    chiefProjectEngineer: "Ігор ШЕВЧУК",
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
      lines: orderLinesFromEstimate([{
        id: "estimate-1",
        code: "02-01",
        name: "Поточний ремонт проїзду до будинку №19б",
        unit: null,
        quantity: null,
        price: null,
        totalThousandsUah: 131.855,
        totalThousandsUahText: "131,855",
        sourceRowIndex: 1,
        sourceText: "02-01 | Поточний ремонт проїзду до будинку №19б | 131,855",
        missingFields: ["unit", "quantity", "price"],
      }]),
    },
    mode: "onBlur",
  });
  const { fields } = useFieldArray({ control: form.control, name: "lines" });

  return (
    <ReviewEditStep
      fields={fields}
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

    expect(screen.getAllByDisplayValue("Поточний ремонт проїзду до будинку №19б")).toHaveLength(2);
    expect(screen.getByDisplayValue("Ігор ШЕВЧУК")).toBeTruthy();
    expect(screen.getByText(/Проєктну організацію не зазначено у джерелі/)).toBeTruthy();
    expect(screen.getByText("Показати джерело витягнутих даних")).toBeTruthy();
    expect(screen.getByText("Поточний ремонт проїзду до будинку №19б", { selector: "li" })).toBeTruthy();
    expect(screen.getByText("Дані з кошторису")).toBeTruthy();
    expect(screen.getByText(/У кошторисі: 131,855 тис\. грн/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Додати позицію/ })).toBeNull();

    const amount = screen.getByLabelText("Сума, тис. грн");
    fireEvent.change(amount, { target: { value: "200" } });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Двісті тисяч грн 00 коп.")).toBeTruthy();
      expect(screen.getByDisplayValue(/в сумі 200 тис\. грн\./)).toBeTruthy();
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

  it("submits extracted rows with source-only missing numeric values", async () => {
    const onSubmit = vi.fn(async () => undefined);
    const onInvalid = vi.fn();
    render(<ReviewHarness onSubmit={onSubmit} onInvalid={onInvalid} />);

    fireEvent.click(screen.getByRole("button", { name: /Сформувати AVK-5/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onInvalid).not.toHaveBeenCalled();
  });
});
