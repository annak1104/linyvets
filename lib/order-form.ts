import { z } from "zod";

import type { Avk5EstimateItem } from "@/lib/avk5-parser";
import { parseThousandsUahToKopecks } from "@/lib/ua-currency-to-words";

export const DEFAULT_ORDER_PARAGRAPH = "Затвердити зведений кошторис вартості робіт (робочий проєкт):";

const lineSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().min(1, "Вкажіть назву позиції"),
  unit: z.string(),
  quantity: z.number().positive("Кількість має бути більшою за 0").nullable(),
  price: z.number().nonnegative("Ціна не може бути від’ємною").nullable(),
  sourceTotalThousandsUah: z.string(),
  sourceText: z.string(),
  sourceMissingFields: z.array(z.string()),
});

const amountSchema = z.string()
  .trim()
  .min(1, "Вкажіть суму")
  .refine((value) => {
    try {
      parseThousandsUahToKopecks(value);
      return true;
    } catch {
      return false;
    }
  }, "Введіть коректну суму, наприклад 197,271");

export const orderSchema = z.object({
  projectName: z.string().trim().min(2, "Додайте назву об’єкта"),
  projectOrganization: z.string(),
  chiefProjectEngineer: z.string(),
  certificate: z.string(),
  estimatedAmountThousandsUah: amountSchema,
  estimatedAmountInWords: z.string(),
  orderParagraph1: z.string().trim().min(1, "Додайте текст абзацу наказу"),
  orderParagraph2: z.string(),
  orderParagraph3: z.string(),
  orderParagraph4: z.string(),
  note: z.string(),
  lines: z.array(lineSchema),
});

export type OrderForm = z.infer<typeof orderSchema>;
export type OrderLineForm = OrderForm["lines"][number];

export const emptyOrderValues: OrderForm = {
  projectName: "",
  projectOrganization: "",
  chiefProjectEngineer: "",
  certificate: "",
  estimatedAmountThousandsUah: "",
  estimatedAmountInWords: "",
  orderParagraph1: DEFAULT_ORDER_PARAGRAPH,
  orderParagraph2: "",
  orderParagraph3: "",
  orderParagraph4: "",
  note: "",
  lines: [],
};

export function orderLinesFromEstimate(items: Avk5EstimateItem[]): OrderLineForm[] {
  return items.map((item) => ({
    id: item.id,
    code: item.code ?? "",
    name: item.name,
    unit: item.unit ?? "",
    quantity: item.quantity,
    price: item.price,
    sourceTotalThousandsUah: item.totalThousandsUahText ?? "",
    sourceText: item.sourceText,
    sourceMissingFields: item.missingFields,
  }));
}

export type OrderParagraphValues = Pick<OrderForm, "orderParagraph1" | "orderParagraph2" | "orderParagraph3" | "orderParagraph4">;

export function buildOrderParagraphs(values: Pick<OrderForm, "projectName" | "estimatedAmountThousandsUah" | "estimatedAmountInWords" | "projectOrganization" | "chiefProjectEngineer" | "certificate">): OrderParagraphValues {
  const projectParagraph = values.projectName && values.estimatedAmountThousandsUah && values.estimatedAmountInWords
    ? `${values.projectName} в сумі ${values.estimatedAmountThousandsUah} тис. грн. (${values.estimatedAmountInWords});`
    : "";
  const organizationParagraph = values.projectOrganization ? `Проєктна організація: ${values.projectOrganization}` : "";
  const engineerParagraph = values.chiefProjectEngineer
    ? `Головний інженер проєкту - ${values.chiefProjectEngineer}${values.certificate ? ` (сертифікат ${values.certificate})` : ""}.`
    : "";

  return {
    orderParagraph1: DEFAULT_ORDER_PARAGRAPH,
    orderParagraph2: projectParagraph,
    orderParagraph3: organizationParagraph,
    orderParagraph4: engineerParagraph,
  };
}
