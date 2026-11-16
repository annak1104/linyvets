// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GeneratorWorkspace } from "@/components/generator-workspace";
import { ThemeProvider } from "@/components/theme-provider";
import type { Avk5ParseResult } from "@/lib/avk5-parser";

const parsedResult: Avk5ParseResult = {
  extractionStatus: "extracted",
  data: {
    documentType: "consolidated-estimate",
    estimateNumber: "06-01",
    projectName: "Тестовий проєкт",
    finalEstimatedTotalThousandsUah: 197.271,
    finalEstimatedTotalThousandsUahText: "197,271",
    projectOrganization: "Ігор ШЕВЧУК",
    chiefProjectEngineer: "Ігор ШЕВЧУК",
    preparedBy: "Ігор ШЕВЧУК",
    items: [],
    itemsTotalThousandsUah: null,
  },
  evidence: [],
  warnings: [],
  errors: [],
  verification: {
    status: "verified",
    summaryTotalThousandsUah: 197.271,
    estimateTableTotalThousandsUah: 197.271,
    explanatoryTotalThousandsUah: null,
    estimateItemsTotalThousandsUah: null,
  },
};

describe("GeneratorWorkspace document session", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ result: parsedResult }) })));
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("sends one parse request for one upload and keeps the official order selection", async () => {
    render(<ThemeProvider><GeneratorWorkspace /></ThemeProvider>);
    const dropzone = screen.getByRole("button", { name: "Завантажити файл кошторису" });
    const input = dropzone.querySelector("input[type=file]");
    if (!input) throw new Error("Upload input not found");

    fireEvent.change(input, { target: { files: [new File(["{\\rtf1}"], "estimate.rtf", { type: "application/rtf" })] } });

    await waitFor(() => expect(screen.getByRole("heading", { name: "Перевірте наказ перед формуванням." })).toBeTruthy());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe("/api/parse-estimate");
    expect(screen.getByRole("checkbox", { name: "Наказ про затвердження кошторису" })).toHaveProperty("checked", true);
    expect(screen.getByLabelText(/Сертифікат/)).toHaveProperty("value", "АТ № 007622");
    expect(screen.getByText("Автозаповнено з профілю")).toBeTruthy();
  });

  it("synchronizes the selected customer signatory across all document forms and protects manual overrides", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ThemeProvider><GeneratorWorkspace /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Обрати всі" }));
    const dropzone = screen.getByRole("button", { name: "Завантажити файл кошторису" });
    const input = dropzone.querySelector("input[type=file]");
    if (!input) throw new Error("Upload input not found");

    fireEvent.change(input, { target: { files: [new File(["{\\rtf1}"], "estimate.rtf", { type: "application/rtf" })] } });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Перевірте наказ перед формуванням." })).toBeTruthy());

    const selector = screen.getByLabelText("Підписант замовника") as HTMLSelectElement;
    expect(selector.value).toBe("director-lishchuk");
    fireEvent.change(selector, { target: { value: "acting-havryliuk" } });
    expect((screen.getByLabelText(/Посада підписанта замовника/) as HTMLInputElement).value).toBe("В.о. директора");
    expect((screen.getByLabelText(/Ім’я підписанта замовника/) as HTMLInputElement).value).toBe("Гаврилюк С.В.");

    fireEvent.change(screen.getByLabelText(/Ім’я підписанта замовника/), { target: { value: "Ручний підпис" } });
    fireEvent.change(selector, { target: { value: "acting-hrelia" } });
    expect(confirm).toHaveBeenCalledOnce();
    expect(selector.value).toBe("acting-havryliuk");
    expect((screen.getByLabelText(/Ім’я підписанта замовника/) as HTMLInputElement).value).toBe("Ручний підпис");

    confirm.mockReturnValue(true);
    fireEvent.change(selector, { target: { value: "acting-hrelia" } });
    expect((screen.getByLabelText(/Ім’я підписанта замовника/) as HTMLInputElement).value).toBe("Греля А.Ю.");

    fireEvent.click(screen.getByRole("tab", { name: "Розрахунок вартості технічного нагляду" }));
    expect((screen.getByLabelText(/ПІБ підписанта замовника/) as HTMLInputElement).value).toBe("Греля А.Ю.");
    expect((screen.getByLabelText(/Посада підписанта замовника/) as HTMLInputElement).value).toBe("В.о. директора");

    fireEvent.click(screen.getByRole("tab", { name: "Договір технічного нагляду" }));
    expect((screen.getByLabelText(/Уповноважений представник замовника/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/Підстава повноважень замовника/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/Посада замовника/) as HTMLInputElement).value).toBe("В.о. директора");
    expect((screen.getByLabelText(/Підпис замовника/) as HTMLInputElement).value).toBe("Греля А.Ю.");
    confirm.mockRestore();
  });
});

