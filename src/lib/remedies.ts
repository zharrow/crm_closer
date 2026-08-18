/**
 * À chaque constat, ce que tu apportes pour y répondre.
 *
 * Sans cette table, la rédaction ne reçoit que des observations et une
 * phrase d'offre générique : elle produit alors un audit poli, pas une
 * proposition. Le constat dit ce qui ne va pas ; le remède dit ce que tu
 * fais — c'est la différence entre « votre site n'a pas de prise de
 * rendez-vous » et « je peux brancher la prise de rendez-vous sur votre
 * agenda ».
 *
 * Elle vit dans le code et non en base : c'est de l'éditorial, ça se
 * retouche souvent, et ça ne doit pas exiger de re-sonder les leads.
 * Formule chaque entrée comme un livrable, jamais comme une technologie.
 */
export const REMEDIES: Record<string, string> = {
  // Absence de présence
  no_website: "un site à lui, pensé pour convertir et pas seulement pour exister",
  social_only: "un site qu'il possède, au lieu d'une fiche louée à une plateforme",
  unreachable: "une remise en ligne et un hébergement sur lequel il peut compter",

  // Fondations techniques
  http_only: "le passage en HTTPS, que les navigateurs réclament désormais",
  not_responsive: "une refonte conçue d'abord pour le mobile",
  slow: "un site qui s'affiche en moins d'une seconde",
  stale: "une reprise du site et de son contenu",

  // Ce qui fait gagner du temps au quotidien
  no_booking: "la prise de rendez-vous en ligne, branchée sur son agenda",
  no_contact_path: "un formulaire de contact qui arrive vraiment dans sa boîte",
  phone_not_clickable: "un numéro qu'on appelle d'un doigt depuis un mobile",
  diy_builder: "la reprise du site sur une base à lui, sans abonnement à l'éditeur",

  // Design et expérience
  table_layout: "une refonte complète, structure comprise",
  thin_content: "l'écriture des pages, pas seulement leur mise en forme",
  no_og: "des aperçus soignés quand son lien est partagé",
  no_webfont: "une identité visuelle et typographique qui lui ressemble",

  // Ce que révèle le poids du prospect. L'IA et l'automatisation n'ont
  // aucun rapport avec un défaut de site : elles répondent au volume et à
  // la taille de l'équipe, pas à une balise manquante. Les rattacher aux
  // bons signaux évite de les caser de force dans chaque message.
  reviews_many:
    "de quoi absorber ce volume sans y passer ses journées : relances et réponses courantes automatisées",
  reviews_some: "des demandes qui se traitent toutes seules quand elles se ressemblent",
  headcount:
    "des outils internes qui font gagner du temps à toute l'équipe, et la formation pour qu'elle s'en serve vraiment",
  recent_company: "un site à la hauteur de l'activité dès le départ, sans reprise à faire dans deux ans",

  // Conformité
  no_legal: "des mentions légales conformes",
  tracking_no_consent: "la mise en conformité de ses traceurs et du bandeau de consentement",
};

export function remedyFor(kind: string): string | null {
  return REMEDIES[kind] ?? null;
}
