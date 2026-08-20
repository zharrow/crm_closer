import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        /* 15 px et non 14 : ce champ contient le message qu'on relit avant
           de l'envoyer, c'est-à-dire le texte le plus important de l'app.
           Rayon moyen et non pilule — une pilule sur plusieurs lignes
           rogne la première et la dernière, et le texte s'y coince. */
        "flex min-h-24 w-full rounded-2xl border border-input bg-muted/60 px-4 py-3 text-dense leading-relaxed transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
