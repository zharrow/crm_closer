# Design

Ce fichier existe parce que le système tenait dans les commentaires de
`src/app/globals.css`, c'est-à-dire à l'endroit où personne ne regarde avant
d'ajouter un composant. Les raisons comptent autant que les valeurs : une
valeur seule se change par erreur, une valeur avec son motif se discute.

---

## Ce que l'app est

Un outil de travail à un seul utilisateur, ouvert tous les jours, dense en
texte français et en nombres. Ce n'est pas un site vitrine : aucune section
n'a pour rôle de convaincre. Les règles qui suivent sont donc celles d'une
**interface applicative** — surface calme, typographie qui porte la
hiérarchie, peu de couleurs, chrome minimal.

Le produit repose sur une promesse unique : **rien ne part tout seul**.
Chaque écran doit la confirmer plutôt que la trahir. C'est ce qui justifie
le poids inhabituel donné aux textes de confirmation.

---

## Couleur

Forêt + terracotta. Les neutres portent un voile vert très léger : c'est ce
qui donne le caractère sans entrer en concurrence avec le sens.

| Registre | Rôle | Jamais utilisé pour |
|---|---|---|
| terracotta (`--primary`) | l'action | un état, une catégorie |
| vert (`--success`) | acquis, obtenu | une action |
| ocre (`--warning`) | à surveiller | une erreur |
| brique (`--destructive`) | problème, irréversible | un simple avertissement |

Trois registres qui ne se marchent pas dessus. Ajouter une quatrième couleur
sémantique demande de retirer une des trois, pas de s'y ajouter.

### La règle des deux jetons

Une teinte qui porte bien en pastille d'icône ne tient pas en texte de 12-13 px
sur son propre aplat : elle tombe vers 3,2:1, sous le seuil AA. D'où la paire
`--x` / `--x-on-tint` : l'un pour la teinte, l'autre pour ce qui doit rester
lisible. Vérifié sur les deux fonds que porte un badge, la carte et la page :
**4,68:1 au pire**.

Tout nouveau badge teinté doit venir avec son jeton `-on-tint`, mesuré.

### Les planchers, non négociables

| Élément | Seuil | Règle |
|---|---|---|
| Texte courant | 4,5:1 | WCAG 1.4.3 |
| Bordure d'un champ (`--input`) | **3:1** | WCAG 1.4.11 — c'est le seul indice qu'on peut écrire là |
| Icône porteuse de sens | 3:1 | WCAG 1.4.11 |
| Bordure décorative (`--border`) | libre | elle sépare, elle ne désigne pas |

`--input` et `--border` ont volontairement des valeurs différentes. Le trait
d'une carte sépare ; celui d'un champ désigne un composant. Les confondre est
ce qui avait mis les champs à 1,28:1.

---

## Typographie

**Inter Tight** pour l'interface, **JetBrains Mono** pour le technique, posées
par `next/font` dans `src/app/layout.tsx` — donc servies depuis le même
domaine, rien ne part chez Google au chargement.

Inter Tight est choisie pour deux raisons : elle tient le texte dense en
13-15 px, et elle porte de vrais chiffres tabulaires. Un score qui passe de 9
à 10 ne doit pas décaler sa colonne.

### La racine : 112,5 %

L'outil est destiné à être utilisé par une personne d'un certain âge. Toute
l'app étant en `rem`, `html { font-size: 112.5% }` agrandit **tout** de
12,5 % — le texte, mais aussi la hauteur des boutons, celle des champs, les
marges et les cibles à viser. Un texte grossi dans une interface restée
petite ne sert qu'à moitié.

En pourcentage et jamais en pixels : une valeur en dur annulerait le réglage
de police du navigateur, c'est-à-dire exactement ce dont a besoin la personne
pour qui on fait ça. Les points de rupture ne bougent pas — dans une media
query, `rem` se mesure sur la taille initiale du navigateur, pas sur celle
posée ici.

### L'échelle

Tailles nominales, et rendu réel à 112,5 % :

| Jeton | Nominal | Rendu | Pour |
|---|---|---|---|
| `text-xs` | 13 px | **14,6 px** | plancher — rien ne descend en dessous |
| `text-meta` | 13 px | **14,6 px** | méta, badges, en-têtes de colonne, infobulles |
| `text-sm` | 14 px | **15,8 px** | hérité ; préférer `text-dense` |
| `text-dense` | 15 px | **16,9 px** | tableaux, contenus de carte, champs |
| `text-body` | 16 px | **18 px** | prose : aides, descriptions de confirmation |
| `text-title` | 17 px | **19,1 px** | titres de carte |
| `text-2xl` | 24 px | **27 px** | titre de page |

**Le plancher est à 14,6 px et il n'y a rien en dessous.** `--text-xs` a été
remonté au niveau de `--text-meta` plutôt que de réécrire les 41 endroits qui
l'utilisent encore : le nom ment un peu, mais un nom trompeur pèse moins
qu'une ligne de 12 px devant quelqu'un qui voit mal.

Rien de ce qui se lit en continu ne descend sous `text-dense`. Préférer les
jetons nommés dans tout nouveau code.

**Aucune taille ne s'écrit en pixels.** Une valeur en `px` ne suit pas la
racine et se retrouve seule, minuscule, au milieu d'une interface agrandie.
C'était le cas de deux d'entre elles — la pastille de la barre de navigation
et la hauteur minimale des zones de texte.

---

## Composants

### Le bouton d'action est un contrat

`ActionButton` **exige** une `tooltip` : un bouton dont personne ne sait ce
qu'il fait ne vaut rien. C'est imposé par le type, pas par la discipline.

`confirm` est réservé aux actions qui **dépensent de l'argent**, **changent
l'état d'un lead**, ou **ne se rattrapent pas**. En mettre partout
entraînerait à valider sans lire, et le garde-fou ne protégerait plus rien là
où il compte.

La description d'une confirmation dit ce qui se passe *réellement* : effets en
base, argent dépensé, ce qui devient irréversible. C'est le seul endroit où
l'on peut encore changer d'avis. C'est aussi le meilleur travail de design de
l'app — ne pas le diluer.

### La carte doit gagner sa place

Une carte quand **la carte est l'interaction** — une tâche, un échange. Pas
comme boîte à ranger des titres : un intertitre et un filet font le même
travail avec moins de meuble.

> Dette connue : `reglages` empile six cartes, la fiche prospect cinq. Ce sont
> des groupements, pas des interactions. À reprendre en mise en page.

### La file du jour : une action ouverte à la fois

Les actions dépliées les unes sous les autres, la journée ne se voyait pas —
sept actions faisaient plusieurs écrans, et il fallait défiler pour savoir
combien il en restait. La file est donc un accordéon : une carte ouverte, les
autres en lignes.

Trois règles en découlent :

- **le repli ne perd rien.** Les cartes restent montées ; un brouillon
  retouché puis replié conserve ses corrections, et la ligne repliée porte
  une pastille « Modifié, non enregistré » — sinon la correction serait
  invisible et on la referait ;
- **le retard est une section, pas une couleur.** « En retard » et
  « Aujourd'hui » sont deux groupes titrés. Une nuance de rouge sur une date,
  au milieu de cartes identiques, ne se voyait pas ;
- **la frontière du retard se décide côté serveur**, une seule fois, et sert
  à la fois au groupe et à la couleur de la date. La calculer aussi côté
  client exposerait à un écart de fuseau à l'hydratation, et à deux
  définitions du mot « en retard ».

### Les états

Toute vue qui interroge la base doit répondre aux cinq :

| État | Attendu |
|---|---|
| Chargement | un `loading.tsx` aux dimensions du vrai contenu, jamais un écran figé |
| Vide | distinguer *jamais rien eu*, *filtre sans résultat*, et *travail terminé* — trois écrans, trois gestes |
| Erreur | nommer la cause probable et le geste, pas la trace technique (`(app)/error.tsx`) |
| Succès | un toast, et l'écran qui reflète déjà le changement |
| Partiel | dire ce qui a été retenu *et* ce qui a été écarté |

Une file vide parce qu'on a fini sa journée ne s'affiche pas comme une
installation neuve. C'est le seul moment de la journée qui mérite d'être
marqué.

---

## Retour et repères

Un lien de retour dit d'où l'on vient, jamais où l'on suppose que l'on est.
Écrit en dur, il se trompe dès qu'il existe deux chemins vers le même écran —
et un fil d'Ariane qui se trompe de parent est pire que pas de fil du tout,
parce qu'on lui fait confiance.

La fiche prospect s'atteint depuis la file du jour et depuis la liste. La
provenance voyage donc dans l'URL (`?depuis=file`), et non dans l'historique
du navigateur : le retour reste juste après un rechargement, ou si le lien est
rouvert depuis un onglet resté ouvert. Valeur inconnue ou absente : la liste,
qui est le parent naturel.

**Revenir, c'est retrouver sa place**, pas seulement la page. Deux mémoires
s'en chargent, toutes deux en `sessionStorage` et restaurées après le premier
rendu — jamais dans l'état initial, qui doit rester identique côté serveur et
côté client :

- `ScrollMemory` rend la position de défilement, par chemin et par filtre ;
- la file rend l'action qui était ouverte — et ne la rouvre que si elle est
  encore là, une action envoyée entre-temps n'ayant plus à l'être.

---

## Accessibilité

Acquis, à ne pas défaire :

- lien d'évitement en tête de `(app)/layout.tsx` ;
- un seul `:focus-visible` pour toute l'app — ne jamais remettre `outline-none`
  dans un composant sans le remplacer par autre chose ;
- `aria-pressed` sur les filtres : l'état actif ne peut pas tenir à la seule
  couleur de fond ;
- un `sr-only` en toutes lettres à côté de chaque état rendu par une icône ;
- `prefers-reduced-motion` neutralise animations et transitions ;
- **un libellé visible par champ**. Le `placeholder` n'est pas un libellé : il
  disparaît dès que le champ contient quelque chose, c'est-à-dire toujours.

Cible tactile : 44 px sur mobile. À 112,5 % les boutons montent à 40,5 px et
les liens de navigation à ~31 px : mieux qu'avant, toujours sous le seuil.
Dette connue — le palier supérieur (+25 %) les ferait passer à 45 px.

---

## Mouvement

Sobre et fonctionnel. Les modales entrent en 180 ms, sortent en 120 ms : ce
qui s'en va n'a pas à se faire attendre. L'icône de navigation devient une
roue pendant le chargement, à dimensions égales — rien ne bouge autour.

Pas d'animation décorative. Une animation qui n'aide pas à comprendre où l'on
est n'a rien à faire ici.

---

## Une contrainte qui n'est pas du design mais qui le borne

Le pooler transactionnel de Supabase tient mal les requêtes empilées :
`src/db/client.ts` fixe le pool à 5 et documente la mesure — 3 requêtes
concurrentes passent, 4 bloquent sans pool. **Toute page qui ajoute une
requête à un `Promise.all` doit compter le total concurrent de la page**, pas
seulement celui de sa fonction. Un compteur ajouté sans ce calcul a suffi à
faire échouer la file du jour.

Conséquence de conception : un compteur supplémentaire se fabrique avec
`count(*) filter (where …)` dans une requête existante, pas avec une
nouvelle requête.

---

## Dettes ouvertes

| Sujet | État |
|---|---|
| Cartes de groupement (`reglages`, fiche prospect) | à reprendre en mise en page |
| ~~Hiérarchie de « À faire »~~ | réglé : compteurs en ligne, file repliée, retard en section |
| Cibles tactiles de la barre de navigation | ~31 px à 112,5 %, cible 44 px |
| Bascule de thème manuelle | le CSS gère `.light` / `.dark`, aucune commande ne les pose |
| Compte rendu d'import ligne à ligne | on annonce un nombre, pas un résultat |
| Deux points de rupture seulement (`sm`, un peu `lg`) | rien n'adapte entre 640 et 1024 px |
