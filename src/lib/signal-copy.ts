/**
 * Ce qu'un signal doit dire — en trois parties, et pas une seule.
 *
 * La sonde produisait un constat et un poids : « site injoignable +35 ».
 * C'est un relevé, pas un argument. Il manquait la pièce du milieu, celle
 * qui fait la différence entre un audit poli et une proposition :
 *
 *   constat   ce qui a été observé          → `probe.ts`, le `label`
 *   enjeu     ce que ça leur coûte          → ici
 *   geste     ce que tu fais                → ici
 *
 * ## Sur les chiffres
 *
 * Ces phrases partent dans des emails à de vraies entreprises, qui peuvent
 * les vérifier. Un chiffre faux se retourne contre l'expéditeur, et il vaut
 * donc moins que pas de chiffre du tout.
 *
 * Deux règles, tenues sans exception :
 *
 * 1. **Aucune statistique sans `source` vérifiable.** Les entrées qui n'en
 *    portent pas décrivent un mécanisme, pas une mesure — c'est légitime et
 *    ça reste vrai. Ce qui ne l'est pas, c'est un pourcentage sorti de nulle
 *    part parce qu'il « sonne juste ».
 * 2. **L'enjeu explique, il ne promet pas.** L'étude Deloitte porte sur 37
 *    grandes marques et 30 millions de sessions : elle établit que la
 *    vitesse déplace le revenu, elle ne promet pas +8,4 % au salon de
 *    coiffure d'en face. Citer le mécanisme et sa preuve, jamais extrapoler
 *    le résultat à ce prospect-ci.
 */

export interface Source {
  label: string;
  url: string;
  /** Ce que l'étude a réellement mesuré. Empêche de la citer de travers. */
  portee: string;
}

export const SOURCES = {
  webaim: {
    label: "WebAIM Million, février 2026",
    url: "https://webaim.org/projects/million/",
    portee: "analyse automatisée des pages d'accueil du million de sites les plus visités",
  },
  deloitte: {
    label: "Deloitte & 55 pour Google, « Milliseconds Make Millions », 2020",
    url: "https://web.dev/case-studies/milliseconds-make-millions",
    portee: "37 grandes marques européennes et américaines, plus de 30 millions de sessions mobiles",
  },
  lcen: {
    label: "service-public.gouv.fr — obligations d'un site professionnel",
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F31228",
    portee: "droit français applicable à tout site édité depuis la France",
  },
  eaa: {
    label: "Directive (UE) 2019/882 « accessibilité », applicable depuis le 28 juin 2025",
    url: "https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/la-nouvelle-directive-europeenne-accessibilite-pour-des-produits-et-des-services-accessibles-aux-personnes-en-situation",
    portee: "entreprises de plus de 10 salariés et 2 M€ de chiffre d'affaires, services au consommateur",
  },
} as const satisfies Record<string, Source>;

export interface SignalCopy {
  /** Pourquoi c'est un problème pour eux. Mécanisme d'abord, chiffre ensuite. */
  enjeu: string;
  /** Ce que tu apportes. Un livrable, jamais une technologie. */
  geste: string;
  source?: Source;
  /**
   * Certains enjeux sont juridiques et **ne s'appliquent pas en dessous d'une
   * taille**. La directive accessibilité vise les entreprises de plus de 10
   * salariés : l'opposer à un salon de trois personnes serait faux, et se
   * retournerait contre l'expéditeur au premier prospect qui vérifie.
   *
   * `headcount` vient de Pappers et est souvent nul — dans le doute on
   * n'invoque pas le droit. L'enjeu de repli dit la même chose sans menacer.
   */
  seuilEffectif?: number;
  /** L'enjeu servi quand l'effectif est inconnu ou sous le seuil. */
  enjeuSousSeuil?: string;
}

export const SIGNAL_COPY: Record<string, SignalCopy> = {
  /* ---- Absence de présence ------------------------------------------ */
  no_website: {
    enjeu:
      "on ne le trouve pas quand on le cherche par son nom : la recherche renvoie des annuaires, des concurrents, ou rien. Chaque personne qui cherche à le joindre part chez quelqu'un d'autre.",
    geste: "un site à lui, pensé pour convertir et pas seulement pour exister",
  },
  social_only: {
    enjeu:
      "sa présence appartient à la plateforme : elle décide de qui la voit, peut la fermer, et ne laisse rien emporter. Ce qu'il construit là ne lui reste pas.",
    geste: "un site qu'il possède, au lieu d'une fiche louée à une plateforme",
  },
  unreachable: {
    enjeu:
      "un visiteur sur un site qui ne répond pas ne réessaie pas plus tard : il retourne aux résultats et clique sur le suivant. La demande n'est pas reportée, elle est perdue — et elle est allée chez un concurrent.",
    geste: "une remise en ligne et un hébergement sur lequel il peut compter",
  },

  /* ---- Fondations techniques ---------------------------------------- */
  http_only: {
    enjeu:
      "les navigateurs affichent « Non sécurisé » dans la barre d'adresse, à côté du nom de l'entreprise. C'est la première chose que voit un visiteur, avant même la page.",
    geste: "le passage en HTTPS, que les navigateurs réclament désormais",
  },
  not_responsive: {
    enjeu:
      "il faut pincer et faire glisser pour lire la moindre ligne. Sur un téléphone, c'est l'écran par lequel arrive l'essentiel des visites de proximité.",
    geste: "une refonte conçue d'abord pour le mobile",
  },
  slow: {
    enjeu:
      "l'attente se paie en visiteurs qui referment avant d'avoir vu la page. Sur 37 grandes marques et plus de 30 millions de sessions mobiles, un dixième de seconde gagné suffisait à déplacer les conversions de plusieurs points — c'est dire ce que coûtent plusieurs secondes.",
    geste: "un site qui s'affiche en moins d'une seconde",
    source: SOURCES.deloitte,
  },
  stale: {
    enjeu:
      "une date figée il y a des années dit au visiteur que personne ne s'occupe du site — et il en déduit, à tort ou à raison, que personne ne s'occupe du reste.",
    geste: "une reprise du site et de son contenu",
  },

  /* ---- Ce qui fait gagner du temps au quotidien ---------------------- */
  no_booking: {
    enjeu:
      "chaque rendez-vous se prend au téléphone, donc pendant les heures d'ouverture, donc en interrompant ce qu'il est en train de faire. Et tout ce qui se décide le soir ou le dimanche ne se décide pas.",
    geste: "la prise de rendez-vous en ligne, branchée sur son agenda",
  },
  no_contact_path: {
    enjeu:
      "il n'y a aucun moyen d'écrire. Qui ne veut pas téléphoner n'a pas de second choix : il ne laisse pas de message, il s'en va.",
    geste: "un formulaire de contact qui arrive vraiment dans sa boîte",
  },
  phone_not_clickable: {
    enjeu:
      "sur un téléphone, appeler demande de retenir le numéro puis de le retaper. Trois gestes au lieu d'un, pour l'action qu'on venait faire.",
    geste: "un numéro qu'on appelle d'un doigt depuis un mobile",
  },
  diy_builder: {
    enjeu:
      "l'abonnement court tant que le site existe, et le site s'arrête avec lui. Ce qu'il paie chaque mois ne lui appartient toujours pas.",
    geste: "la reprise du site sur une base à lui, sans abonnement à l'éditeur",
  },

  /* ---- Design et expérience ------------------------------------------ */
  table_layout: {
    enjeu:
      "la page est bâtie avec des méthodes abandonnées depuis vingt ans : elle ne peut pas s'adapter au mobile, et son âge se lit au premier coup d'œil.",
    geste: "une refonte complète, structure comprise",
  },
  thin_content: {
    enjeu:
      "il n'y a pas assez de texte pour qu'un moteur comprenne ce qu'il fait, ni pour qu'un visiteur se décide. La page existe sans rien dire.",
    geste: "l'écriture des pages, pas seulement leur mise en forme",
  },
  no_og: {
    enjeu:
      "quand quelqu'un partage le lien, il ne se passe rien : pas d'image, pas de titre. La recommandation, qui est ce qui marche le mieux pour lui, arrive sous la forme la moins engageante possible.",
    geste: "des aperçus soignés quand son lien est partagé",
  },
  no_webfont: {
    enjeu:
      "le site s'affiche dans la police par défaut du navigateur — celle de tous les sites qui n'ont pas choisi. Rien ne le distingue de ses concurrents.",
    geste: "une identité visuelle et typographique qui lui ressemble",
  },

  /* ---- Conformité ---------------------------------------------------- */
  no_legal: {
    enjeu:
      "les mentions légales sont obligatoires pour tout site édité depuis la France. Leur absence est un délit : jusqu'à un an d'emprisonnement et 75 000 € d'amende.",
    geste: "des mentions légales conformes",
    source: SOURCES.lcen,
  },
  tracking_no_consent: {
    enjeu:
      "des traceurs se chargent avant tout consentement. C'est le manquement que la CNIL contrôle le plus, et il se constate depuis l'extérieur — sans avoir besoin d'entrer nulle part.",
    geste: "la mise en conformité de ses traceurs et du bandeau de consentement",
  },

  /* ---- Accessibilité --------------------------------------------------
     Le seul enjeu de l'app qui dépend de la taille de l'entreprise.

     La directive (UE) 2019/882 ne vise que les entreprises de plus de 10
     salariés réalisant plus de 2 M€ de chiffre d'affaires. Or la plupart des
     prospects d'ici sont des salons, des vétérinaires, des auto-écoles —
     très en dessous. Leur opposer une amende de 50 000 € serait faux, et se
     retournerait au premier qui vérifie.

     D'où `seuilEffectif` et `enjeuSousSeuil` : au-dessus on peut parler
     droit, en dessous on parle de la moitié des visiteurs qui n'y arrivent
     pas. Le second argument est d'ailleurs le meilleur des deux — il
     s'adresse à quelqu'un qui veut vendre, pas à quelqu'un qui a peur.
     -------------------------------------------------------------------- */
  no_zoom: {
    enjeu:
      "le zoom est désactivé : quelqu'un qui voit mal ne peut pas agrandir le texte, il n'a aucun recours. C'est une ligne dans le code, et c'est le défaut le plus dur pour une clientèle qui vieillit.",
    geste: "un site qui se laisse agrandir, et qui reste lisible une fois agrandi",
  },
  no_lang: {
    enjeu:
      "la langue de la page n'est pas déclarée : un lecteur d'écran prononce le français avec les règles de sa langue par défaut, et devient inintelligible.",
    geste: "un site correctement balisé, lisible par les outils d'assistance",
  },
  images_no_alt: {
    enjeu:
      "ces images n'ont aucune description : elles n'existent pas pour un lecteur d'écran, ni pour un moteur de recherche. C'est le deuxième défaut le plus répandu du web — WebAIM le relève sur 53 % des pages d'accueil analysées.",
    geste: "des images décrites, pour les outils d'assistance comme pour le référencement",
    source: SOURCES.webaim,
  },
  inputs_no_label: {
    enjeu:
      "aucun champ du formulaire n'est étiqueté : à la voix ou au lecteur d'écran, on ne sait pas ce qu'on remplit. WebAIM relève ce défaut sur 51 % des pages d'accueil. C'est le formulaire par lequel arrivent ses demandes.",
    geste: "un formulaire utilisable par tout le monde, y compris sans voir l'écran",
    source: SOURCES.webaim,
    seuilEffectif: 10,
    enjeuSousSeuil:
      "aucun champ du formulaire n'est étiqueté : à la voix ou au lecteur d'écran, on ne sait pas ce qu'on remplit. C'est le formulaire par lequel arrivent ses demandes — celles qui n'aboutissent pas ne laissent aucune trace.",
  },
  no_h1: {
    enjeu:
      "la page n'annonce nulle part de quoi elle parle : ni pour un moteur de recherche, ni pour quelqu'un qui la parcourt au lecteur d'écran.",
    geste: "une structure de page claire, qui dit ce qu'elle contient",
  },

  /* ---- Vétusté de fabrication ------------------------------------------
     Ce sont des indices, jamais un jugement esthétique : on établit que le
     site repose sur des techniques abandonnées, on ne conclut pas qu'il est
     laid. Le jugement visuel demande de voir la page.
     -------------------------------------------------------------------- */
  legacy_tags: {
    enjeu:
      "la page emploie des balises retirées du standard depuis HTML5 : le site a été fabriqué avec des méthodes que plus personne n'enseigne, et son âge se voit.",
    geste: "une refonte sur des bases actuelles, structure comprise",
  },
  fixed_width: {
    enjeu:
      "la mise en page est figée à une largeur d'écran : sur tout autre format, le visiteur fait glisser la page pour lire. C'est encore le cas sur la plupart des téléphones.",
    geste: "une mise en page qui s'adapte à l'écran qu'on lui présente",
  },
  old_jquery: {
    enjeu:
      "le site s'appuie sur une bibliothèque qui n'est plus maintenue : les correctifs de sécurité ne lui parviennent plus, et ce qu'on ajoute dessus hérite du problème.",
    geste: "une base à jour, sur laquelle on peut continuer à construire",
  },

  /* ---- Ce que révèle le poids du prospect ---------------------------- */
  reviews_many: {
    enjeu:
      "ce volume d'avis dit un flux de demandes que personne ne peut traiter à la main sans y laisser ses journées.",
    geste:
      "de quoi absorber ce volume sans y passer ses journées : relances et réponses courantes automatisées",
  },
  reviews_some: {
    enjeu: "les mêmes questions reviennent, et chacune est retapée à la main.",
    geste: "des demandes qui se traitent toutes seules quand elles se ressemblent",
  },
  headcount: {
    enjeu:
      "à cette taille, ce qui se fait à la main se fait autant de fois qu'il y a de personnes.",
    geste:
      "des outils internes qui font gagner du temps à toute l'équipe, et la formation pour qu'elle s'en serve vraiment",
  },
  recent_company: {
    enjeu:
      "tout est encore à installer : c'est le moment où le faire coûte le moins cher, parce qu'il n'y a rien à reprendre.",
    geste: "un site à la hauteur de l'activité dès le départ, sans reprise à faire dans deux ans",
  },
};

/** Ce que la sonde a observé se lit dans `probe.ts` ; ici, ce qu'on en dit. */
export function copyFor(kind: string): SignalCopy | null {
  return SIGNAL_COPY[kind] ?? null;
}

/**
 * L'enjeu, ajusté à ce qu'on sait de la taille de l'entreprise.
 *
 * Un enjeu juridique conditionné à un seuil ne se sert qu'au-dessus de ce
 * seuil. En dessous — ou quand `headcount` est inconnu, ce qui est le cas le
 * plus fréquent — on sert le repli, qui dit la même chose sans invoquer un
 * droit qui ne s'applique pas.
 */
export function enjeuFor(kind: string, headcount: number | null): string | null {
  const copy = SIGNAL_COPY[kind];
  if (!copy) return null;
  if (copy.seuilEffectif === undefined) return copy.enjeu;
  const eligible = headcount !== null && headcount >= copy.seuilEffectif;
  return eligible ? copy.enjeu : (copy.enjeuSousSeuil ?? null);
}

/** Compatibilité : `remedies.ts` exposait cette fonction. */
export function remedyFor(kind: string): string | null {
  return SIGNAL_COPY[kind]?.geste ?? null;
}
