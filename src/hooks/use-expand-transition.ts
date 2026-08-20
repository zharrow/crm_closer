import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
 * **Un seul geste est décrit ici, et le repli le rejoue à l'envers.** C'est
 * la pièce maîtresse. Tant que le repli avait sa propre mécanique, il
 * ramenait un à un les défauts qu'on venait de retirer de l'ouverture : la
 * substitution brutale, et la pastille du retard qui réapparaissait le temps
 * du retour. Une seule construction, jouée dans les deux sens, ne peut pas
 * diverger.
 *
 * Le geste tient en deux temps, et un seul mouvement les cadence :
 *
 *   1. le bandeau s'étire, blanc, tel qu'on le connaît ;
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
 * Deux conséquences sur la façon dont ce fichier est écrit :
 *
 * — `shown` n'est pas `expanded`. Au repli, le panneau reste rendu le temps
 *   de se refermer ; sans ce sursis il n'y aurait rien à animer, et son
 *   contenu disparaîtrait d'un coup pendant que la boîte, elle, glisse. Le
 *   geste s'achève quand l'arbre déplié est arrivé exactement à l'aspect de
 *   la ligne repliée : la substitution ne se voit plus, elle n'a plus rien à
 *   changer.
 *
 * — l'aspect de la ligne repliée — ses encres, sa hauteur — est relevé **tant
 *   qu'elle est à l'écran**, et gardé. C'est le départ de l'ouverture, et la
 *   cible du repli.
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
const ENCRES = PARTAGE + ", " + CHEVRON;

/** Les deux seules propriétés qui changent d'un état à l'autre. */
const PROPRIETES = ["color", "backgroundColor"] as const;
type Encre = Record<(typeof PROPRIETES)[number], string>;

/**
 * 180 ms est la durée d'une modale, qui ne parcourt que quelques pixels
 * d'échelle. Une carte qui passe de 60 px à huit cents sur la même durée file
 * trop vite pour qu'on suive : la durée s'étire donc avec la distance, jusqu'à
 * 340 ms et pas au-delà — un accordéon qui prend une demi-seconde fait
 * attendre.
 */
const dureeOuverture = gsap.utils.clamp(0.24, 0.34);
/** Le voile part une fois la place prise, et descend d'un trait. */
const VOILE_DEBUT = 0.3;
const VOILE_DUREE = 0.22;
/** Ce qui ne peut pas basculer net : la rotation du chevron. */
const CROISEMENT = 0.1;
/**
 * Le repli rejoue le geste à l'envers, mais pas à la même allure : ce qui
 * s'en va n'a pas à se faire attendre. C'est le seul réglage propre au
 * retour ; tout le reste est la même construction.
 */
const RETOUR = 1.7;

/** Le chevron n'a pas de `data-flip-id` : il lui faut quand même une clé. */
const cle = (piece: HTMLElement) => piece.dataset.flipId ?? CHEVRON;

/** L'arbre déplié est le seul à porter un voile : ça suffit à le reconnaître. */
const estDeplie = (el: HTMLElement) => Boolean(el.querySelector(VOILE));

const releverEncres = (el: HTMLElement) => {
  const encres = new Map<string, Encre>();
  el.querySelectorAll<HTMLElement>(ENCRES).forEach((piece) => {
    const style = getComputedStyle(piece);
    encres.set(cle(piece), {
      color: style.color,
      backgroundColor: style.backgroundColor,
    });
  });
  return encres;
};

export function useExpandTransition(expanded: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  /** Ce qui est rendu. Diffère de `expanded` le temps d'un repli. */
  const [shown, setShown] = useState(expanded);
  /** La disposition d'avant l'ouverture, relevée au clic. */
  const flip = useRef<Flip.FlipState | null>(null);
  /** L'aspect de la ligne repliée : départ de l'ouverture, cible du repli. */
  const encresRepliees = useRef<Map<string, Encre> | null>(null);
  const hauteurRepliee = useRef(0);
  const monte = useRef(false);
  const aOuvrir = useRef(false);

  const capture = useCallback(() => {
    const el = ref.current;
    if (!el || sansMouvement() || estDeplie(el)) return;
    /* On part de la ligne : c'est le moment de relever ce qu'elle est, avant
       que React ne la remplace. Au repli il n'y a rien à prendre — ce qu'il
       faut viser a été relevé quand elle était là, et gardé depuis. */
    encresRepliees.current = releverEncres(el);
    flip.current = Flip.getState(el.querySelectorAll(PARTAGE));
  }, []);

  /**
   * Le geste, construit une fois pour les deux sens.
   *
   * Il décrit toujours l'**ouverture** : de la ligne repliée vers le panneau.
   * L'ouverture le joue en avant, le repli le pose à sa fin et le remonte.
   * D'où l'absence de `clearProps` au repli — les nœuds qu'il touche sont
   * démontés juste après, et un nettoyage en fin de course viendrait
   * contrarier la marche arrière.
   */
  const construire = (el: HTMLElement, sens: "ouverture" | "repli") => {
    const ouvre = sens === "ouverture";
    /* Rendu à étaler, jamais posé tel quel : `clearProps: undefined` fait
       planter GSAP, qui appelle `.split` dessus sans vérifier. La clé doit
       être absente, pas vide. */
    const nettoie = (props: string) => (ouvre ? { clearProps: props } : null);
    const depart = hauteurRepliee.current;
    /* On mesure une carte au repos, jamais une carte en train de bouger : si
       on rebascule au milieu d'un geste, la hauteur en ligne posée par le
       précédent serait prise pour la hauteur naturelle, et le nouveau geste
       partirait d'une image intermédiaire. */
    gsap.killTweensOf(el);
    gsap.set(el, { clearProps: "height,overflow" });
    const naturelle = el.offsetHeight;
    const duree = dureeOuverture(Math.abs(naturelle - depart) / 1800);
    const tl = gsap.timeline({ paused: !ouvre });

    /* La boîte, d'abord : c'est elle qui fait la place. Sans elle le panneau
       paraîtrait à pleine hauteur et pousserait la file d'un seul coup. */
    tl.fromTo(
      el,
      { height: depart, overflow: "hidden" },
      {
        height: naturelle,
        duration: duree,
        ease: "power2.out",
        /* La hauteur repart en `auto` : un panneau figé en pixels ne suivrait
           plus son contenu — le champ de message se redimensionne à la
           poignée, et l'encadré d'erreur peut déplier son détail technique.
           Au repli, c'est l'effet de mesure qui nettoie, une fois la ligne
           rendue. */
        ...nettoie("height,overflow"),
      },
      0,
    );

    /* Ce qui se retrouve des deux côtés, replacé sans être remplacé. Au repli
       il n'y a rien à raccorder : on anime l'arbre déplié sur lui-même, et
       les deux états sont alignés au pixel. */
    if (ouvre && flip.current) {
      tl.add(
        Flip.from(flip.current, {
          /* Indispensable, et silencieux si on l'oublie : sans `targets`,
             Flip reconstruit l'état d'arrivée à partir des nœuds qu'il avait
             relevés — or ceux-là viennent d'être détachés du DOM par React.
             Il compare alors du vide à du vide et n'anime rien, sans erreur
             ni avertissement. */
          targets: el.querySelectorAll(PARTAGE),
          duration: duree,
          ease: "power2.out",
          /* `absolute` sortirait les pièces du flux : l'en-tête se
             réorganiserait autour d'elles pendant qu'elles glissent. */
          absolute: false,
        }),
        0,
      );
    }

    const entete = el.firstElementChild as HTMLElement | null;
    const voile = el.querySelector<HTMLElement>(VOILE);
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
     */
    const decouverte = (piece: Element) => {
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
        {
          scaleY: 0,
          duration: VOILE_DUREE,
          /* `none`, et c'est une contrainte, pas un goût : `decouverte` déduit
             l'heure de chaque pièce de sa position, en supposant un bord à
             vitesse constante. Sous une courbe, le bord passe ailleurs qu'au
             moment calculé — mesuré : une image d'avance, où le nom se
             retrouve en clair sur du blanc. Un rideau à vitesse constante, en
             deux cent vingt millisecondes, se lit d'ailleurs très bien. */
          ease: "none",
          ...nettoie("transform"),
        },
        duree * VOILE_DEBUT,
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
     * d'une pièce ne se dégrade pas : il passe de la carte à l'encre en une
     * image, quand le bord la traverse. Une encre qui mettrait cent
     * millisecondes à suivre resterait grise sur un fond déjà noir. C'est
     * aussi ce qui évacue un piège : Tailwind 4 écrit les couleurs à opacité
     * modifiée en `oklab()`, que GSAP ne sait pas interpoler — une bascule
     * n'a pas ce problème, elle n'a rien à traverser.
     */
    const encres = encresRepliees.current;
    if (encres) {
      const touchees: HTMLElement[] = [];

      el.querySelectorAll<HTMLElement>(ENCRES).forEach((piece) => {
        const repliee = encres.get(cle(piece));
        if (!repliee) return;
        const style = getComputedStyle(piece);
        const moment = decouverte(piece);

        PROPRIETES.forEach((prop) => {
          const ancienne = repliee[prop];
          const actuelle = style[prop];
          if (!ancienne || ancienne === actuelle) return;
          touchees.push(piece);
          tl.set(piece, { [prop]: ancienne }, 0);
          tl.set(piece, { [prop]: actuelle }, moment);
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
        tl.set(touchees, { transitionProperty: "none" }, 0);
        if (ouvre) {
          tl.set(
            touchees,
            { clearProps: "transitionProperty,color,backgroundColor" },
            duree,
          );
        }
      }
    }

    /**
     * Le chevron, à part de tout le reste.
     *
     * Apparié par Flip comme les autres, il changeait de place *et* d'angle
     * en même temps : il passait par tous les degrés intermédiaires, et une
     * flèche à quarante-cinq degrés n'est plus une flèche — elle a l'air
     * cassée. Il reste donc où il est et ne fait qu'une chose : se retourner,
     * au passage du bord. La rotation est portée par l'enveloppe, le demi-tour
     * au repos par le `<svg>` : sur le même nœud, ils se cumuleraient.
     */
    const chevron = el.querySelector<HTMLElement>(CHEVRON);
    if (chevron) {
      tl.from(
        chevron,
        {
          rotation: -180,
          duration: CROISEMENT,
          ease: "power2.inOut",
          ...nettoie("rotate,transform"),
        },
        /* Centrée sur le passage du bord, et non calée dessus : une rotation
           est un mouvement, elle a besoin de part et d'autre. */
        Math.max(0, decouverte(chevron) - CROISEMENT / 2),
      );
    }

    /* Ce qui n'existe qu'ouvert n'a pas d'ancienne place : ça ne peut que
       paraître. Chacun à son tour, quand le bord du voile arrive sur lui —
       ces lignes-là sont écrites en encre claire, pour le fond sombre, et les
       faire monter sur du blanc, c'est les faire paraître en blanc sur blanc.
       Le panneau, lui, est sous l'en-tête : il vient en dernier à l'ouverture,
       et s'en va en premier au repli. */
    gsap.utils.toArray<HTMLElement>(el.querySelectorAll(NOUVEAU)).forEach((neuf) => {
      tl.from(
        neuf,
        {
          opacity: 0,
          duration: CROISEMENT * 1.4,
          ease: "power1.out",
          ...nettoie("opacity"),
        },
        decouverte(neuf),
      );
    });

    return tl;
  };

  /**
   * Tant que la ligne est là, on relève ce qu'elle est.
   *
   * Une fois le panneau rendu, ni sa hauteur ni ses encres ne sont mesurables
   * — et ce sont elles que l'ouverture prend pour départ et que le repli
   * prend pour cible. C'est aussi ici qu'on retire la hauteur laissée en ligne
   * par un repli : après la mutation du DOM et avant la peinture, donc sans
   * que la carte reprenne sa taille naturelle le temps d'une image.
   */
  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    gsap.set(el, { clearProps: "height,overflow,pointerEvents" });
    hauteurRepliee.current = el.offsetHeight;
    if (!encresRepliees.current) encresRepliees.current = releverEncres(el);
  });

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* Au montage il n'y a pas de bascule, seulement un état de départ. */
    if (!monte.current) {
      monte.current = true;
      return;
    }
    if (expanded === shown) return;

    if (sansMouvement()) {
      setShown(expanded);
      return;
    }

    if (expanded) {
      /* Rien à animer encore : le panneau n'est pas rendu. On le demande, et
         l'effet suivant l'ouvre une fois qu'il est là. */
      aOuvrir.current = true;
      setShown(true);
      return;
    }

    /**
     * Le repli : le geste d'ouverture posé à sa fin, puis remonté.
     *
     * Faute d'avoir jamais vu cette carte repliée — une action restaurée au
     * retour sur la page, refermée sans avoir été rouverte entre-temps — il
     * n'y a ni hauteur ni encres à viser. On rend alors la ligne tout de
     * suite ; c'est le seul cas où le retour ne se joue pas.
     */
    if (!encresRepliees.current || !hauteurRepliee.current) {
      setShown(false);
      return;
    }

    gsap.killTweensOf(el);
    /* Le panneau s'en va : ses boutons ne doivent plus rien recevoir. */
    gsap.set(el, { pointerEvents: "none" });
    const tl = construire(el, "repli");
    tl.eventCallback("onReverseComplete", () => setShown(false));
    tl.progress(1).timeScale(RETOUR).reverse();

    return () => {
      tl.kill();
    };
  }, [expanded, shown]);

  /** L'ouverture, une fois le panneau rendu. */
  useIsomorphicLayoutEffect(() => {
    if (!shown || !aOuvrir.current) return;
    aOuvrir.current = false;

    const el = ref.current;
    if (!el || sansMouvement()) return;

    gsap.killTweensOf(el);
    const tl = construire(el, "ouverture");

    return () => {
      tl.kill();
    };
  }, [shown]);

  return { ref, capture, shown };
}
