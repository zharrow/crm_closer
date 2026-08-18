"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Link2,
  Mail,
  Phone,
  Sparkles,
  X,
} from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { channelTone, relativeDay, scoreTone } from "@/lib/utils";
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
  phone: { label: "Téléphone", icon: Phone },
  contact_form: { label: "Formulaire", icon: ExternalLink },
};

export function TaskCard({ task }: { task: TaskCardData }) {
  const [subject, setSubject] = useState(task.subject ?? "");
  const [body, setBody] = useState(task.body ?? "");
  const [pending, startTransition] = useTransition();

  const meta = CHANNEL_META[task.channel] ?? CHANNEL_META.email;
  const Icon = meta.icon;
  const dirty = body !== (task.body ?? "") || subject !== (task.subject ?? "");

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

  const overdue = new Date(task.dueAt).getTime() < Date.now() - 86_400_000;

  return (
    <Card>
      <CardHeader className="gap-3 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={channelTone(task.channel)} className="gap-1">
            <Icon className="h-3 w-3" />
            {meta.label}
          </Badge>
          {task.stepPosition && (
            <Badge variant="outline">Étape {task.stepPosition}</Badge>
          )}
          <Link
            href={`/prospects/${task.leadId}`}
            className="font-semibold hover:underline underline-offset-4"
          >
            {task.companyName}
          </Link>
          {task.score !== null && (
            <Badge variant={scoreTone(task.score)}>{task.score}</Badge>
          )}
          <span className={overdue ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {relativeDay(task.dueAt)}
          </span>
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
              Profil <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {task.website && (
            <a
              href={task.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2"
            >
              Site <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {task.scoreRationale && (
          <p className="text-xs leading-relaxed text-muted-foreground">{task.scoreRationale}</p>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {task.error && (
          <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs leading-relaxed">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            {task.error}
          </p>
        )}

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
              <Sparkles className="h-4 w-4" />
              {pending ? "Rédaction…" : "Rédiger le message"}
            </ActionButton>
          </div>
        ) : (
          <>
            {task.channel === "email" && (
              <Input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Objet"
                className="font-medium"
              />
            )}

            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={task.channel === "linkedin" ? 6 : 14}
              className="resize-y font-[inherit]"
            />

            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                onClick={copy}
                variant="secondary"
                size="sm"
                tooltip="Copie le message dans le presse-papier. Rien n'est envoyé ni modifié."
              >
                <Copy className="h-4 w-4" />
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
                <Check className="h-4 w-4" />
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
                <Sparkles className="h-4 w-4" />
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
                  <Clock className="h-4 w-4" />
                  +3 j
                </ActionButton>
                <ActionButton
                  onClick={() => startTransition(() => skipTask(task.id).then(() => {}))}
                  disabled={pending}
                  variant="ghost"
                  size="sm"
                  tooltip="Passe cette étape sans l'envoyer et programme directement la suivante."
                  confirm={{
                    title: "Passer cette étape ?",
                    description:
                      "L'action est marquée ignorée et son brouillon est abandonné — tu ne pourras pas y revenir. La séquence continue quand même : l'étape suivante est programmée à sa date, comme si tu avais envoyé celle-ci. Pour arrêter les relances de ce prospect, utilise plutôt « Perdu » ou « Exclure » sur sa fiche.",
                    action: "Passer l'étape",
                    destructive: true,
                  }}
                >
                  <X className="h-4 w-4" />
                </ActionButton>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
