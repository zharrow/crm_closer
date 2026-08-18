/**
 * Les deux séquences par défaut, créées d'elles-mêmes au premier accès.
 *
 * Le canal n'est pas un détail de rédaction, c'est ce qui décide si un
 * lead est exploitable. Un établissement sans site n'a pas d'adresse à
 * scraper — c'est justement le signal le plus fort de ton scoring, et
 * jusqu'ici il condamnait le lead à rester en réserve. Il a par contre
 * presque toujours un numéro, remonté par Google Places. D'où deux
 * séquences, choisies lead par lead au moment de l'inscription.
 *
 * Les délais de la séquence email sont volontairement longs : une relance
 * à 48 h est perçue comme du harcèlement en B2B français et fait chuter le
 * taux de réponse. Ceux de la séquence téléphone sont plus courts — un
 * appel manqué n'est pas un message ignoré, c'est quelqu'un qui n'était
 * pas là.
 */

export type SequenceKey = "email" | "phone";

interface Blueprint {
  sequence: { key: SequenceKey; name: string; description: string };
  steps: {
    position: number;
    channel: "email" | "linkedin" | "phone" | "contact_form";
    delayHours: number;
    templateKey: string;
    brief: string;
  }[];
}

export const SEQUENCE_BLUEPRINTS: Record<SequenceKey, Blueprint> = {
  email: {
    sequence: {
      key: "email",
      name: "Séquence par défaut",
      description: "Quatre points de contact sur trois semaines, email et LinkedIn.",
    },
    steps: [
      {
        position: 1,
        channel: "email",
        delayHours: 0,
        templateKey: "first_touch",
        brief: "Premier contact. Partir du constat le plus fort, ne rien proposer.",
      },
      {
        position: 2,
        channel: "linkedin",
        delayHours: 96,
        templateKey: "follow_up",
        brief: "Demande de connexion LinkedIn, deux phrases, sans rappeler l'email.",
      },
      {
        position: 3,
        channel: "email",
        delayHours: 168,
        templateKey: "follow_up",
        brief: "Relance sous un angle neuf. Proposer un échange de vingt minutes.",
      },
      {
        position: 4,
        channel: "email",
        delayHours: 240,
        templateKey: "break_up",
        brief: "Dernier message. Clore proprement, laisser la porte ouverte.",
      },
    ],
  },

  phone: {
    sequence: {
      key: "phone",
      name: "Séquence téléphone",
      description: "Trois appels sur dix jours, pour les leads sans adresse email.",
    },
    steps: [
      {
        position: 1,
        channel: "phone",
        delayHours: 0,
        templateKey: "first_touch",
        brief:
          "Premier appel. Partir du constat le plus fort, en une phrase, et demander à qui en parler. Ne rien vendre au standard.",
      },
      {
        position: 2,
        channel: "phone",
        delayHours: 72,
        templateKey: "follow_up",
        brief:
          "Deuxième tentative, à un autre moment de la journée. Rappeler le motif en une phrase, sans reprocher l'absence de retour.",
      },
      {
        position: 3,
        channel: "phone",
        delayHours: 168,
        templateKey: "break_up",
        brief:
          "Dernier appel. Laisser un message clair et une porte ouverte, puis passer à autre chose.",
      },
    ],
  },
};

/** Le canal utilisable pour ce lead, ou `null` s'il est injoignable. */
export function sequenceKeyForLead(lead: {
  email: string | null;
  phone: string | null;
}): SequenceKey | null {
  if (lead.email) return "email";
  if (lead.phone) return "phone";
  return null;
}
