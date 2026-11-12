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


def replace_paragraph_text(paragraph: etree._Element, text: str, hidden: bool = False) -> None:
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
    if hidden:
        if run_properties is None:
            run_properties = etree.SubElement(run, qn("rPr"))
        etree.SubElement(run_properties, qn("vanish"))
    text_node = etree.SubElement(run, qn("t"))
    text_node.set(f"{{{XML_NS}}}space", "preserve")
    text_node.text = text
    paragraph.append(run)


def center_paragraph(paragraph: etree._Element) -> None:
    paragraph_properties = paragraph.find("w:pPr", namespaces=NS)
    if paragraph_properties is None:
        paragraph_properties = etree.Element(qn("pPr"))
        paragraph.insert(0, paragraph_properties)

    alignment = paragraph_properties.find("w:jc", namespaces=NS)
    if alignment is None:
        alignment = etree.SubElement(paragraph_properties, qn("jc"))
    alignment.set(qn("val"), "center")


def create_template(source: Path, destination: Path) -> None:
    with zipfile.ZipFile(source, "r") as source_zip:
        document_xml = source_zip.read("word/document.xml")
        root = etree.fromstring(document_xml)
        paragraphs = root.find("w:body", namespaces=NS).findall("w:p", namespaces=NS)

        if len(paragraphs) != 27:
            raise RuntimeError(f"Unexpected source paragraph count: {len(paragraphs)}")

        # The Tryzub is a VML/OLE shape anchored in paragraph 1. Make the
        # anchor explicitly centered so Word centers it within the text area
        # instead of relying only on the shape's absolute margin-left.
        center_paragraph(paragraphs[1])

        replace_paragraph_text(paragraphs[14], "{{orderParagraph1}}")
        replace_paragraph_text(paragraphs[16], "{{orderParagraph2}}")
        replace_paragraph_text(paragraphs[18], "{{orderParagraph3}}")
        replace_paragraph_text(paragraphs[19], "{{orderParagraph4}}")
        replace_paragraph_text(
            paragraphs[15],
            "{{projectName}}{{estimatedAmount}}{{estimatedAmountInWords}}{{projectOrganization}}{{chiefProjectEngineer}}{{certificate}}",
            hidden=True,
        )

        updated_document_xml = etree.tostring(
            root,
            xml_declaration=True,
            encoding="UTF-8",
            standalone="yes",
        )

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
