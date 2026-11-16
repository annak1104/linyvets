from __future__ import annotations

import argparse
import zipfile
from copy import deepcopy
from pathlib import Path

from lxml import etree


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
XML_NS = "http://www.w3.org/XML/1998/namespace"
NS = {"w": W_NS}


def qn(local_name: str) -> str:
    return f"{{{W_NS}}}{local_name}"


def replace_paragraph_text(paragraph: etree._Element, text: str) -> None:
    paragraph_properties = paragraph.find("w:pPr", namespaces=NS)
    first_run = paragraph.find("w:r", namespaces=NS)
    run_properties = None
    if first_run is not None:
        original_properties = first_run.find("w:rPr", namespaces=NS)
        if original_properties is not None:
            run_properties = deepcopy(original_properties)

    for child in list(paragraph):
        if child is not paragraph_properties:
            paragraph.remove(child)

    run = etree.Element(qn("r"))
    if run_properties is not None:
        run.append(run_properties)
    text_node = etree.SubElement(run, qn("t"))
    text_node.set(f"{{{XML_NS}}}space", "preserve")
    text_node.text = text
    paragraph.append(run)


def body_paragraphs(root: etree._Element) -> list[etree._Element]:
    body = root.find("w:body", namespaces=NS)
    if body is None:
        raise RuntimeError("The source document has no Word body.")
    return body.findall("w:p", namespaces=NS)


def body_tables(root: etree._Element) -> list[etree._Element]:
    body = root.find("w:body", namespaces=NS)
    if body is None:
        raise RuntimeError("The source document has no Word body.")
    return body.findall("w:tbl", namespaces=NS)


def table_cells(table: etree._Element, row_index: int) -> list[etree._Element]:
    rows = table.findall("w:tr", namespaces=NS)
    return rows[row_index].findall("w:tc", namespaces=NS)


def cell_paragraphs(cell: etree._Element) -> list[etree._Element]:
    return cell.findall("w:p", namespaces=NS)


def create_template(source: Path, destination: Path) -> None:
    with zipfile.ZipFile(source, "r") as source_zip:
        root = etree.fromstring(source_zip.read("word/document.xml"))
        paragraphs = body_paragraphs(root)
        tables = body_tables(root)

        if len(paragraphs) != 16 or len(tables) != 2:
            raise RuntimeError(f"Unexpected source structure: {len(paragraphs)} body paragraphs, {len(tables)} tables.")

        replace_paragraph_text(paragraphs[3], 'від  {{documentDate}}')
        replace_paragraph_text(paragraphs[4], "№ {{contractNumber}}")
        replace_paragraph_text(paragraphs[12], "Всього: {{supervisionAmountUah}} грн ({{supervisionAmountInWords}}) без ПДВ")

        calculation_table = tables[0]
        calculation_rows = calculation_table.findall("w:tr", namespaces=NS)
        calculation_cells = [row.findall("w:tc", namespaces=NS) for row in calculation_rows]
        replace_paragraph_text(cell_paragraphs(calculation_cells[1][3])[0], "Технічний нагляд, {{calculationRatePercent}}%, грн")
        replace_paragraph_text(cell_paragraphs(calculation_cells[3][0])[0], "«{{projectName}}»")
        replace_paragraph_text(cell_paragraphs(calculation_cells[3][1])[0], "{{consolidatedTotalUah}}")
        replace_paragraph_text(cell_paragraphs(calculation_cells[3][2])[0], "{{chapters1To9TotalUah}}")
        replace_paragraph_text(cell_paragraphs(calculation_cells[3][3])[0], "{{supervisionAmountUah}}")
        replace_paragraph_text(cell_paragraphs(calculation_cells[4][1])[0], "{{chapters1To9Expression}}")
        replace_paragraph_text(cell_paragraphs(calculation_cells[4][2])[0], "{{supervisionAmountUah}}")

        parties_table = tables[1]
        party_cells = table_cells(parties_table, 0)
        customer_paragraphs = cell_paragraphs(party_cells[0])
        replace_paragraph_text(customer_paragraphs[0], "{{customerDetails}}")
        for index in range(1, 11):
            replace_paragraph_text(customer_paragraphs[index], "")
        replace_paragraph_text(customer_paragraphs[11], "{{customerSignatureTitle}}")
        replace_paragraph_text(customer_paragraphs[13], "______________________ {{customerDirector}}")

        contractor_paragraphs = cell_paragraphs(party_cells[1])
        replace_paragraph_text(contractor_paragraphs[0], "{{contractorDetails}}")
        for index in range(1, 10):
            replace_paragraph_text(contractor_paragraphs[index], "")
        replace_paragraph_text(contractor_paragraphs[10], "{{contractorSignatureTitle}}")
        replace_paragraph_text(contractor_paragraphs[12], "_______________________ {{contractorSignature}}")

        updated_document_xml = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone="yes")
        destination.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(destination, "w") as destination_zip:
            for item in source_zip.infolist():
                payload = updated_document_xml if item.filename == "word/document.xml" else source_zip.read(item.filename)
                destination_zip.writestr(item, payload)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    create_template(args.source, args.destination)


if __name__ == "__main__":
    main()

