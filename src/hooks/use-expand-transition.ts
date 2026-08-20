import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(Flip);

/**
 * Le bandeau d'une action, et la carte qu'il devient.
 *
 * Replié, c'est une ligne ; déplié, un panneau à en-tête encre. Ce sont deux
 * arbres différents, et React remplace l'un par l'autre en une image : le
 * bandeau *disparaît* pendant que l'en-tête *apparaît*. Animer la seule
 * hauteur ne corrige rien — la boîte glisse, mais la substitution reste
 * visible en son milieu, et c'est elle qu'on lit comme un à-coup.
 *
 * Ce qui manquait n'est pas de la durée, c'est de la **continuité** : la
 * pastille du canal, le nom, le score, l'échéance et le chevron existent des
 * deux côtés, au même titre, à deux places différentes. Marqués d'un
 * `data-flip-id`, Flip les reconnaît d'un arbre à l'autre et les fait glisser
 * de l'ancienne position vers la nouvelle. Rien n'est remplacé à l'œil : le
 * bandeau se déplie.
 *
 * Le geste tient en deux temps, et un seul mouvement les cadence :
 *
 *   1. le bandeau s'étire, blanc, tel qu'on le connaît — les pièces glissent
 *      vers leur nouvelle place ;
 *   2. un voile de la couleur de la carte se retire vers le bas, découvrant
 *      l'encre. Et **tout le reste se déduit de ce bord** : chaque pièce
 *      change d'encre, chaque ligne nouvelle paraît, le chevron se retourne,
 *      au moment précis où le bord la dépasse.
 *
 * Ce voile n'est pas un effet, c'est ce qui rend le reste possible. Un fondu
 * du blanc vers l'encre passe par le gris — c'est de l'arithmétique, pas un
 * réglage : à mi-chemin le fond et le texte se retrouvent à la même valeur,
 * et le nom de l'entreprise disparaît. Un bord ne mélange rien : au-dessus
 * l'encre, au-dessous la carte, et le contraste est juste des deux côtés à
 * chaque image. C'est aussi ce qui donne au geste son calendrier — on ne
 * règle pas dix retards à la main, on les lit sur une règle.
 *
 * L'état de départ se relève **dans le gestionnaire de clic**, avant que
 * React ne touche au DOM : c'est la seule fenêtre où l'ancienne disposition
 * existe encore. D'où le `capture()` rendu ici, que la carte appelle avant
 * `onToggle()`.
 */

/**
 * `useLayoutEffect` n'a pas de sens au rendu serveur et React le signale.
 * On mesure et on anime avant peinture côté client, on ne fait rien côté
 * serveur — l'alias évite l'avertissement sans changer le comportement.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * GSAP anime en JavaScript : la règle `prefers-reduced-motion` de
 * `globals.css` ne peut rien pour lui, exactement comme pour les icônes
 * Animate UI (voir `animate-ui/icons/icon.tsx`). Le réglage se lit donc à la
 * main, à chaque bascule — il peut changer pendant la session.
 */
const sansMouvement = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Ce qui se retrouve d'un état à l'autre, et ce qui n'existe qu'ouvert. */
const PARTAGE = "[data-flip-id]";
const NOUVEAU = "[data-reveal]";
/** Le chevron, qui ne se déplace pas mais se retourne. */
const CHEVRON = "[data-chevron]";
/** L'aplat de la carte, posé par-dessus l'encre, qui se retire vers le bas. */
const VOILE = "[data-voile]";
/**
 * Tout ce qui change d'encre en changeant d'état — les pièces appariées, et
 * le chevron qui n'est pas apparié mais porte quand même l'encre claire dès
 * le premier rendu. Sans lui dans le lot, il disparaissait le temps que
 * l'aplat bascule : clair sur blanc, il n'y avait plus de flèche du tout.
 */
const ENCRES = `${PARTAGE}, ${CHEVRON}`;

/**
 * 180 ms est la durée d'une modale, qui ne parcourt que quelques pixels
 * d'échelle. Une carte qui passe de 60 px à huit cents sur la même durée file
 * trop vite pour qu'on suive le déplacement des éléments : la durée s'étire
 * donc avec la distance, jusqu'à 340 ms et pas au-delà — un accordéon qui
 * prend une demi-seconde fait attendre.
 *
 * La fermeture reste courte, dans l'esprit des 120 ms de la doctrine : ce qui
 * s'en va n'a pas à se faire attendre. Elle a juste de quoi laisser les
 * éléments revenir à leur place sur la ligne, sans quoi on retomberait sur le
 * saut qu'on vient de retirer.
 */
const dureeOuverture = gsap.utils.clamp(0.24, 0.34);
const FERMETURE = 0.16;
/** Le passage d'une encre à l'autre : assez court pour ne pas se regarder. */
const CROISEMENT = 0.1;
/** Où il tombe au repli, faute de voile pour le cadencer. */
const MOMENT_ENCRE = 0.45;
/** Le voile part une fois la place prise, et descend d'un trait. */
const VOILE_DEBUT = 0.3;
const VOILE_DUREE = 0.22;

/** Les deux seules propriétés qui changent d'un état à l'autre. */
const PROPRIETES = ["color", "backgroundColor"] as const;
type Encre = Record<(typeof PROPRIETES)[number], string>;

/**
 * GSAP sait lire `rgb()` et `rgba()`, pas `oklab()` ni `oklch()` — les
 * espaces dans lesquels Tailwind 4 rend les couleurs à opacité modifiée.
 * Sur une cible qu'il ne sait pas lire, il replie sur du noir.
 */
const interpolable = (couleur: string) => /^rgba?\(/.test(couleur);

/** Le chevron n'a pas de `data-flip-id` : il lui faut quand même une clé. */
const cle = (piece: HTMLElement) => piece.dataset.flipId ?? CHEVRON;

export function useExpandTransition(expanded: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  /** La disposition d'avant la bascule, relevée au clic. */
  const avant = useRef<Flip.FlipState | null>(null);
  /** La hauteur du rendu précédent : le point de départ du mouvement. */
  const hauteurRendue = useRef(0);
  /** L'aplat du bandeau avant la bascule — encre ouvert, rien replié. */
  const fondAvant = useRef("");
  /** Les encres d'avant, pièce par pièce, pour les croiser à part. */
  const couleursAvant = useRef(new Map<string, Encre>());
  const monte = useRef(false);

  const capture = useCallback(() => {
    const el = ref.current;
    if (!el || sansMouvement()) return;
    const bandeau = el.firstElementChild;
    fondAvant.current = bandeau ? getComputedStyle(bandeau).backgroundColor : "";

    /**
     * Les encres sont relevées à part de la position, et c'est délibéré.
     *
     * Confiées à Flip (`props: "color,backgroundColor"`), elles se croisaient
     * sur toute la durée du glissement : le fond descendait du blanc vers
     * l'encre pendant que le nom montait de l'encre vers le blanc, et au
     * milieu les deux se retrouvaient au même gris. Le nom de l'entreprise
     * disparaissait cinq images durant, en plein milieu du geste.
     *
     * Séparées, elles se croisent vite et tard : la position continue de
     * glisser tranquillement pendant que la couleur, elle, tranche.
     */
    couleursAvant.current = new Map();
    el.querySelectorAll<HTMLElement>(ENCRES).forEach((piece) => {
      const style = getComputedStyle(piece);
      couleursAvant.current.set(cle(piece), {
        color: style.color,
        backgroundColor: style.backgroundColor,
      });
    });

    avant.current = Flip.getState(el.querySelectorAll(PARTAGE));
  }, []);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    const etat = avant.current;
    avant.current = null;

    if (!el) return;
    /* Au montage il n'y a pas de bascule, seulement un état de départ. */
    if (!monte.current) {
      monte.current = true;
      return;
    }
    if (sansMouvement()) return;

    /**
     * Trois façons d'arriver ici, et seulement deux qui s'animent.
     *
     * Sans disposition relevée, la bascule ne vient pas d'un clic sur cette
     * carte. À l'ouverture, c'est le retour sur la page avec une action
     * restaurée : elle doit être là, pas se déplier toute seule sous les yeux
     * — DESIGN.md est explicite, rien ne s'anime sans qu'on l'ait demandé.
     * À la fermeture en revanche, c'est qu'on vient d'ouvrir une autre action :
     * la carte perd six cents pixels d'un coup et toute la file saute avec
     * elle. Pas de morphose à raccorder — l'ancien en-tête n'a pas été
     * mesuré — mais la hauteur, elle, se referme proprement.
     */
    if (expanded && !etat) return;

    gsap.killTweensOf(el);
    const depart = hauteurRendue.current;
    /* Mesurée maintenant, nouvel arbre en place et pas encore peint : c'est
       la seule fenêtre où la hauteur d'arrivée est connue sans être passée à
       l'écran. */
    const naturelle = el.offsetHeight;
    /* Relevée ici et pas seulement par l'effet de queue : celui-ci se tait
       tant que ça bouge, et le dernier rendu d'une bascule tombe justement
       pendant le mouvement qu'elle vient de lancer. Sans cette ligne, la
       hauteur d'une carte ouverte restait celle de son bandeau, et le repli
       n'avait plus rien à parcourir — il se faisait d'un coup. */
    hauteurRendue.current = naturelle;
    const duree = expanded
      ? dureeOuverture(Math.abs(naturelle - depart) / 1800)
      : FERMETURE;

    const tl = gsap.timeline();

    /* La boîte, d'abord : c'est elle qui fait la place. Sans elle le panneau
       paraîtrait à pleine hauteur et pousserait la file d'un seul coup. */
    tl.fromTo(
      el,
      { height: depart, overflow: "hidden" },
      {
        height: naturelle,
        duration: duree,
        ease: expanded ? "power2.out" : "power2.in",
        /* La hauteur repart en `auto` : un panneau figé en pixels ne suivrait
           plus son contenu — le champ de message se redimensionne à la
           poignée, et l'encadré d'erreur peut déplier son détail technique. */
        clearProps: "height,overflow",
      },
      0,
    );

    /* Puis ce qui se retrouve des deux côtés, replacé sans être remplacé. */
    if (etat) {
      tl.add(
        Flip.from(etat, {
          /* Indispensable, et silencieux si on l'oublie : sans `targets`,
             Flip reconstruit l'état d'arrivée à partir des nœuds qu'il avait
             relevés — or ceux-là viennent d'être détachés du DOM par React.
             Il compare alors du vide à du vide et n'anime rien, sans erreur
             ni avertissement. Ce sont les nœuds *actuels* qu'il faut lui
             désigner ; l'appariement se fait ensuite par `data-flip-id`. */
          targets: el.querySelectorAll(PARTAGE),
          duration: duree,
          ease: expanded ? "power2.out" : "power2.in",
          /* `absolute` sortirait les pièces du flux : l'en-tête se
             réorganiserait autour d'elles pendant qu'elles glissent. */
          absolute: false,
        }),
        0,
      );
    }

    const entete = el.firstElementChild as HTMLElement | null;
    const voile = expanded ? el.querySelector<HTMLElement>(VOILE) : null;
    const cadreEntete = entete?.getBoundingClientRect();
    const hautEntete = cadreEntete?.top ?? 0;
    const hauteurEntete = cadreEntete?.height || 1;

    /**
     * Le calendrier de tout ce qui se trouve dans l'en-tête.
     *
     * Une pièce ne change pas d'encre à une heure convenue : elle change
     * quand le bord du voile la dépasse. C'est ce qui fait tenir l'ensemble —
     * on ne règle pas dix retards à la main, on les déduit d'un seul
     * mouvement, et le contraste est juste par construction : au-dessus du
     * bord il y a l'encre, au-dessous la carte, jamais de gris entre les deux.
     *
     * Sans voile — c'est le repli — tout bascule au même instant.
     */
    const decouverte = (piece: Element) => {
      if (!voile) return duree * MOMENT_ENCRE;
      const cadre = piece.getBoundingClientRect();
      /* Le milieu de la pièce, pas son bas : le bord met une image et demie à
         la traverser, autant le prendre en son centre. */
      const milieu = cadre.top + cadre.height / 2 - hautEntete;
      return (
        duree * VOILE_DEBUT +
        VOILE_DUREE * gsap.utils.clamp(0, 1, milieu / hauteurEntete)
      );
    };

    if (voile) {
      tl.fromTo(
        voile,
        { scaleY: 1 },
        /* `none`, et c'est une contrainte, pas un goût : `decouverte` déduit
           l'heure de chaque pièce de sa position, en supposant un bord à
           vitesse constante. Sous une courbe, le bord passe ailleurs qu'au
           moment calculé — mesuré : une image d'avance, où le nom se
           retrouve en clair sur du blanc. Un rideau à vitesse constante, en
           deux cent vingt millisecondes, se lit d'ailleurs très bien. */
        { scaleY: 0, duration: VOILE_DUREE, ease: "none", clearProps: "transform" },
        duree * VOILE_DEBUT,
      );
    } else if (entete && fondAvant.current) {
      /* Au repli il n'y a pas de voile à retirer : le bandeau reprend son
         aplat depuis l'encre relevée au clic. Soixante-deux pixels de haut et
         cent millisecondes — le gris n'a pas le temps de se voir. */
      tl.from(
        entete,
        {
          backgroundColor: fondAvant.current,
          duration: CROISEMENT,
          ease: "power1.inOut",
          clearProps: "backgroundColor",
        },
        duree * MOMENT_ENCRE,
      );
    }

    /**
     * Les encres, pièce par pièce.
     *
     * Deux règles, et la première fait le plus gros du travail : **on ne
     * touche que ce qui change**. La pastille du canal et celle du score ont
     * exactement la même couleur des deux côtés — les animer, c'était écrire
     * une valeur en ligne pour rien, et réveiller au passage la transition
     * CSS que `badgeVariants` porte dans ses classes de base.
     *
     * La seconde : **à bord franc, bascule franche**. Sous le voile, le fond
     * d'une pièce ne se dégrade pas — il passe de la carte à l'encre en une
     * image, quand le bord la traverse. Une encre qui mettrait cent
     * millisecondes à suivre resterait grise sur un fond déjà noir : c'est
     * exactement ce qu'on voit sur la trace image par image, quatre images de
     * texte gris sur l'encre. Elle bascule donc avec le bord, au même
     * instant.
     *
     * Au repli, sans voile, il n'y a pas de bord : là un fondu court est le
     * seul moyen honnête, quand GSAP sait lire les deux bouts. Tailwind 4
     * écrit les couleurs à opacité modifiée en `oklab()`, qu'il ne sait pas
     * lire — il replie alors la cible sur du noir, et une couleur qui
     * traverse une valeur fausse est pire que pas de dégradé du tout.
     */
    if (etat) {
      const touchees: HTMLElement[] = [];

      el.querySelectorAll<HTMLElement>(ENCRES).forEach((piece) => {
        const avantEncre = couleursAvant.current.get(cle(piece));
        if (!avantEncre) return;
        const style = getComputedStyle(piece);
        const moment = decouverte(piece);

        PROPRIETES.forEach((prop) => {
          const ancienne = avantEncre[prop];
          const actuelle = style[prop];
          if (!ancienne || ancienne === actuelle) return;
          touchees.push(piece);

          if (!voile && interpolable(ancienne) && interpolable(actuelle)) {
            tl.from(
              piece,
              { [prop]: ancienne, duration: CROISEMENT, ease: "power1.inOut", clearProps: prop },
              moment,
            );
            return;
          }

          /* Tenue, puis lâchée d'un coup. Posée hors timeline : un `set` à
             zéro n'est rendu qu'au premier battement de GSAP, une image plus
             tard — et cette image-là passe à l'écran avec la nouvelle encre
             sur l'ancien fond. */
          gsap.set(piece, { [prop]: ancienne });
          tl.set(piece, { clearProps: prop }, moment);
        });
      });

      if (touchees.length) {
        /**
         * `transition-colors` est dans les classes de base de
         * `badgeVariants`. Dès que GSAP écrit une couleur en ligne, la
         * transition CSS s'en empare et la ramène vers la valeur de classe,
         * image après image : on voyait la pastille du retard s'effacer
         * complètement puis revenir. Deux moteurs sur la même propriété, il
         * faut en couper un.
         */
        gsap.set(touchees, { transitionProperty: "none" });
        tl.set(touchees, { clearProps: "transitionProperty" }, duree);
      }
    }

    /**
     * Le chevron, à part de tout le reste.
     *
     * Apparié par Flip comme les autres, il changeait de place *et* d'angle
     * en même temps : il passait par tous les degrés intermédiaires, et une
     * flèche à quarante-cinq degrés n'est plus une flèche — elle a l'air
     * cassée. Il reste donc où il est et ne fait qu'une chose : se retourner,
     * au moment où le voile le dépasse, en partant de l'orientation qu'avait
     * l'autre chevron. La rotation est portée par l'enveloppe, le demi-tour
     * au repos par le `<svg>` : sur le même nœud, ils se cumuleraient.
     */
    const chevron = el.querySelector<HTMLElement>(CHEVRON);
    if (chevron) {
      tl.from(
        chevron,
        {
          rotation: expanded ? -180 : 180,
          duration: CROISEMENT,
          ease: "power2.inOut",
          clearProps: "rotate,transform",
        },
        /* Centrée sur le passage du bord, et non calée dessus : une rotation
           est un mouvement, elle a besoin de part et d'autre. */
        Math.max(0, decouverte(chevron) - CROISEMENT / 2),
      );
    }

    /* Ce qui n'existe qu'ouvert n'a pas d'ancienne place : ça ne peut que
       paraître. Chacun à son tour, quand le bord du voile arrive sur lui —
       ces lignes-là sont écrites en encre claire, pour le fond sombre, et
       les faire monter sur du blanc, c'est les faire paraître en blanc sur
       blanc. Le panneau, lui, est sous l'en-tête : il vient en dernier. */
    if (expanded) {
      gsap.utils.toArray<HTMLElement>(el.querySelectorAll(NOUVEAU)).forEach((neuf) => {
        tl.from(
          neuf,
          {
            opacity: 0,
            duration: CROISEMENT * 1.4,
            ease: "power1.out",
            clearProps: "opacity",
          },
          decouverte(neuf),
        );
      });
    }

    return () => {
      tl.kill();
    };
  }, [expanded]);

  /**
   * Après l'effet d'animation, jamais avant : celui-ci lit la hauteur du
   * rendu précédent, celui-là l'écrase avec la nouvelle. L'ordre de
   * déclaration est l'ordre d'exécution, et c'est tout ce qui tient la
   * mécanique.
   *
   * Une carte ouverte se rend à chaque frappe dans le brouillon : si un de
   * ces rendus tombe pendant le mouvement, la hauteur relevée serait celle
   * d'une image intermédiaire. La hauteur en ligne est la marque du tween —
   * `fromTo` la pose dès sa création, et `clearProps` la retire à la fin.
   * Tant qu'elle est là, on ne relève rien.
   *
   * `gsap.isTweening` ne suffirait pas : au rendu qui lance le mouvement, le
   * tween existe déjà mais n'a pas encore été joué, et la mesure repartait
   * alors à la hauteur du bandeau. Le repli n'avait plus rien à parcourir.
   */
  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (el && !el.style.height) hauteurRendue.current = el.offsetHeight;
  });

  return { ref, capture };
}
