"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink as ExternalLinkStatic, Info } from "lucide-react";
/* Animate UI là où le registre a l'icône, Lucide ailleurs. Le mélange est
   assumé : une icône figée vaut mieux qu'une icône approximative choisie
   pour la seule raison qu'elle bouge. */
import { Check } from "@/components/animate-ui/icons/check";
import { ChevronDown } from "@/components/animate-ui/icons/chevron-down";
import { Clock } from "@/components/animate-ui/icons/clock";
import { Copy } from "@/components/animate-ui/icons/copy";
import { Sparkles } from "@/components/animate-ui/icons/sparkles";
import { X } from "@/components/animate-ui/icons/x";
/* Les quatre canaux, tous animés : le canal se reconnaît d'abord à sa forme,
   autant que cette forme réagisse. `Mail` est écrite à la main — le registre
   Animate UI n'a aucune icône d'email. */
import { Mail } from "@/components/animate-ui/icons/mail";
import { PhoneCall } from "@/components/animate-ui/icons/phone-call";
import { Link2 } from "@/components/animate-ui/icons/link-2";
import { ExternalLink } from "@/components/animate-ui/icons/external-link";
import { ActionButton } from "@/components/action-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { channelTone, cn, relativeDay, scoreTone } from "@/lib/utils";
import { readTaskError } from "@/lib/task-error";
import { draftTaskNow, markTaskDone, saveTaskDraft, skipTask, snoozeTask } from "./actions";

export interface TaskCardData {
  id: string;
  channel: string;
  status: string;
  subject: string | null;
  body: string | null;
  error: string | null;
  dueAt: Date;
  stepPosition: number | null;
  leadId: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  linkedinUrl: string | null;
  score: number | null;
  scoreRationale: string | null;
}

const CHANNEL_META: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: "Email", icon: Mail },
  linkedin: { label: "LinkedIn", icon: Link2 },
  phone: { label: "Téléphone", icon: PhoneCall },
  contact_form: { label: "Formulaire", icon: ExternalLink },
};

/**
 * Une action de la file.
 *
 * La carte reste **montée** quand elle est repliée : seul son contenu
 * disparaît. C'est ce qui permet de replier une action dont le brouillon a
 * été retouché sans perdre les corrections — démonter le composant
 * emporterait `subject` et `body` avec lui. Le repli est donc un geste
 * d'affichage, jamais une perte.
 */
/**
 * Ce que la dernière rédaction a laissé derrière elle.
 *
 * Le texte brut de `tasks.error` s'affichait tel quel dans un encadré ocre :
 * un JSON d'API entier passait donc dans la carte, et « NEXT_PUBLIC_APP_URL
 * manquant » se lisait comme un diagnostic du moment alors que c'était le
 * souvenir d'un échec parfois vieux de plusieurs jours.
 *
 * Faute de colonne `error_at`, on ne peut pas dater l'échec — on le met donc
 * au passé dans le titre, ce qui suffit à ne plus le confondre avec un
 * contrôle en direct.
 */
function TaskNotice({ raw, hasDraft }: { raw: string; hasDraft: boolean }) {
  const notice = readTaskError(raw);

  if (notice.kind === "etat") {
    return (
      <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-meta leading-relaxed">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        {notice.title}
      </p>
    );
  }

  if (notice.kind === "avertissement") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-meta leading-relaxed">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <p>
          <span className="font-medium">{notice.title}</span>
          {notice.detail && <> — {notice.detail}</>}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-meta leading-relaxed">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 flex-1">
        {/* Au passé, explicitement : ce n'est pas un contrôle en direct. */}
        <p>
          <span className="font-medium">Dernière rédaction : {notice.title.toLowerCase()}</span>
        </p>
        <p className="mt-1 text-muted-foreground">{notice.hint}</p>
        {/* Un échec n'efface pas le brouillon précédent : le dire, sinon
            l'encadré semble contredire le texte parfaitement lisible qui
            s'affiche juste en dessous. */}
        {hasDraft && (
          <p className="mt-1 text-muted-foreground">
            Le message ci-dessous vient d&apos;une rédaction antérieure, qui avait
            abouti. Il reste modifiable et copiable.
          </p>
        )}
        {notice.raw && (
          /* Le détail technique se range, comme dans `(app)/error.tsx` : il
             sert quand on cherche, il encombre le reste du temps. */
          <details className="mt-2">
            <summary className="cursor-pointer text-muted-foreground">
              Détail technique
            </summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-muted-foreground">
              {notice.raw}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

export function TaskCard({
  task,
  late,
  expanded,
  onToggle,
}: {
  task: TaskCardData;
  /** Échéance antérieure à ce matin. Décidé côté serveur, avec le groupe. */
  late: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [subject, setSubject] = useState(task.subject ?? "");
  const [body, setBody] = useState(task.body ?? "");
  const [pending, startTransition] = useTransition();

  const meta = CHANNEL_META[task.channel] ?? CHANNEL_META.email;
  const Icon = meta.icon;
  const dirty = body !== (task.body ?? "") || subject !== (task.subject ?? "");

  /**
   * Le lien de désinscription pointe-t-il encore vers cette app ?
   *
   * Le corps est figé au moment de la rédaction : un brouillon écrit en
   * local porte un lien en `localhost`, qui ne mène nulle part pour son
   * destinataire. Or ce lien est obligatoire en prospection, et c'est
   * précisément le genre de détail qu'on ne relit pas — il est en pied de
   * message, toujours au même endroit, on cesse de le voir.
   *
   * On compare donc les origines, pas les chaînes : seul l'hôte compte, le
   * jeton qui suit est propre à chaque prospect.
   */
  const staleUnsubscribe = useMemo(() => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl || !body) return null;
    const found = body.match(/https?:\/\/\S+?\/u\/\S+/);
    if (!found) return null;
    try {
      const linkOrigin = new URL(found[0]).origin;
      return linkOrigin === new URL(appUrl).origin ? null : linkOrigin;
    } catch {
      return null;
    }
  }, [body]);

  const copy = async () => {
    const text = task.channel === "email" && subject ? `${subject}\n\n${body}` : body;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copié dans le presse-papier");
    } catch {
      toast.error("Copie impossible — sélectionne le texte à la main");
    }
  };

  const generate = () =>
    startTransition(async () => {
      const result = await draftTaskNow(task.id);
      if (result.error) toast.error(result.error);
      else toast.success("Brouillon généré");
    });

  const save = () =>
    startTransition(async () => {
      await saveTaskDraft(task.id, task.channel === "email" ? subject : null, body);
      toast.success("Brouillon enregistré");
    });

  const done = () =>
    startTransition(async () => {
      if (dirty) await saveTaskDraft(task.id, task.channel === "email" ? subject : null, body);
      await markTaskDone(task.id);
      toast.success("Marqué envoyé — la relance suivante est programmée");
    });

  const panelId = `action-${task.id}`;

  // Repliée : une ligne, et un bouton pour toute surface. Le nom de
  // l'entreprise y est du texte et non un lien — un lien dans un bouton
  // n'est pas du HTML valide, et le lien vers la fiche reste disponible
  // dès que la carte est ouverte.
  if (!expanded) {
    return (
      <Card>
        {/* `aria-controls` n'est pas posé ici : le panneau qu'il désignerait
            n'existe pas tant que la carte est repliée, et pointer vers un
            identifiant absent est pire que de ne rien pointer. `aria-expanded`
            suffit à annoncer l'état, c'est le motif habituel d'un accordéon.
            Les pastilles sont des `span` et non des `Badge` : ce dernier rend
            un `div`, et un `div` dans un `button` n'est pas du HTML valide. */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={false}
          className="flex w-full flex-wrap items-center gap-2 rounded-xl px-4 py-3 text-left transition-colors hover:bg-accent/40"
        >
          <span className={cn(badgeVariants({ variant: channelTone(task.channel) }), "gap-1")}>
            <Icon size={13} animateOnHover />
            <span className="sr-only sm:not-sr-only">{meta.label}</span>
          </span>
          <span className="font-semibold">{task.companyName}</span>
          {task.score !== null && (
            <span className={cn(badgeVariants({ variant: scoreTone(task.score) }))}>
              {task.score}
            </span>
          )}
          {/* Un brouillon retouché puis replié doit se signaler, sinon la
              correction est invisible et on la refait. */}
          {dirty && (
            <span className={cn(badgeVariants({ variant: "warning" }))}>
              Modifié, non enregistré
            </span>
          )}
          <span
            className={
              late
                ? "ml-auto text-meta text-destructive"
                : "ml-auto text-meta text-muted-foreground"
            }
          >
            {relativeDay(task.dueAt)}
          </span>
          <ChevronDown size={16} className="shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="gap-3 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={channelTone(task.channel)} className="gap-1">
            <Icon size={13} animateOnHover />
            {meta.label}
          </Badge>
          {task.stepPosition && (
            <Badge variant="outline">Étape {task.stepPosition}</Badge>
          )}
          {/* `depuis=file` sert au lien de retour de la fiche : sans lui, il
              renvoyait toujours vers la liste des prospects, y compris quand
              on arrivait d'ici. Un marqueur dans l'URL plutôt que l'historique
              du navigateur — comme ça le retour reste juste après un
              rechargement, ou si le lien est rouvert depuis un onglet. */}
          <Link
            href={`/prospects/${task.leadId}?depuis=file`}
            className="font-semibold hover:underline underline-offset-4"
          >
            {task.companyName}
          </Link>
          {task.score !== null && (
            <Badge variant={scoreTone(task.score)}>{task.score}</Badge>
          )}
          <span className={late ? "text-meta text-destructive" : "text-meta text-muted-foreground"}>
            {relativeDay(task.dueAt)}
          </span>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded
            aria-controls={panelId}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
          >
            <ChevronDown size={16} className="rotate-180" aria-hidden />
            <span className="sr-only">Replier l&apos;action pour {task.companyName}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {task.contactName && <span>{task.contactName}</span>}
          {task.channel === "email" && task.email && <span>{task.email}</span>}
          {task.channel === "phone" && task.phone && <span>{task.phone}</span>}
          {task.channel === "linkedin" && task.linkedinUrl && (
            <a
              href={task.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2"
            >
              Profil <ExternalLinkStatic className="h-3 w-3" />
            </a>
          )}
          {task.website && (
            <a
              href={task.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2"
            >
              Site <ExternalLinkStatic className="h-3 w-3" />
            </a>
          )}
        </div>

        {task.scoreRationale && (
          <p className="text-xs leading-relaxed text-muted-foreground">{task.scoreRationale}</p>
        )}
      </CardHeader>

      <CardContent id={panelId} className="flex flex-col gap-4">
        {staleUnsubscribe && (
          <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-meta leading-relaxed">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <span>
              <span className="font-medium">
                N&apos;envoie pas ce message tel quel.
              </span>{" "}
              Son lien de désinscription pointe vers {staleUnsubscribe}, pas vers
              l&apos;adresse actuelle de l&apos;app : le destinataire ne pourrait pas
              s&apos;y opposer. Régénère le message avant de l&apos;envoyer.
            </span>
          </p>
        )}

        {task.error && <TaskNotice raw={task.error} hasDraft={Boolean(task.body)} />}

        {task.status === "pending" || !task.body ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
            <p className="text-sm text-muted-foreground">
              Aucun brouillon pour cette action.
            </p>
            <ActionButton
              onClick={generate}
              disabled={pending}
              size="sm"
              tooltip="Fait rédiger le message par Claude à partir de ton offre et des signaux du prospect."
              confirm={{
                title: "Rédiger le message ?",
                description:
                  "Claude écrit le message en partant de ton offre, des problèmes que tu résous et des signaux détectés sur ce prospect. C'est un appel facturé, de quelques secondes. Rien n'est envoyé : le texte s'affiche ici, à toi de le relire, le corriger et le copier.",
                action: "Rédiger",
              }}
            >
              <Sparkles size={16} animate={pending} loop={pending} animateOnHover={!pending} />
              {pending ? "Rédaction…" : "Rédiger le message"}
            </ActionButton>
          </div>
        ) : (
          <>
            {/* Le libellé était le seul `placeholder` : il disparaissait dès
                que le champ contenait quelque chose, c'est-à-dire toujours,
                puisque le modèle le remplit. On ne voyait donc plus qu'une
                ligne de texte en gras, sans savoir que c'était l'objet. */}
            {task.channel === "email" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`objet-${task.id}`}>Objet</Label>
                <Input
                  id={`objet-${task.id}`}
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="L'objet de l'email"
                  className="font-medium"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`corps-${task.id}`}>Message</Label>
              <Textarea
                id={`corps-${task.id}`}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={task.channel === "linkedin" ? 6 : 14}
                className="resize-y font-[inherit]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                onClick={copy}
                variant="secondary"
                size="sm"
                tooltip="Copie le message dans le presse-papier. Rien n'est envoyé ni modifié."
              >
                <Copy size={16} animateOnHover />
                Copier
              </ActionButton>
              <ActionButton
                onClick={done}
                disabled={pending}
                size="sm"
                tooltip="À cliquer une fois que tu as envoyé le message depuis ton client mail. Programme la relance suivante."
                confirm={{
                  title: "Marquer ce message comme envoyé ?",
                  description:
                    "À ne faire qu'après l'avoir réellement envoyé depuis ton client mail — l'app n'envoie rien elle-même. Le message est archivé dans le fil de conversation du prospect, l'action sort de ta file, et l'étape suivante de la séquence est programmée à sa date (LinkedIn à +4 jours, puis emails à +7 et +10 jours). S'il n'y a plus d'étape, la séquence se clôt.",
                  action: "J'ai envoyé, marquer fait",
                }}
              >
                <Check size={16} animateOnHover />
                Marquer envoyé
              </ActionButton>
              {dirty && (
                <ActionButton
                  onClick={save}
                  disabled={pending}
                  variant="outline"
                  size="sm"
                  tooltip="Enregistre tes corrections sur ce brouillon."
                >
                  Enregistrer
                </ActionButton>
              )}
              <ActionButton
                onClick={generate}
                disabled={pending}
                variant="ghost"
                size="sm"
                tooltip="Fait réécrire le message par Claude. Le texte actuel est perdu."
                confirm={{
                  title: "Régénérer le message ?",
                  description:
                    "Claude réécrit le message de zéro et le texte affiché est remplacé — si tu l'as retouché, tes modifications sont perdues et rien ne permet de les récupérer. C'est un appel facturé. Si tu veux garder ta version, copie-la avant.",
                  action: "Régénérer",
                }}
              >
                <Sparkles size={16} animate={pending} loop={pending} animateOnHover={!pending} />
                Régénérer
              </ActionButton>

              <div className="ml-auto flex items-center gap-1">
                <ActionButton
                  onClick={() => startTransition(() => snoozeTask(task.id, 3).then(() => {}))}
                  disabled={pending}
                  variant="ghost"
                  size="sm"
                  tooltip="Repousse cette action de 3 jours. Elle disparaît de la file jusque-là."
                  confirm={{
                    title: "Reporter de 3 jours ?",
                    description:
                      "L'action quitte ta file du jour et y revient dans 3 jours. Le brouillon déjà rédigé est conservé, la séquence n'est pas interrompue — seule la date d'échéance bouge.",
                    action: "Reporter",
                  }}
                >
                  <Clock size={16} animateOnHover />
                  +3 j
                </ActionButton>
                <ActionButton
                  onClick={() => startTransition(() => skipTask(task.id).then(() => {}))}
                  disabled={pending}
                  variant="ghost"
                  size="sm"
                  aria-label="Passer cette étape"
                  tooltip="Passe cette étape sans l'envoyer et programme directement la suivante."
                  confirm={{
                    title: "Passer cette étape ?",
                    description:
                      "L'action est marquée ignorée et son brouillon est abandonné — tu ne pourras pas y revenir. La séquence continue quand même : l'étape suivante est programmée à sa date, comme si tu avais envoyé celle-ci. Pour arrêter les relances de ce prospect, utilise plutôt « Perdu » ou « Exclure » sur sa fiche.",
                    action: "Passer l'étape",
                    destructive: true,
                  }}
                >
                  <X size={16} animateOnHover aria-hidden />
                </ActionButton>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
