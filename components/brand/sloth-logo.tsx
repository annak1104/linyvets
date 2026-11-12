import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

type SlothLogoProps = SVGProps<SVGSVGElement> & {
  showWordmark?: boolean;
  compact?: boolean;
};

/** Original brand mark: a calm sloth taking the busywork out of documents. */
export function SlothLogo({ className, showWordmark = true, compact = false, ...props }: SlothLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <svg className={cn("h-12 w-16", compact && "h-9 w-12")} aria-hidden={showWordmark} focusable="false" role={showWordmark ? undefined : "img"} viewBox="0 0 112 88" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M30.5 42.5C24.8 38.2 21.6 31.6 22.1 24.2C22.5 17.9 26.8 12.5 33.1 11.2C39.4 9.9 44.4 13.8 46.6 19.7" fill="#6DAED6" />
        <path d="M81.5 42.5C87.2 38.2 90.4 31.6 89.9 24.2C89.5 17.9 85.2 12.5 78.9 11.2C72.6 9.9 67.6 13.8 65.4 19.7" fill="#6DAED6" />
        <path d="M23 51.5C23 34.1 36.5 20 56 20C75.5 20 89 34.1 89 51.5V59.5C89 68.6 81.6 76 72.5 76H39.5C30.4 76 23 68.6 23 59.5V51.5Z" fill="#6DAED6" />
        <path d="M38.5 48.5C37.5 41.7 42.1 35.5 49 34.3C54.1 33.4 58.2 35.5 61.2 38.8C64.2 35.5 68.3 33.4 73.4 34.3C80.3 35.5 84.9 41.7 83.9 48.5C83 54.5 77.8 59.1 71.7 59.1C67 59.1 63 56.5 61.2 52.7C59.4 56.5 55.4 59.1 50.7 59.1C44.6 59.1 39.4 54.5 38.5 48.5Z" fill="#FFF6E9" />
        <path d="M51.1 43.8C49.6 43.8 48.4 45.1 48.4 46.6C48.4 48.1 49.6 49.4 51.1 49.4C52.6 49.4 53.8 48.1 53.8 46.6C53.8 45.1 52.6 43.8 51.1 43.8Z" fill="#234A63" />
        <path d="M71.3 43.8C69.8 43.8 68.6 45.1 68.6 46.6C68.6 48.1 69.8 49.4 71.3 49.4C72.8 49.4 74 48.1 74 46.6C74 45.1 72.8 43.8 71.3 43.8Z" fill="#234A63" />
        <path d="M56.4 51.4C57.7 52.6 59.3 53.2 61.2 53.2C63.1 53.2 64.7 52.6 66 51.4" stroke="#234A63" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M32.5 63.5C27.9 62.5 23.8 63.4 20 66.2" stroke="#508FB7" strokeWidth="7" strokeLinecap="round" />
        <path d="M79.5 63.5C84.1 62.5 88.2 63.4 92 66.2" stroke="#508FB7" strokeWidth="7" strokeLinecap="round" />
        <rect x="29" y="61" width="54" height="21" rx="3.5" fill="#234A63" />
        <rect x="33" y="64.5" width="46" height="13" rx="2" fill="#EAF5FC" />
        <path d="M21 82H91" stroke="#234A63" strokeWidth="4" strokeLinecap="round" />
        <path d="M43 68.5H55M43 72.5H67" stroke="#6DAED6" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {showWordmark && <span className={cn("text-xl font-semibold tracking-[-0.03em] text-[#234A63]", compact && "text-base")}>Лінивець</span>}
    </span>
  );
}

export function SlothMark(props: SVGProps<SVGSVGElement>) {
  return <SlothLogo showWordmark={false} {...props} />;
}
