import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "cream";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white shadow-sm hover:bg-primary-hover",
  secondary: "bg-primary text-white shadow-sm hover:bg-primary-hover",
  ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
  outline: "border bg-white text-foreground shadow-sm hover:bg-accent",
  cream: "bg-cream text-foreground shadow-sm hover:bg-[#ffeed7]",
};

export function Button({ className, variant = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn("focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50", variants[variant], className)}
      {...props}
    />
  );
}
