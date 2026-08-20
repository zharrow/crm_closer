"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Ban, CalendarCheck, Trophy } from "lucide-react";
import { Play } from "@/components/animate-ui/icons/play";
import { RefreshCw } from "@/components/animate-ui/icons/refresh-cw";
import { ThumbsDown } from "@/components/animate-ui/icons/thumbs-down";
import { ActionButton } from "@/components/action-button";
import { Input } from "@/components/ui/input";
import {
  enrichLeadNow,
  enrollLeadNow,
  excludeLead,
  markBooked,
  markLost,
  markWon,
} from "../../actions";

export function LeadActions({ leadId, status }: { leadId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState("");

  const run = (fn: () => Promise<unknown>, success: string) =>
    startTransition(async () => {
      const result = (await fn()) as { error?: string } | undefined;
      if (result?.error) toast.error(result.error);
      else toast.success(success);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionButton
        size="sm"
        variant="outline"
        disabled={pending}
        tooltip="Relance la collecte de données sur ce prospect et recalcule son score."
        confirm={{
          title: "Enrichir ce prospect ?",
          description:
            "Le site est sondé, les données légales récupérées chez Pappers si le SIREN manque, et une adresse de contact cherchée si l'email est vide. Le score est recalculé à la fin. Les champs déjà remplis ne sont pas écrasés. Compte quelques secondes et un appel facturé chez Pappers.",
          action: "Enrichir",
        }}
        onClick={() => run(() => enrichLeadNow(leadId), "Enrichissement terminé")}
      >
        <RefreshCw size={16} animate={pending || undefined} loop={pending || undefined} />
        Enrichir
      </ActionButton>

      {status !== "suppressed" && status !== "enrolled" && (
        <ActionButton
          size="sm"
          disabled={pending}
          tooltip="Démarre la séquence de relance : la première action arrive dans ta file, à rédiger quand tu veux."
          confirm={{
            title: "Inscrire en séquence ?",
            description:
              "Le prospect passe au statut « inscrit » et sa première action apparaît immédiatement dans « À faire aujourd'hui ». Aucun message n'est rédigé à cet instant : tu déclencheras la rédaction depuis la carte, quand tu voudras t'en occuper. Les relances suivantes ne sont créées qu'au fur et à mesure que tu marques la précédente comme envoyée. Rien ne part tout seul.",
            action: "Inscrire",
          }}
          onClick={() => run(() => enrollLeadNow(leadId), "Inscrit — première action dans ta file")}
        >
          <Play size={16} />
          Inscrire en séquence
        </ActionButton>
      )}

      {bookingOpen ? (
        <div className="flex items-center gap-2">
          <Input
            type="datetime-local"
            aria-label="Date et heure du rendez-vous"
            value={bookingDate}
            onChange={(event) => setBookingDate(event.target.value)}
            className="h-9 w-52"
          />
          <ActionButton
            size="sm"
            disabled={pending || !bookingDate}
            tooltip="Enregistre le rendez-vous à la date saisie et arrête les relances."
            confirm={{
              title: "Enregistrer ce rendez-vous ?",
              description:
                "Le rendez-vous est enregistré à la date saisie et le prospect passe au statut « RDV pris ». Ses relances programmées sont annulées — il ne recevra plus de messages de séquence — et sa conversation est close comme gagnée.",
              action: "Enregistrer le RDV",
            }}
            onClick={() =>
              run(async () => {
                await markBooked(leadId, bookingDate);
                setBookingOpen(false);
              }, "Rendez-vous enregistré")
            }
          >
            Valider
          </ActionButton>
          <ActionButton
            size="sm"
            variant="ghost"
            tooltip="Referme le champ de date sans rien enregistrer."
            onClick={() => setBookingOpen(false)}
          >
            Annuler
          </ActionButton>
        </div>
      ) : (
        <ActionButton
          size="sm"
          variant="outline"
          tooltip="Ouvre le champ de date pour enregistrer un rendez-vous obtenu."
          onClick={() => setBookingOpen(true)}
        >
          <CalendarCheck className="h-4 w-4" />
          RDV obtenu
        </ActionButton>
      )}

      {status === "booked" && (
        <ActionButton
          size="sm"
          variant="outline"
          disabled={pending}
          tooltip="Marque l'affaire comme signée."
          confirm={{
            title: "Marquer comme signé ?",
            description:
              "Le prospect passe au statut « signé ». C'est une écriture de suivi : rien n'est envoyé, aucune relance n'est touchée — elles sont déjà arrêtées depuis la prise de rendez-vous.",
            action: "Marquer signé",
          }}
          onClick={() => run(() => markWon(leadId), "Marqué signé")}
        >
          <Trophy className="h-4 w-4" />
          Signé
        </ActionButton>
      )}

      <div className="ml-auto flex items-center gap-2">
        <ActionButton
          size="sm"
          variant="ghost"
          disabled={pending}
          tooltip="Abandonne ce prospect et annule ses relances en attente."
          confirm={{
            title: "Marquer ce prospect comme perdu ?",
            description:
              "Ses relances programmées sont annulées et sa conversation est close comme perdue. Le prospect reste dans ta base et son email n'est pas exclu : tu pourras le réinscrire en séquence plus tard si la situation change.",
            action: "Marquer perdu",
          }}
          onClick={() => run(() => markLost(leadId), "Marqué perdu")}
        >
          <ThumbsDown size={16} />
          Perdu
        </ActionButton>
        <ActionButton
          size="sm"
          variant="ghost"
          disabled={pending}
          tooltip="Ajoute son email à la liste d'exclusion. Il ne sera plus jamais contacté."
          confirm={{
            title: "Exclure définitivement ce prospect ?",
            description:
              "Son adresse email part dans la liste d'exclusion, ses relances en cours sont arrêtées et son statut devient « exclu ». Le blocage porte sur l'email : même réimporté plus tard, ce contact ne repassera pas en séquence. Ça ne se défait pas depuis l'interface.",
            action: "Exclure définitivement",
            destructive: true,
          }}
          onClick={() => run(() => excludeLead(leadId, "exclusion manuelle"), "Prospect exclu")}
        >
          <Ban className="h-4 w-4" />
          Exclure
        </ActionButton>
      </div>
    </div>
  );
}
