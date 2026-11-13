import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => {
  return <textarea ref={ref} className={cn("focus-ring min-h-24 w-full resize-y rounded-xl border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary", className)} {...props} />;
});
Textarea.displayName = "Textarea";
