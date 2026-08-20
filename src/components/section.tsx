import { cn } from "@/lib/utils";

/**
 * « Voici une section », écrit une seule fois pour toute l'app.
 *
 * DESIGN.md pose la règle : une carte quand la carte *est* l'interaction —
 * une tâche, un échange. Pas comme boîte à ranger des titres. Il signalait
 * la dette dans la foulée : « `reglages` empile six cartes, la fiche
 * prospect cinq. Ce sont des groupements, pas des interactions. »
 *
 * Un intertitre et un filet font le même travail avec moins de meuble. Le
 * dispositif existait déjà dans la file du jour ; il vit ici pour que les
 * trois écrans qui l'emploient ne finissent pas par en avoir trois
 * variantes.
 *
 * L'étiquette est en `eyebrow` — casse, interlettrage et taille comprises —
 * parce que c'en est une : elle nomme ce qui suit, elle ne le titre pas.
 */
export function SectionHeading({
  label,
  count,
  tone = "default",
  className,
}: {
  label: string;
  /**
   * Écrit à côté de l'étiquette quand il apprend quelque chose. Zéro compte
   * aussi : « Signaux détectés · 0 » dit qu'on a cherché et rien trouvé, là
   * où l'absence de nombre laisse croire qu'on n'a pas regardé.
   */
  count?: number;
  tone?: "default" | "late";
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "eyebrow flex items-center gap-3",
        tone === "late" ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      <span>
        {label}
        {count !== undefined && (
          <>
            {" · "}
            <span className="numeric">{count}</span>
          </>
        )}
      </span>
      {/* Le filet court jusqu'au bord : c'est lui qui fait la séparation que
          la bordure d'une carte faisait avant, sans enfermer le contenu. */}
      <span aria-hidden className="h-px flex-1 bg-border" />
    </h2>
  );
}

export function Section({
  title,
  count,
  children,
  className,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <SectionHeading label={title} count={count} />
      {children}
    </section>
  );
}
