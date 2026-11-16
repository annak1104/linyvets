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


def paragraph_text(paragraph: etree._Element) -> str:
    return "".join(node.text or "" for node in paragraph.findall(".//w:t", namespaces=NS))


def replace_paragraph_text(paragraph: etree._Element, text: str, prefer_regular_run: bool = False) -> None:
    paragraph_properties = paragraph.find("w:pPr", namespaces=NS)
    runs = paragraph.findall("w:r", namespaces=NS)
    first_run = runs[0] if runs else None
    if prefer_regular_run:
        first_run = next((run for run in runs if run.find("w:rPr/w:b", namespaces=NS) is None and run.find("w:rPr/w:bCs", namespaces=NS) is None), first_run)
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


def find_index(paragraphs: list[etree._Element], needle: str, start: int = 0) -> int:
    for index in range(start, len(paragraphs)):
        if needle in paragraph_text(paragraphs[index]):
            return index
    raise RuntimeError(f"Could not find source paragraph containing: {needle}")


def create_template(source: Path, destination: Path) -> None:
    with zipfile.ZipFile(source, "r") as source_zip:
        root = etree.fromstring(source_zip.read("word/document.xml"))
        body = root.find("w:body", namespaces=NS)
        if body is None:
            raise RuntimeError("The source document has no Word body.")
        paragraphs = body.findall("w:p", namespaces=NS)
        if len(paragraphs) < 100:
            raise RuntimeError(f"Unexpected source structure: {len(paragraphs)} body paragraphs.")

        replace_paragraph_text(paragraphs[find_index(paragraphs, "Д О Г О В І Р")], "Д О Г О В І Р № {{contractNumber}}")
        replace_paragraph_text(paragraphs[find_index(paragraphs, "м. Луцьк")], "м. Луцьк                                                                                «{{documentDate}}»")

        intro_index = find_index(paragraphs, "Департамент житлово-комунального господарства Луцької міської ради")
        replace_paragraph_text(
            paragraphs[intro_index],
            "{{customerName}} (далі - Замовник) в особі {{customerRepresentative}}, що діє на підставі {{customerLegalBasis}}, з однієї сторони, та {{contractorName}}, що діє на підставі {{contractorRegistrationDetails}} та {{contractorCertificate}}, з другої сторони, разом іменовані «Сторони», уклали цей Договір на виконання технічного нагляду (надалі – Договір) про нижчезазначене:",
            prefer_regular_run=True,
        )

        subject_index = find_index(paragraphs, "Замовник доручає, а Виконавець здійснює технічний нагляд")
        replace_paragraph_text(paragraphs[subject_index], "2.1. Замовник доручає, а Виконавець здійснює технічний нагляд під час виконання будівельних робіт «{{projectName}}» (далі – “об`єкт”).")

        price_index = find_index(paragraphs, "Вартість виконання технічного нагляду розрахована")
        replace_paragraph_text(
            paragraphs[price_index],
            "3.1. Вартість виконання технічного нагляду розрахована згідно з листом Держбуду України від 04.10.2000р. № 7/7-1010 «Про врахування коштів на утримання служби замовника в інвесторській кошторисній документації» і становить не більше {{calculationRatePercent}}% від підсумку графи 8 глав 1-9 зведеного кошторису у розмірі {{chapters1To9TotalUah}} грн, а саме {{supervisionAmountUah}} грн ({{supervisionAmountInWords}}) без ПДВ.",
        )

        end_term_index = find_index(paragraphs, "Договір набирає чинності")
        replace_paragraph_text(paragraphs[end_term_index], "11.2. Договір набирає чинності з моменту його підписання повноважними представниками Сторін і діє до {{contractEndDate}} року, а в частині розрахунків до повного виконання Сторонами прийнятих на себе зобов’язань.")

        tax_index = find_index(paragraphs, "Замовник своїм підписом підтверджує")
        replace_paragraph_text(paragraphs[tax_index], "11.6. Замовник своїм підписом підтверджує, що він {{customerTaxStatus}}, Виконавець своїм підписом підтверджує, що він {{contractorTaxStatus}}.")

        appendix_index = find_index(paragraphs, "Додаток: розрахунок кошторисної вартості технічного нагляду")
        replace_paragraph_text(paragraphs[appendix_index], "Додаток: {{appendixReference}}.")

        if "Юридичні адреси, банківські реквізити і підписи Сторін" not in " ".join(paragraph_text(paragraph) for paragraph in paragraphs):
            raise RuntimeError("Could not find the contract signatures section.")
        tables = body.findall("w:tbl", namespaces=NS)
        if len(tables) != 1:
            raise RuntimeError(f"Unexpected source table count: {len(tables)}")
        signature_cells = tables[0].findall("w:tr", namespaces=NS)[0].findall("w:tc", namespaces=NS)
        if len(signature_cells) != 2:
            raise RuntimeError("The contract signatures table must contain customer and contractor cells.")

        customer_paragraphs = signature_cells[0].findall("w:p", namespaces=NS)
        customer_details_index = find_index(customer_paragraphs, "Департамент житлово-комунального")
        customer_role_index = find_index(customer_paragraphs, "Директор", customer_details_index + 1)
        replace_paragraph_text(customer_paragraphs[customer_details_index], "{{customerDetails}}")
        for index in range(customer_details_index + 1, customer_role_index):
            replace_paragraph_text(customer_paragraphs[index], "")
        replace_paragraph_text(customer_paragraphs[customer_role_index], "{{customerSignatureTitle}}")
        customer_signature_index = find_index(customer_paragraphs, "______________________", customer_role_index + 1)
        replace_paragraph_text(customer_paragraphs[customer_signature_index], "______________________ {{customerSignature}}")

        contractor_paragraphs = signature_cells[1].findall("w:p", namespaces=NS)
        contractor_details_index = find_index(contractor_paragraphs, "ФОП Шевчук")
        contractor_role_index = find_index(contractor_paragraphs, "ФОП", contractor_details_index + 1)
        replace_paragraph_text(contractor_paragraphs[contractor_details_index], "{{contractorDetails}}")
        for index in range(contractor_details_index + 1, contractor_role_index):
            replace_paragraph_text(contractor_paragraphs[index], "")
        replace_paragraph_text(contractor_paragraphs[contractor_role_index], "{{contractorSignatureTitle}}")
        contractor_signature_index = find_index(contractor_paragraphs, "_______________________", contractor_role_index + 1)
        replace_paragraph_text(contractor_paragraphs[contractor_signature_index], "_______________________ {{contractorSignature}}")

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
