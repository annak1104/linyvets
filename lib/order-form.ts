import { z } from "zod";

import { parseThousandsUahToKopecks } from "@/lib/ua-currency-to-words";

export const DEFAULT_ORDER_PARAGRAPH = "Затвердити зведений кошторис вартості робіт (робочий проєкт):";

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
});

export type OrderForm = z.infer<typeof orderSchema>;

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
};

export type OrderParagraphValues = Pick<OrderForm, "orderParagraph1" | "orderParagraph2" | "orderParagraph3" | "orderParagraph4">;

export function buildOrderParagraphs(values: Pick<OrderForm, "projectName" | "estimatedAmountThousandsUah" | "estimatedAmountInWords" | "projectOrganization" | "chiefProjectEngineer" | "certificate">): OrderParagraphValues {
  const projectParagraph = values.projectName && values.estimatedAmountThousandsUah && values.estimatedAmountInWords
    ? `${values.projectName} в сумі ${values.estimatedAmountThousandsUah} тис. грн. (${values.estimatedAmountInWords});`
    : "";
  const organizationParagraph = `Проєктна організація: ${values.projectOrganization ?? ""}`;
  const engineerName = values.chiefProjectEngineer ?? "";
  const certificate = engineerName && values.certificate ? ` (сертифікат ${values.certificate})` : "";
  const engineerParagraph = `Головний інженер проєкту: ${engineerName}${certificate}`;

  return {
    orderParagraph1: DEFAULT_ORDER_PARAGRAPH,
    orderParagraph2: projectParagraph,
    orderParagraph3: organizationParagraph,
    orderParagraph4: engineerParagraph,
  };
}
