"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Copy } from "@/components/animate-ui/icons/copy";
import { Send } from "@/components/animate-ui/icons/send";
import { Sparkles } from "@/components/animate-ui/icons/sparkles";
import { ActionButton } from "@/components/action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { Message } from "@/db/schema";
import { logOutbound, logReply, requestReplySuggestion } from "../../actions";

const ROLE_LABEL: Record<string, string> = {
  us: "Nous",
  prospect: "Prospect",
  draft: "Brouillon",
};

export function Conversation({
  leadId,
  messages,
}: {
  leadId: string;
  messages: Message[];
}) {
  const [incoming, setIncoming] = useState("");
  const [draft, setDraft] = useState("");
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [escalate, setEscalate] = useState(false);
  const [pending, startTransition] = useTransition();

  const saveIncoming = () =>
    startTransition(async () => {
      await logReply(leadId, incoming);
      setIncoming("");
      toast.success("Réponse enregistrée — les relances sont arrêtées");
    });

  const suggest = () =>
    startTransition(async () => {
      const result = await requestReplySuggestion(leadId);
      if (result.error || !result.suggestion) {
        toast.error(result.error ?? "Suggestion impossible");
        return;
      }
      setDraft(result.suggestion.reply);
      setReasoning(result.suggestion.reasoning);
      setWarnings(result.suggestion.warnings);
      setEscalate(result.suggestion.escalate);
    });

  const copyDraft = async () => {
    await navigator.clipboard.writeText(draft);
    toast.success("Copié");
  };

  const sent = () =>
    startTransition(async () => {
      await logOutbound(leadId, draft);
      setDraft("");
      setReasoning(null);
      setWarnings([]);
      setEscalate(false);
      toast.success("Message enregistré dans le fil");
    });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Échange</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun message. Colle ici la réponse du prospect quand elle arrive.
          </p>
        ) : (
          <div className="flex flex-col gap-4 rounded-lg bg-muted/40 p-4">
            {messages.map((message) => (
              <div key={message.id} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {ROLE_LABEL[message.role] ?? message.role}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(message.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">{message.body}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="reponse-prospect" className="text-sm font-medium">
            Le prospect a répondu
          </label>
          <Textarea
            id="reponse-prospect"
            value={incoming}
            onChange={(event) => setIncoming(event.target.value)}
            rows={4}
            placeholder="Colle sa réponse ici…"
          />
          <div className="flex items-center gap-2">
            <ActionButton
              size="sm"
              onClick={saveIncoming}
              disabled={pending || incoming.trim().length === 0}
              tooltip="Archive la réponse du prospect et arrête définitivement ses relances programmées."
              confirm={{
                title: "Enregistrer la réponse du prospect ?",
                description:
                  "Le texte est archivé dans le fil et le prospect passe au statut « a répondu ». Surtout : toutes ses relances programmées sont annulées — une personne qui a répondu ne doit plus recevoir de séquence automatique. C'est l'effet principal de ce bouton, et il ne se défait pas : il faudra réinscrire le prospect à la main pour relancer une séquence.",
                action: "Enregistrer la réponse",
              }}
            >
              Enregistrer la réponse
            </ActionButton>
            <ActionButton
              size="sm"
              variant="outline"
              onClick={suggest}
              disabled={pending}
              tooltip="Fait rédiger une proposition de réponse par Claude à partir du fil de conversation."
              confirm={{
                title: "Demander une proposition de réponse ?",
                description:
                  "Claude lit le fil de conversation et propose une réponse, en signalant les cas où il vaut mieux que tu reprennes la main toi-même. C'est un appel facturé. Rien n'est enregistré ni envoyé : le brouillon s'affiche en dessous, modifiable.",
                action: "Proposer une réponse",
              }}
            >
              <Sparkles size={16} animate={pending} loop={pending} animateOnHover={!pending} />
              {pending ? "Réflexion…" : "Proposer une réponse"}
            </ActionButton>
          </div>
        </div>

        {draft && (
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={escalate ? "warning" : "secondary"}>
                {escalate ? "À reprendre toi-même" : "Réponse proposée"}
              </Badge>
              {reasoning && (
                <span className="text-xs text-muted-foreground">{reasoning}</span>
              )}
            </div>

            {warnings.length > 0 && (
              <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs leading-relaxed">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                Le brouillon contient : {warnings.join(", ")}. Relis-le avant d&apos;envoyer.
              </p>
            )}

            <Textarea
              aria-label="Réponse proposée, modifiable"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={8}
            />

            <div className="flex items-center gap-2">
              <ActionButton
                size="sm"
                variant="secondary"
                onClick={copyDraft}
                tooltip="Copie le brouillon dans le presse-papier. Rien n'est envoyé ni enregistré."
              >
                <Copy size={16} animateOnHover />
                Copier
              </ActionButton>
              <ActionButton
                size="sm"
                onClick={sent}
                disabled={pending}
                tooltip="À cliquer une fois la réponse réellement envoyée. L'archive dans le fil."
                confirm={{
                  title: "Enregistrer ce message comme envoyé ?",
                  description:
                    "À ne faire qu'après l'avoir réellement envoyé depuis ton client mail — l'app n'envoie rien. Le texte affiché est archivé dans le fil de conversation, côté « nous ». Aucune séquence n'est relancée : la conversation est passée en manuel depuis que le prospect a répondu.",
                  action: "J'ai envoyé, archiver",
                }}
              >
                <Send size={16} animateOnHover />
                Je l&apos;ai envoyé
              </ActionButton>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
