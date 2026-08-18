import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
});

const DATETIME_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return DATE_FMT.format(new Date(value));
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return DATETIME_FMT.format(new Date(value));
}

/** « il y a 3 jours », « dans 2 jours », « aujourd'hui ». */
export function relativeDay(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const target = new Date(value);
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(target) - start(new Date())) / 86_400_000);

  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  if (days === -1) return "hier";
  return days < 0 ? `il y a ${-days} jours` : `dans ${days} jours`;
}

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 3_600_000);
}

/** Complète une URL saisie sans protocole. Retourne null si vide. */
export function normalizeUrl(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * La couleur d'un score et d'un canal, décidées à un seul endroit.
 *
 * Un score n'est pas une note sur 100 qu'on lit : c'est un feu tricolore.
 * En dessous du seuil d'inscription il n'appelle aucune action, autour du
 * seuil il se discute, au-dessus il part en séquence. Trois teintes, pas
 * un dégradé — un dégradé ne se lit pas d'un coup d'œil.
 */
export function scoreTone(score: number | null): "success" | "warning" | "secondary" {
  if (score === null) return "secondary";
  if (score >= 60) return "success";
  if (score >= 25) return "warning";
  return "secondary";
}

export function channelTone(channel: string): "email" | "phone" | "linkedin" | "secondary" {
  if (channel === "email") return "email";
  if (channel === "phone") return "phone";
  if (channel === "linkedin") return "linkedin";
  return "secondary";
}
