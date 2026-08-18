import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        /* 15 px et non 14 : ce champ contient le message qu'on relit avant
           de l'envoyer, c'est-à-dire le texte le plus important de l'app. */
        "flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-dense leading-relaxed shadow-sm transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
