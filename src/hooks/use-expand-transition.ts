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
 * Le geste tient en trois temps, et l'ordre compte plus que les durées :
 *
 *   1. le bandeau s'étire, blanc, tel qu'on le connaît — les pièces glissent
 *      vers leur nouvelle place ;
 *   2. passé la moitié, l'encre bascule d'un coup court : l'aplat et les
 *      textes qu'il porte changent **ensemble**, sinon il y a un moment où
 *      les deux se retrouvent au même gris ;
 *   3. ce qui n'existe qu'ouvert paraît par-dessus le fond désormais sombre.
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
/** Où il tombe dans le geste — après l'étirement, avant que tout soit posé. */
const MOMENT_ENCRE = 0.45;

export function useExpandTransition(expanded: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  /** La disposition d'avant la bascule, relevée au clic. */
  const avant = useRef<Flip.FlipState | null>(null);
  /** La hauteur du rendu précédent : le point de départ du mouvement. */
  const hauteurRendue = useRef(0);
  /** L'aplat du bandeau avant la bascule — encre ouvert, rien replié. */
  const fondAvant = useRef("");
  /** Les encres d'avant, pièce par pièce, pour les croiser à part. */
  const couleursAvant = useRef(new Map<string, gsap.TweenVars>());
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
      const id = piece.dataset.flipId ?? CHEVRON;
      const style = getComputedStyle(piece);
      couleursAvant.current.set(id, {
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

      /**
       * Les encres : tenues, puis lâchées. Pas interpolées.
       *
       * Tailwind 4 écrit les couleurs à opacité modifiée en `oklab()` —
       * `text-on-ink/70`, par exemple. GSAP ne sait pas lire cet espace : il
       * repliait la cible sur du noir, et le chevron virait au noir sur fond
       * noir une image avant d'atterrir. Un dégradé de couleur qui traverse
       * une valeur fausse est pire que pas de dégradé du tout.
       *
       * Chaque pièce garde donc son ancienne encre pendant que l'aplat
       * s'assombrit, et la lâche à mi-parcours du basculement : le fond est
       * alors à mi-chemin, où l'ancienne encre et la nouvelle tiennent toutes
       * les deux. Le changement passe en une image, sans jamais rien rendre
       * illisible — et sans dépendre de ce que GSAP sait analyser.
       */
      const bascule = duree * MOMENT_ENCRE + CROISEMENT / 2;
      el.querySelectorAll<HTMLElement>(ENCRES).forEach((piece) => {
        const encre = couleursAvant.current.get(piece.dataset.flipId ?? CHEVRON);
        if (!encre) return;
        /* Posé tout de suite, hors timeline, et pas en `set(…, 0)` : un `set`
           à zéro n'est rendu qu'au premier battement de GSAP, une image plus
           tard. Cette image-là passait à l'écran avec les encres claires du
           nouvel arbre sur le fond encore blanc — un clignotement, à
           l'endroit exact qu'on cherche à rendre continu. Ici on écrit avant
           la peinture, comme les `from()` qui l'entourent. */
        gsap.set(piece, encre);
        tl.set(piece, { clearProps: "color,backgroundColor" }, bascule);
      });
    }

    /**
     * L'aplat, enfin.
     *
     * Sans lui, tout le reste peut bien glisser : l'en-tête encre est peint
     * plein dès la première image, et cette image-là est un remplacement —
     * c'est elle qu'on lisait comme un à-coup. Le bandeau doit *devenir*
     * l'en-tête, donc l'encre doit sortir de la couleur de la carte, et y
     * retourner en se refermant.
     */
    const bandeau = el.firstElementChild as HTMLElement | null;
    if (bandeau) {
      const fond = expanded ? getComputedStyle(el).backgroundColor : fondAvant.current;
      /* À la fermeture on part de l'encre relevée au clic ; sans clic sur
         cette carte, il n'y a rien à faire remonter. */
      if (fond) {
        tl.from(
          bandeau,
          {
            backgroundColor: fond,
            /* Même fenêtre que les encres qu'il porte, au même instant :
               c'est la seule façon de garder le texte lisible d'un bout à
               l'autre. Étaler l'aplat sur tout le geste laissait le nom en
               encre sombre sur un fond déjà à moitié noir.

               Posé passé la moitié : le bandeau s'étire d'abord tel qu'on le
               connaît, blanc, puis passe à l'encre une fois la place prise.
               Basculer dès la première image, c'était le remplacement d'avant
               avec cent millisecondes de politesse. */
            duration: CROISEMENT,
            ease: "power1.inOut",
            clearProps: "backgroundColor",
          },
          duree * MOMENT_ENCRE,
        );
      }
    }

    /**
     * Le chevron, à part de tout le reste.
     *
     * Apparié par Flip comme les autres, il changeait de place *et* d'angle
     * en même temps : il passait par tous les degrés intermédiaires, et une
     * flèche à quarante-cinq degrés n'est plus une flèche — elle a l'air
     * cassée. Il reste donc où il est et ne fait qu'une chose : se retourner,
     * dans la même fenêtre que l'encre, en partant de l'orientation qu'avait
     * l'autre chevron. La rotation est portée par l'enveloppe, le demi-tour
     * au repos par le `<svg>` : ils ne se cumulent pas, et l'orientation
     * reste juste sans JavaScript.
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
        duree * MOMENT_ENCRE,
      );
    }

    /* Ce qui n'existe qu'ouvert n'a pas d'ancienne place : ça ne peut que
       paraître. Accroché au basculement de l'aplat, pas avant : ces lignes-là
       sont écrites en encre claire, pour le fond sombre. Les faire monter
       pendant que le bandeau est encore blanc, c'était les faire paraître en
       blanc sur blanc. */
    if (expanded) {
      const nouveaux = gsap.utils.toArray<HTMLElement>(el.querySelectorAll(NOUVEAU));
      if (nouveaux.length) {
        tl.from(
          nouveaux,
          {
            opacity: 0,
            duration: duree * 0.55,
            ease: "power1.out",
            stagger: 0.04,
            clearProps: "opacity",
          },
          duree * MOMENT_ENCRE,
        );
      }
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
