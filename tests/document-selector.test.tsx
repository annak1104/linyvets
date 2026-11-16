// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DocumentSelector } from "@/components/document-selector";
import { defaultSelectedDocumentIds } from "@/lib/documents/registry";
import type { DocumentId } from "@/lib/documents/types";

describe("DocumentSelector", () => {
  afterEach(() => cleanup());

  it("keeps the official order selected and exposes the implemented generators", () => {
    render(<DocumentSelector selectedDocumentIds={defaultSelectedDocumentIds} onChange={() => undefined} />);

    expect(screen.getByRole("checkbox", { name: "Наказ про затвердження кошторису" })).toHaveProperty("checked", true);
    expect(screen.getByRole("checkbox", { name: "Договір технічного нагляду" })).toHaveProperty("disabled", false);
    expect(screen.queryAllByText("Незабаром")).toHaveLength(0);
  });

  it("supports selecting all and clearing the available selection", () => {
    let selected: DocumentId[] = defaultSelectedDocumentIds;
    const onChange = (next: DocumentId[]) => { selected = next; };
    const { rerender } = render(<DocumentSelector selectedDocumentIds={selected} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Очистити вибір" }));
    expect(selected).toEqual([]);
    rerender(<DocumentSelector selectedDocumentIds={selected} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Обрати всі" }));
    expect(selected).toEqual(["official-estimate-order", "technical-supervision-calculation", "technical-supervision-contract"]);
  });
});

