export type DecimalInput = string | number | bigint;

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const HUNDRED = BigInt(100);
const THOUSAND = BigInt(1000);
const HUNDRED_THOUSAND = BigInt(100_000);

const ONES_MASCULINE = [
  "нуль",
  "один",
  "два",
  "три",
  "чотири",
  "п’ять",
  "шість",
  "сім",
  "вісім",
  "дев’ять",
];

const ONES_FEMININE = [
  "нуль",
  "одна",
  "дві",
  "три",
  "чотири",
  "п’ять",
  "шість",
  "сім",
  "вісім",
  "дев’ять",
];

const TEENS = [
  "десять",
  "одинадцять",
  "дванадцять",
  "тринадцять",
  "чотирнадцять",
  "п’ятнадцять",
  "шістнадцять",
  "сімнадцять",
  "вісімнадцять",
  "дев’ятнадцять",
];

const TENS = [
  "",
  "",
  "двадцять",
  "тридцять",
  "сорок",
  "п’ятдесят",
  "шістдесят",
  "сімдесят",
  "вісімдесят",
  "дев’яносто",
];

const HUNDREDS = [
  "",
  "сто",
  "двісті",
  "триста",
  "чотириста",
  "п’ятсот",
  "шістсот",
  "сімсот",
  "вісімсот",
  "дев’ятсот",
];

function inputToText(value: DecimalInput): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError("Сума має бути скінченним числом.");
    }
    return String(value);
  }

  return String(value).trim();
}

function normalizeDecimal(value: DecimalInput): { integer: bigint; fraction: string } {
  const source = inputToText(value).replace(/\s+/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(source)) {
    throw new TypeError("Сума має бути невід’ємним десятковим числом.");
  }

  const [integerPart, fraction = ""] = source.split(".");
  return { integer: BigInt(integerPart), fraction };
}

/**
 * Converts a decimal number expressed in thousands of UAH to kopecks.
 * The scale conversion is done with BigInt, not floating-point arithmetic.
 */
export function parseThousandsUahToKopecks(value: DecimalInput): bigint {
  const { integer, fraction } = normalizeDecimal(value);
  const targetScale = 5;
  const base = integer * HUNDRED_THOUSAND;

  if (fraction.length <= targetScale) {
    return base + BigInt(fraction.padEnd(targetScale, "0") || "0");
  }

  const retained = BigInt(fraction.slice(0, targetScale) || "0");
  const discarded = BigInt(fraction.slice(targetScale) || "0");
  const divisor = BigInt(10) ** BigInt(fraction.length - targetScale);
  const rounded = discarded * TWO >= divisor ? ONE : ZERO;
  return base + retained + rounded;
}

export function formatThousandsUah(value: DecimalInput): string {
  const { integer, fraction } = normalizeDecimal(value);
  const normalizedFraction = fraction.replace(/0+$/, "");
  return normalizedFraction ? `${integer},${normalizedFraction}` : `${integer}`;
}

function underThousandToWords(value: number, feminine: boolean): string {
  if (value === 0) return "";

  const words: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;

  if (hundreds > 0) words.push(HUNDREDS[hundreds]);
  if (remainder >= 10 && remainder <= 19) {
    words.push(TEENS[remainder - 10]);
  } else {
    const tens = Math.floor(remainder / 10);
    const ones = remainder % 10;
    if (tens > 1) words.push(TENS[tens]);
    if (ones > 0) words.push((feminine ? ONES_FEMININE : ONES_MASCULINE)[ones]);
  }

  return words.join(" ");
}

function pluralForm(value: number, forms: [string, string, string]): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  switch (value % 10) {
    case 1:
      return forms[0];
    case 2:
    case 3:
    case 4:
      return forms[1];
    default:
      return forms[2];
  }
}

function hryvniaIntegerToWords(value: bigint): string {
  if (value === ZERO) return "нуль";

  const groups: number[] = [];
  let remainder = value;
  while (remainder > ZERO) {
    groups.push(Number(remainder % THOUSAND));
    remainder /= THOUSAND;
  }

  const words: string[] = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (group === 0) continue;

    if (index === 0) {
      // The final UAH group agrees with the feminine noun “гривня”.
      words.push(underThousandToWords(group, true));
    } else if (index === 1) {
      words.push(underThousandToWords(group, true));
      words.push(pluralForm(group, ["тисяча", "тисячі", "тисяч"]));
    } else {
      words.push(underThousandToWords(group, false));
      const label = index === 2 ? ["мільйон", "мільйони", "мільйонів"] : ["мільярд", "мільярди", "мільярдів"];
      words.push(pluralForm(group, label as [string, string, string]));
    }
  }

  return words.join(" ");
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

/**
 * Converts thousands of UAH to the wording used in the source order.
 * Example: `197,271` -> `Сто дев’яносто сім тисяч двісті сімдесят одна грн 00 коп.`
 */
export function amountInWordsUkrainian(value: DecimalInput): string {
  const kopecks = parseThousandsUahToKopecks(value);
  const hryvnias = kopecks / HUNDRED;
  const minor = kopecks % HUNDRED;
  const kopecksText = minor.toString().padStart(2, "0");
  return `${capitalize(hryvniaIntegerToWords(hryvnias))} грн ${kopecksText} коп.`;
}
