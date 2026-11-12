import Image from "next/image";
import { cn } from "@/lib/utils";

type SlothLogoProps = {
  className?: string;
  showWordmark?: boolean;
  compact?: boolean;
  priority?: boolean;
};

/** Official brand mark supplied for Лінивець. */
export function SlothLogo({
  className,
  showWordmark = true,
  compact = false,
  priority = false,
}: SlothLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <Image
        src="/brand/sloth-dreamy.webp"
        alt={showWordmark ? "" : "Лінивець"}
        width={compact ? 40 : 56}
        height={compact ? 40 : 56}
        sizes={compact ? "40px" : "56px"}
        priority={priority}
        aria-hidden={showWordmark ? true : undefined}
        className={cn(
          "shrink-0 object-contain",
          compact ? "size-10" : "size-14",
        )}
      />
      {showWordmark && (
        <span
          className={cn(
            "text-xl font-semibold tracking-[-0.03em] text-[#234A63]",
            compact && "text-base",
          )}
        >
          Лінивець
        </span>
      )}
    </span>
  );
}

export function SlothMark(props: Omit<SlothLogoProps, "showWordmark">) {
  return <SlothLogo showWordmark={false} {...props} />;
}
