import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

export type OrderLine = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
};

const money = new Intl.NumberFormat("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function createAvkDocument(lines: OrderLine[]) {
  const total = lines.reduce((sum, line) => sum + line.quantity * line.price, 0);
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: ["Найменування", "Од.", "Кількість", "Ціна", "Сума"].map((label) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })] })),
      }),
      ...lines.map((line) =>
        new TableRow({
          children: [line.name, line.unit, String(line.quantity), money.format(line.price), money.format(line.quantity * line.price)].map((value) => new TableCell({ children: [new Paragraph(value)] })),
        }),
      ),
      new TableRow({
        children: [
          new TableCell({ columnSpan: 4, children: [new Paragraph({ children: [new TextRun({ text: "Разом", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: money.format(total), bold: true })] })] }),
        ],
      }),
    ],
  });

  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "АВК-5", heading: HeadingLevel.TITLE }),
          new Paragraph({ text: "Відомість ресурсів та замовлення", spacing: { after: 240 } }),
          table,
          new Paragraph({ text: "Документ створено у Лінивці", spacing: { before: 360 } }),
        ],
      },
    ],
  });

  return Packer.toBlob(document);
}
