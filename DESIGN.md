# Design — Verrière

Ce fichier existe parce que le système tenait dans les commentaires de
`src/app/globals.css`, c'est-à-dire à l'endroit où personne ne regarde avant
d'ajouter un composant. Les raisons comptent autant que les valeurs : une
valeur seule se change par erreur, une valeur avec son motif se discute.

---

## Ce que l'app est

Un outil de travail à un seul utilisateur, ouvert tous les jours, dense en
texte français et en nombres. Ce n'est pas un site vitrine : aucune section
n'a pour rôle de convaincre.

Le produit repose sur une promesse unique : **rien ne part tout seul**.
Chaque écran doit la confirmer plutôt que la trahir. C'est ce qui justifie
le poids inhabituel donné aux textes de confirmation.

Et il se destine à une vue qui baisse. Ce n'est pas une note de bas de page :
c'est la contrainte qui décide de la racine typographique, du plancher de
taille, de la cible tactile et du seuil de contraste. Partout où un choix
esthétique et ce besoin s'opposent, c'est le besoin qui gagne — mais l'un
n'exclut pas l'autre, et le reste de ce fichier essaie de le montrer.

---

## Le diagnostic

L'app a longtemps été *correcte et invisible*. Un sol à 2 % du blanc, des
cartes blanches détourées d'un filet, un titre de page à 24 px au-dessus d'un
corps à 15. Chaque décision était défendable prise seule ; ensemble elles
donnaient un écran sans premier regard. Rien n'y était plus fort que le
reste, donc rien n'y était regardé en premier.

Le défaut n'était pas un manque de goût, c'était un **manque d'échelle**.
Toute la hiérarchie reposait sur deux leviers minuscules : le gras et une
différence de taille de 1,6. Une page de sept cartes blanches se lit alors
comme une liste sans début.

Trois leviers ont été ouverts en grand, et ils sont l'essentiel de ce
document :

1. **la lumière** — le sol n'est plus un aplat mais une nappe ;
2. **les tons** — cinq aplats pleins font désormais la hiérarchie ;
3. **l'affichage** — le titre de page passe de 24 à 45 px, avec sa propre
   fonte.

---

## 1. La lumière

Le fond est une **nappe ambiante** : un sol, plus trois halos posés en
`position: fixed`. Ils ne défilent pas. Un dégradé qui suit le contenu se
transforme en bandes dès qu'on descend et l'illusion tombe — on veut une
pièce éclairée, pas un papier peint.

| Halo | Clair | Sombre | Où |
|---|---|---|---|
| froid | `#DFEAFC` | `#16232E` | en haut à gauche |
| chaud | `#FEEFCF` | `#241A14` | en haut à droite |
| zeste | `#E4F4BC` | `#1A2612` | en bas |
| sol (`--canvas`) | `#EDEDE6` | `#0A0F0E` | partout |

### Comment un fond continu reste mesurable

Un dégradé rend les contrastes incalculables *si on le laisse faire* :
chaque pixel devient un fond différent, et un plancher qu'on ne peut pas
mesurer n'est plus un plancher. La règle qui rend l'exercice tenable tient
en une phrase :

> **La nappe n'a que quatre valeurs, et le pire des quatre est mesuré.**

Les halos se composent en s'éclaircissant, jamais en s'assombrissant : aucun
recouvrement ne peut donc sortir de l'intervalle borné par ces quatre
valeurs. En clair, le point bas est le halo froid (`#DFEAFC`) et non le sol ;
en sombre, le point haut est ce même halo froid. **Toutes les mesures de la
colonne correspondante sont prises là.**

Ajouter un cinquième halo veut dire refaire la mesure. C'est le prix, et il
est modeste.

### Le piège du `transparent`

Chaque halo s'éteint vers *sa propre couleur en alpha 0*, jamais vers
`transparent`. En CSS, `transparent` vaut `rgba(0, 0, 0, 0)` : l'interpolation
passe donc par du noir, et le halo se borde d'un liseré sale. C'est le piège
classique des dégradés, et il ne se voit qu'une fois en production.

---

## 2. Les tons et les encres

**Deux systèmes de couleur, et ils ne font pas le même travail.**

- les **tons** sont des *surfaces*. Ils disent « regarde ici ».
- les **encres** sémantiques sont des *couleurs de texte*. Elles disent
  « voici de quelle nature c'est ».

Un ton ne porte jamais de texte fin ; une encre ne remplit jamais un bloc.
Confondre les deux, c'est ce qui donne les tableaux de bord où tout crie et
où plus rien ne se lit.

### Les cinq tons

| Ton | Clair | Sert à | Ne sert jamais à |
|---|---|---|---|
| `ink` | `#101A17` | l'ossature : le rail, l'en-tête de l'action ouverte, un filtre actif | signaler quoi que ce soit |
| `cobalt` | `#2534C4` | l'action — ce qu'on vient déclencher | un état, une catégorie |
| `zest` | `#CFF255` | le présent — où l'on est, ce qui est ouvert, la journée finie | une action |
| `amber` | `#F9CE4C` | l'attente — un brouillon, quelque chose à relire | une erreur |
| `clay` | `#F08A63` | le retard — ce qui a déjà attendu | un simple avertissement |

Chaque ton vient avec son encre, `--on-<ton>`, et **aucun nouveau ton n'entre
sans la sienne, mesurée**. Ce n'est pas une commodité : une teinte qui porte
bien en aplat ne tient pas en texte de 14 px dessus, et c'est exactement là
qu'on s'en aperçoit trop tard.

### Pourquoi le zeste dit « présent » et pas « acquis »

C'est la seule subtilité du système, et elle mérite d'être écrite.

Le zeste est la couleur la plus voyante de la palette. Il porte la pilule
active du rail, l'étape en cours de la piste d'un prospect, et l'écran de fin
de journée. Ces trois choses ont en commun de répondre à « où en suis-je »,
pas à « qu'est-ce qui est gagné ».

L'acquis, lui, garde son encre à part (`--success`, un olive sombre). C'est
ce qui permet au zeste de porter la position **sans voler sa couleur au
bouton principal**, qui reste cobalt d'un bout à l'autre de l'app.

### Les quatre encres

| Encre | Rôle | Jamais utilisée pour |
|---|---|---|
| `--primary` (cobalt) | l'action, un lien | un état |
| `--success` (olive) | acquis, obtenu | une action |
| `--warning` (ocre) | à surveiller | une erreur |
| `--destructive` (brique) | problème, irréversible | un simple avertissement |

Quatre registres qui ne se marchent pas dessus. Ajouter une cinquième couleur
de sens demande d'en retirer une, pas de s'y ajouter.

### Les teintes, et pourquoi `bg-amber/30` est un piège

Un bloc d'avertissement à l'intérieur d'un panneau ne peut pas porter le ton
plein : il ferait concurrence au panneau qui le contient. Il lui faut une
version diluée — mais diluée **par un jeton** (`--tint-amber`,
`--tint-clay`), pas par une opacité.

`bg-amber/30` compose l'ambre sur ce qu'il y a derrière. En clair cela donne
le pastel attendu ; en sombre cela donne un kaki boueux, parce que le fond
composé est presque noir. Deux valeurs écrites à la main donnent le pastel
dans un thème et la teinte profonde dans l'autre, chacune choisie plutôt que
subie.

### Les pastilles de canal

Le canal se reconnaît sans lire le mot. Elles restent en **aplat pâle** et
non en ton plein : un canal est une étiquette, pas une hiérarchie, et cinq
tons pleins plus trois canaux pleins feraient huit blocs qui se disputent la
même page.

---

## 3. Les mesures

L'outil est destiné à une vue qui baisse : la cible est **AAA (7:1)**, pas AA.

Les valeurs ci-dessous sont **mesurées, pas estimées**, et elles se rejouent :

```
node scripts/contraste.mjs
```

Le script vivait dans un scratchpad de session, ce qui revenait à ne pas
l'avoir : un tableau de chiffres qu'on ne peut pas rejouer se périme au
premier ajustement, et il se périme *en silence* — la valeur reste écrite,
elle cesse simplement d'être vraie. Il tient maintenant les quarante
vérifications des deux thèmes et sort en code 1 si l'une tombe.

**Ses valeurs sont le miroir de `globals.css`.** Toucher à l'un sans l'autre
dans le même commit, c'est reconstruire le problème qu'il résout.

| Élément | Seuil visé | Clair | Sombre |
|---|---|---|---|
| Texte principal | 7:1 | 14,56 | 13,09 |
| Texte de second plan | 7:1 | **7,11** | **7,33** |
| `--primary` en texte | 6:1 | 7,31 | 7,39 |
| `--success` | 7:1 | 7,47 | 9,69 |
| `--warning` | 7:1 | **7,04** | 8,62 |
| `--destructive` | 7:1 | **7,02** | 7,35 |
| Encre sur ton `ink` | 7:1 | 15,80 | 13,03 |
| Encre sur ton `cobalt` | 7:1 | 8,87 | 7,61 |
| Encre sur ton `zest` | 7:1 | 13,94 | 13,56 |
| Encre sur ton `amber` | 7:1 | 11,81 | 10,94 |
| Encre sur ton `clay` | 7:1 | **7,21** | **7,04** |
| Libellé effacé du rail (`on-ink/70`) | 7:1 | 8,21 | 7,16 |
| Texte sur teinte `amber` / `clay` | 7:1 | 15,31 · 13,65 | 11,19 · 12,85 |
| Pastille de canal (pire des quatre) | 7:1 | **7,02** | 8,82 |
| Bordure d'un champ (`--input`) | 4,5:1 | 4,63 | 4,57 |
| Bordure de carte (`--border`) | ~2:1 | 2,01 | 2,16 |

`--input` et `--border` gardent délibérément un écart : le trait d'une carte
sépare, celui d'un champ désigne un composant. Les aligner ferait tout se
valoir, et plus rien ne hiérarchiserait.

**La teinte est conservée exactement.** Chaque canal est multiplié par un même
facteur, ce qui déplace la clarté sans toucher au ton. Toute nouvelle couleur
se résout de la même façon — on vise le ratio, on ne choisit pas un hex à
l'œil. Une valeur de contraste écrite dans un commentaire sans avoir été
mesurée est pire que pas de valeur du tout.

### Les deux règles qui évitent 90 % des fautes

1. **Une couleur posée sur un aplat de ton doit être mesurée contre cet
   aplat, pas contre le fond de la page.** Le marqueur de retard était du
   texte argile sur l'en-tête encre : 7,2:1 en clair, 6,3:1 en sombre — sous
   le plancher, dans le thème qu'on regarde le soir. Il est devenu une
   **pastille**, qui porte son propre fond et se trouve donc juste par
   construction, sur n'importe quelle surface. Quand un doute apparaît, la
   pastille est presque toujours la bonne réponse.
2. **Un repère de focus doit changer de couleur sur un ton.** Le cobalt de
   `--ring` disparaît sur un aplat cobalt. La classe `on-tone`, posée sur
   toute surface de ton, fait emprunter à l'anneau l'encre du ton — laquelle
   est à 7:1 dessus par construction.

---

## 4. Typographie

Trois familles, trois métiers, et la frontière est nette.

| Famille | Métier | Où |
|---|---|---|
| **Bricolage Grotesque** | afficher | titres de page, titres de panneau, grands nombres |
| **Inter Tight** | lire | tout le texte courant |
| **JetBrains Mono** | compter | nombres, dates, codes, étiquettes |

Posées par `next/font` dans `src/app/layout.tsx` — donc servies depuis le même
domaine, rien ne part chez Google au chargement.

### Pourquoi une deuxième grotesque

Inter Tight lit très bien à 15 px et très mal à 45. Une grotesque dessinée
pour le texte, agrandie, donne un titre mou : les contreformes restent
ouvertes, l'approche reste celle du petit corps, et le titre a l'air d'un
paragraphe qu'on aurait zoomé. Bricolage Grotesque est dessinée dans l'autre
sens — elle a du caractère en grand et n'en a aucun en petit.

D'où la règle, tenue par l'utilitaire `display` : **elle ne descend jamais
sous 20 px.** En dessous, c'est Inter Tight.

### La racine : 112,5 %

L'app étant entièrement en `rem`, `html { font-size: 112.5% }` agrandit
**tout** de 12,5 % — le texte, mais aussi la hauteur des boutons, celle des
champs, les marges et les cibles à viser. Un texte grossi dans une interface
restée petite ne sert qu'à moitié.

En pourcentage et jamais en pixels : une valeur en dur annulerait le réglage
de police du navigateur, c'est-à-dire exactement ce dont a besoin la personne
pour qui on fait ça. Les points de rupture ne bougent pas — dans une media
query, `rem` se mesure sur la taille initiale du navigateur.

### L'échelle

| Jeton | Nominal | Rendu à 112,5 % | Pour |
|---|---|---|---|
| `text-meta` / `text-xs` | 13 px | **14,6 px** | plancher — rien ne descend en dessous |
| `text-dense` | 15 px | **16,9 px** | tableaux, contenus de panneau, champs |
| `text-body` | 16 px | **18 px** | prose : aides, descriptions de confirmation |
| `text-title` | 18 px | **20,3 px** | titres de panneau |
| `text-headline` | 26 px | **29,3 px** | titre de section forte, titre de modale |
| `text-stat` | 28 px | **31,5 px** | un nombre qu'on lit |
| `text-display` | 40 px | **45 px** | titre de page |

**Le plancher est à 14,6 px et il n'y a rien en dessous.** `--text-xs` a été
remonté au niveau de `--text-meta` plutôt que de réécrire les quarante
endroits qui l'utilisent : le nom ment un peu, mais un nom trompeur pèse
moins qu'une ligne de 12 px devant quelqu'un qui voit mal.

Le rapport titre/corps passe de 1,6 à **3**. C'est le levier le moins cher de
toute la direction artistique, et celui qu'on n'ose jamais tirer.

**Aucune taille ne s'écrit en pixels.** Une valeur en `px` ne suit pas la
racine et se retrouve seule, minuscule, au milieu d'une interface agrandie.

### Le piège `tailwind-merge`

`tailwind-merge` départage deux classes `text-*` en devinant leur nature : une
taille de la gamme t-shirt (`sm`, `lg`, `2xl`…) va dans le groupe « corps »,
tout le reste dans le groupe « couleur ». Nos jetons ne sont ni l'un ni
l'autre à ses yeux — `text-dense` et `text-on-cobalt` atterrissaient donc tous
les deux dans « couleur », où ils se sont considérés en conflit. Le dernier
écrit gagnait, et le bouton principal perdait sa couleur de texte : de l'encre
sombre sur du cobalt, 1,3:1, illisible.

Le symptôme est silencieux — pas d'erreur, pas d'avertissement, juste une
classe qui disparaît du DOM. Il ne s'est vu qu'en regardant le rendu.

`src/lib/utils.ts` déclare donc l'échelle à `extendTailwindMerge`. **Tout
nouveau jeton `--text-*` dans `globals.css` doit y être ajouté**, sans quoi il
se remettra à voler la couleur de ce qu'il accompagne.

---

## 5. Géométrie et relief

Trois rayons, trois natures d'objet, aucune ambiguïté :

| Rayon | Valeur | Pour |
|---|---|---|
| panneau | 28 px (`rounded-panel`) | cartes, rail, modales |
| contrôle | 12 px et ses dérivés | champs, blocs de note |
| pilule | plein | boutons, pastilles, filtres, entrées de navigation |

**Le bouton est une pilule, et c'est une décision de fond.** Un rayon de 6 px
sur un bouton de 45 px de haut donne un rectangle aux angles cassés : la forme
ne dit rien, elle se contente de ne pas être carrée. La pilule se reconnaît de
loin et à la périphérie du regard — c'est la seule forme de l'interface qui
signifie « on appuie ici ».

**Le rayon large des panneaux n'est pas un goût** : c'est ce qui distingue une
surface posée sur la lumière d'une boîte découpée dans la page. L'écart avec
le rayon des contrôles est en soi une information de plan.

### L'élévation

Large et douce plutôt que serrée et nette : sous une verrière la lumière est
diffuse, et une ombre dure y serait un mensonge. Deux couches quand même,
parce qu'un objet réel en projette deux — un contact au sol, une diffusion
large. Teintée à l'encre et jamais noire : une ombre grise dans un
environnement coloré se voit comme une salissure.

Trois crans : `raised` (les panneaux), `overlay` (le rail, les modales),
`tone` (les aplats pleins, plus lourds à l'œil, donc à asseoir plus fort).

Un panneau ne cumule pas ombre *et* bordure en clair : un objet à la fois posé
et détouré semble découpé dans la page au lieu d'être dessus. En sombre
l'ombre ne se voit pas — c'est l'écart de valeur qui prend le relais, et un
filet léger vient l'appuyer.

**Un champ de saisie ne porte aucune ombre portée : c'est un creux, pas un
relief.** Il est rempli (`bg-muted`) plutôt que transparent, parce qu'un champ
transparent sur une carte blanche est invisible tant qu'on ne cherche pas le
trait. L'aplat creuse, le filet borne — les deux, parce que l'aplat seul ne
donne que 1,14:1 contre le blanc, très en dessous des 3:1 que la règle 1.4.11
demande à la limite d'un composant.

### Le sombre n'est pas le clair inversé

En clair, le sol descend sous des panneaux restés blancs. En sombre, c'est
l'inverse : la nappe descend et **les panneaux montent**. Ce qui compte monte,
toujours.

Cela vaut aussi pour les tons. `--tone-ink` vaut `#101A17` en clair et
`#1F2B27` en sombre — c'est-à-dire *au-dessus* de la carte (`#151D1A`) et de
la fenêtre (`#1C2622`). À sa valeur du clair il se confondait avec la carte,
et l'en-tête encre de l'action ouverte — le repère le plus fort de la file —
disparaissait purement et simplement.

---

## 6. Le shell

**Le rail flotte, il ne borde pas.** C'est un panneau encre posé *sur* la
nappe, à trois unités des bords, avec la même géométrie que les cartes et pour
la même raison : ce qui compte est posé sur la lumière, pas découpé dedans.

Sept des huit références de `inspiration/` posent leur navigation à la
verticale, et pour une raison qui vaut ici : la barre horizontale prélevait
3,5 rem de hauteur sur *chaque* écran, et à 112,5 % de racine la hauteur est
la ressource rare.

Les libellés restent écrits. Une navigation réduite à des pictogrammes est
exactement ce qu'il ne faut pas servir à une vue qui baisse.

| Élément | Rendu | Pourquoi |
|---|---|---|
| entrée active | pilule **zeste** | on sait où l'on est sans lire — 13,9:1 contre l'encre |
| entrée inactive | `on-ink/70` | 8,2:1, très au-dessus du plancher malgré le voile |
| compteur « À faire » | pastille **ambre** | c'est de l'attente ; pas zeste (pris par la position), pas cobalt (un bleu foncé sur du noir ne se voit qu'en le cherchant) |
| compteur « Prospects » | nombre nu | un stock sur lequel il n'y a rien à faire dans l'instant |
| « Rythme », « Réglages » | sans compteur | rien à y dénombrer : l'un est un compte rendu, l'autre de la configuration |

Un compteur à zéro ne s'affiche pas : « 0 » et rien disent la même chose, mais
« 0 » occupe le coin de l'œil pour le dire.

Sous `lg`, la même pilule encre mais couchée : le conteneur est collant, la
capsule flotte dedans, et la nappe passe derrière elle au défilement.

---

## 7. Composition d'une page

### Le titre et les chiffres sur la même ligne

Trois cartes pleine largeur occupaient autrefois la bande la plus lue de
l'écran pour trois nombres sur lesquels il n'y a rien à faire ; on les avait
donc réduits à une ligne de texte gris, ce qui les rendait illisibles au
profit de la place gagnée. Les deux réponses étaient mauvaises pour la même
raison : elles traitaient le problème comme un arbitrage de **hauteur**.

Il se règle en largeur. Sur grand écran le bandeau de chiffres vient se ranger
au bout de la ligne de titre — c'est la composition des deux références, et
elle ne coûte pas un pixel de haut. En dessous de `lg`, il repasse sous le
titre, là où il y a la place.

Chaque compteur porte une pastille ronde. Ce n'est pas une décoration : c'est
ce qui les rend distinguables *avant* la lecture. Le RDV porte le zeste parce
que c'est le seul des trois qui soit un acquis ; les deux autres restent en
pastille pâle, sinon plus rien ne les départage.

Le dispositif vit dans `components/stat.tsx` depuis que trois écrans
l'emploient — la file, les réglages, le rythme. C'était la même faute que les
cartes de groupement avant `SectionHeading` : un même objet recopié trois
fois finit par avoir trois variantes, et personne ne sait plus laquelle fait
foi. `href` y est facultatif : un compteur qui ne mène nulle part ne doit pas
s'annoncer comme cliquable.

### Le panneau doit gagner sa place

Un panneau quand **le panneau est l'interaction** — une tâche, un échange —
**ou quand il est la cellule d'une grille qui, elle, porte la hiérarchie.**

La deuxième moitié de la règle a été ajoutée après coup, et il faut dire
pourquoi. La règle d'origine s'arrêtait à la première moitié, et elle visait
juste : une *pile* de panneaux tous de la même largeur ajoute du meuble sans
ajouter de structure. Six cartes empilées disent six fois « voici un groupe »
et zéro fois « celui-ci compte plus que celui-là » — un intertitre et un filet
font le même travail pour rien (`SectionHeading`).

Mais une grille n'est pas une pile. Dès que les cellules ont des tailles
différentes, la boîte cesse d'être du décor : c'est elle qui rend la
différence de taille lisible, et la taille est de l'information. La règle
interdit donc toujours la pile, et autorise la grille.

### Le bento : la taille de la cellule est la hiérarchie

Les réglages en sont le cas d'école. La page empilait six cartes de la
largeur de l'écran, donc toutes de la même importance — alors que « ton
offre » est le seul champ dont le contenu part *mot pour mot* dans chaque
message, et qu'« inscriptions par jour » est un nombre à deux chiffres qu'on
règle une fois. La mise en page contredisait le produit.

En grille de douze colonnes : l'offre en prend sept, l'identité les cinq
restantes, la rédaction toute la largeur en dessous, le sourcing toute la
largeur encore. On sait où regarder en arrivant.

**Le piège du bento, et il est systématique : une cellule ne sait pas
remplir ce qu'on lui donne.** Le premier découpage donnait deux rangées à
l'offre, avec identité et rédaction empilées à côté. Mesuré à l'écran : 770 px
à droite contre 480 à gauche. La grande cellule était étirée à la hauteur de
sa voisine et se terminait par trois cents pixels de vide.

Deux règles en sortent :

- **on accorde les rangées aux hauteurs réelles du contenu**, jamais
  l'inverse. Un `row-span` se décide après avoir mesuré, pas avant ;
- **quand deux cellules d'une rangée ne peuvent pas s'accorder**, c'est la
  plus courte qui garde sa hauteur naturelle (`items-start`) — un bas
  irrégulier se lit comme une intention, un grand vide se lit comme un oubli.

### La grille se règle sur la colonne, pas sur la fenêtre

C'est la leçon la plus chère de cette mise en page, et elle vaut pour toute
grille de l'app.

Le bento était d'abord posé sur `lg:`, c'est-à-dire sur la largeur de la
**fenêtre**. Or le rail prélève 288 px de cette fenêtre, plus 45 px de marges.
La grille se décidait donc sur une mesure qui n'était pas la sienne, et ça
produisait une **zone morte** : élargir sa fenêtre *cassait* la mise en page.

| fenêtre | rail | colonne de contenu | grille sur `lg:` |
|---|---|---|---|
| 900 px | absent | 846 px | 12 colonnes |
| **1024 px** | **apparaît** | **691 px** | **1 colonne** |
| 1280 px | présent | 947 px | 12 colonnes |

À 1024 px — le seuil de `lg` — le rail arrive et la colonne perd 288 px d'un
coup. La grille s'installait au moment précis où la place disparaissait.

`@container` sur la racine de la page, et des seuils en **pixels** parce
qu'ils décrivent la place qu'il faut pour qu'une cellule reste lisible, pas
une taille de texte :

| Seuil | Ce qu'il déclenche | Pourquoi cette valeur |
|---|---|---|
| 680 px | la grille de douze colonnes | juste sous les 691 px qui restent quand le rail apparaît — c'est ce qui supprime la zone morte |
| 780 px | les trois contrôles de front | un `select` doit afficher « Claude Opus 5 — le plus fin » en entier : 240 px, donc 720 px de contenu |
| 640 px | la paire services / apparence | « Apparence » tient en trois pilules, elle n'a pas besoin de 400 px |

Le premier seuil est **calculé, pas choisi à l'œil**. Tout seuil au-delà de
691 recrée la zone morte. Si la largeur du rail change, ce nombre change avec
elle — c'est la seule dépendance à surveiller.

Vérifié par balayage, de 700 à 1512 px : la grille est continue à partir de
760 px de fenêtre, rail présent ou non.

**`container-type: inline-size` ne casse pas `position: sticky`.** La
question se pose parce que la containment de mise en page fabrique un bloc
conteneur pour les descendants absolus ; le collant, lui, se règle sur le
conteneur de défilement, qui reste la fenêtre. Mesuré sur la barre
d'enregistrement : `position: sticky`, 18 px du bas, inchangé.

### Il n'y a plus de bouton « Enregistrer »

Les réglages étaient un `<form>` avec un bouton en bas. Deux défauts, et on
ne les voit qu'à l'usage :

- on corrige un prénom tout en haut d'une page qui fait plusieurs écrans, on
  ne redescend pas, on part — **rien n'est écrit** ;
- on clique, et on ne sait pas *ce qui* vient d'être enregistré : un bouton
  unique parle pour douze champs à la fois.

Une barre collante réglait le premier et pas le second. Chaque champ
s'enregistre donc seul, au moment où on le quitte — Entrée, ou la sortie du
champ, parce que c'est ce que fait la moitié des gens et qu'un texte perdu
faute d'avoir appuyé sur la bonne touche est impardonnable.

**Ce que ça coûte, et qu'il faut payer.** Supprimer le bouton supprime aussi
le moment « je valide ». La confirmation doit alors venir du champ lui-même,
sinon on ne sait jamais si c'est parti. `FieldStatus` n'est pas une
décoration : c'est le pendant obligatoire de la suppression du bouton.

| État | Rendu | Durée |
|---|---|---|
| enregistrement | roue + « Enregistrement… » | le temps de l'aller-retour |
| succès | coche verte + « Enregistré » | 2,4 s puis s'efface |
| échec | triangle + la cause, en `--destructive` | **reste** |

Le succès s'efface, l'échec reste : un succès qu'on rate n'a pas de
conséquence, un échec qu'on rate en a une.

**En cas d'échec, le texte tapé reste à l'écran.** Le remettre à la valeur
stockée serait exact et insupportable — ce qui manque, c'est l'enregistrement,
pas la rédaction.

**Ce qui est écrit est ce qui revient.** L'action serveur renvoie la valeur
telle qu'elle a été stockée, et c'est elle qu'on affiche — pas ce qu'on croit
avoir tapé. Le nettoyage peut changer la valeur : une espace de trop
disparaît, un seuil à 150 redescend à 100. Sans bouton, l'écran est la seule
confirmation qu'on ait ; il ne peut pas mentir.

**Une seule table de validation.** C'est le vrai risque de ce changement, et
il était déjà nommé dans le code d'avant : « deux chemins d'écriture pour les
mêmes réglages finiraient par ne pas valider la même chose ». `FIELDS`, dans
`reglages/actions.ts`, est la seule description de ce qu'un réglage a le droit
de valoir ; `saveSetting` ne sait rien faire d'autre que la consulter, et une
clé absente de la table est refusée — ce qui interdit au passage à un appel
client de fabriquer un nom de colonne.

**Ce que la suppression a emporté avec elle.** La carte de sourcing tenait une
« référence » de ce qui avait été enregistré, la comparait à l'écran, en
tirait un état « modifié », et verrouillait le bouton de cycle tant que
l'écran et la base divergeaient : une trentaine de lignes pour rattraper un
décalage. Le décalage n'existe plus, la machinerie non plus.

### Un champ au repos est du texte

Une page de réglages hérissée de contrôles bordés en permanence *demande*
qu'on écrive dedans, alors qu'on vient presque toujours relire.

Au repos, une valeur se lit donc comme du texte, à `text-body`. Le fond
n'apparaît qu'au survol, et le crayon avec lui. La page se lit comme un
document et s'édite là où on la lit — ce qui est aussi ce qui rend le
« sans bouton » supportable : il n'y a plus de formulaire à valider parce
qu'il n'y a plus de formulaire.

Trois règles en découlent, et les trois viennent d'un défaut constaté :

- **la cible est la ligne entière, jamais le crayon.** Viser une icône de
  16 px pour reprendre un texte est un jeu d'adresse, pas une interface ;
- **le crayon redevient permanent sans survol** (`@media (hover: none)`).
  « Tant qu'on ne pointe pas » veut dire « jamais » sur une tablette :
  l'affordance disparaîtrait pour de bon ;
- **un champ vide l'écrit, il ne montre pas son exemple en gris.** Un
  `placeholder` grisé à la place d'une valeur se lit *comme* une valeur — on
  croit avoir renseigné son prénom parce qu'on voit « Florent ». L'exemple
  réapparaît dans le champ dès qu'on l'ouvre.

Le `select` fait exception et n'a pas de mode lecture : il *est* déjà sa
propre valeur. Le déguiser en texte imposerait un clic de plus pour révéler
un contrôle qui n'occupe pas plus de place que le texte qu'il remplacerait.

### La file du jour : une action ouverte à la fois

Les actions dépliées les unes sous les autres, la journée ne se voyait pas —
sept actions faisaient plusieurs écrans. La file est donc un accordéon : une
carte ouverte, les autres en lignes.

**L'action ouverte porte un en-tête encre.** C'est la seule de la file, et
c'est ce qui la désigne d'un bout à l'autre de l'écran. Le corps reste blanc :
on y écrit, et on n'écrit pas sur du noir.

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

### Le rythme : des points, pas des barres

Le dispositif vient de `inspiration/` — une colonne par jour, un point par
unité, deux séries dont l'une est ghostée. Il n'a pas été repris pour son
allure.

**Une petite série quotidienne se compte, elle ne se mesure pas.** Sur une
barre, « 4 » et « 5 » se ressemblent : il faut lire une graduation pour les
séparer. En points, on les compte sans les lire. Pour une file de travail où
le volume d'un jour tient sur les doigts d'une main, c'est la bonne
précision — et c'est la seule raison valable de préférer cette forme.

**Les deux séries sont de la donnée, pas un effet.** La référence oppose
« Actual » et « AI Projected » ; l'app possède exactement cette paire, sans
rien inventer :

| Série | Source | Ton |
|---|---|---|
| envoyé | `tasks.doneAt`, statut `done` | `--success` — c'est un acquis |
| encore dû | `tasks.dueAt`, statut en attente | ton `amber` — c'est de l'attente |

D'où la lecture qui justifie tout le reste : **des points ambre sur un jour
passé sont du retard**, et ils se voient sans qu'on ait à les chercher. Sur
les jours à venir, les mêmes points annoncent la charge. Un seul dessin
répond à « est-ce que je tiens le rythme ? » et à « qu'est-ce qui m'attend ? ».

Trois règles qui ne se voient pas mais sans lesquelles le graphique ment :

- **un jour à zéro porte un point creux**, jamais rien. L'absence se lirait
  comme une donnée manquante, alors que c'est un jour sans rien à faire ;
- **au-delà de douze points, un point vaut plusieurs actions — et la légende
  l'écrit.** Un graphique dont l'unité change en silence ment ;
- **la colonne réserve sa hauteur même vide**, sinon les colonnes ne
  partagent pas la même ligne de sol et le graphique ondule.

**Il a sa propre page, et c'est une décision.** Il a d'abord été posé sous la
file du jour, ce qui évitait la vraie faute — un graphique en tête d'écran
repousse la première action vers le bas pour montrer un chiffre sur lequel il
n'y a rien à faire — mais en laissait une autre : la file a **un seul rôle**,
faire avancer le travail du jour, et tout ce qui s'y ajoute le dilue, même en
bas de page.

`/rythme` est donc un écran à part, et il l'annonce dès son sous-titre :
« rien à faire ici, c'est un compte rendu, pas une file ». La séparation vaut
aussi pour les requêtes : la file redescend à quatre connexions concurrentes,
et la page de rythme n'en prend qu'une.

C'est le seul écran qui réponde à « est-ce que je tiens la cadence », donc il
gagne une entrée dans le rail — contrairement à `/import`, qui reste
joignable depuis les écrans vides parce qu'on l'ouvre deux fois dans une vie.
L'ordre du rail suit la journée : le travail, le stock, le compte rendu, la
configuration.

**Une requête, et le découpage en jours côté Node.** Le pool est à 8 et cette
page en occupait déjà cinq avec le rail ; les deux séries voyagent donc
ensemble. Le découpage ne se fait pas en SQL : `::date` découpe sur le fuseau
de la session — UTC chez Supabase — quand tout le reste de la page raisonne
en minuit local. Deux définitions du mot « jour » dans le même écran
finiraient par ne pas tomber d'accord sur ce qu'est aujourd'hui.

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
marqué, et il se rend donc en **ton zeste plein** — pas en teinte à 5 %.

---

## 8. Le bouton d'action est un contrat

`ActionButton` **exige** une `tooltip` : un bouton dont personne ne sait ce
qu'il fait ne vaut rien. C'est imposé par le type, pas par la discipline.

`confirm` est réservé aux actions qui **dépensent de l'argent**, **changent
l'état d'un lead**, ou **ne se rattrapent pas**. En mettre partout entraînerait
à valider sans lire, et le garde-fou ne protégerait plus rien là où il compte.

La description d'une confirmation dit ce qui se passe *réellement* : effets en
base, argent dépensé, ce qui devient irréversible. C'est le seul endroit où
l'on peut encore changer d'avis. C'est aussi le meilleur travail de design de
l'app — ne pas le diluer.

---

## 9. Ce qui n'a pas bougé

La direction artistique a changé d'univers ; ces décisions-là sont
antérieures, indépendantes du style, et restent vraies.

### Un brouillon est daté, même s'il ne le dit pas

Le corps d'un message est figé au moment de sa rédaction, avec la
configuration de ce moment-là. Un brouillon écrit en local porte donc un lien
de désinscription en `localhost` — inutilisable pour son destinataire, alors
que ce lien est obligatoire en prospection.

C'est exactement le genre de détail qu'on ne relit pas : il est en pied de
message, toujours au même endroit, et on cesse de le voir. La carte compare
donc l'**origine** du lien à celle de l'app et refuse de laisser partir un
message dont le lien pointe ailleurs.

C'est le seul avertissement de la file en registre « problème » et non en
« à surveiller » : envoyer un message dont le destinataire ne peut pas se
désinscrire n'est pas un défaut de qualité.

Limite connue : la comparaison utilise `NEXT_PUBLIC_APP_URL` telle qu'inscrite
dans le bundle au moment du build. Si la variable manque, il n'y a rien à
comparer et aucune alerte ne se déclenche — d'où sa présence dans la liste
« Services connectés » des réglages.

### Une erreur stockée n'est pas un diagnostic

`tasks.error` garde ce qui s'est passé à la dernière rédaction, parfois il y a
plusieurs jours. Affichée telle quelle, elle se lit comme un constat du
moment : on corrige la cause, on recharge, le message reste, et on cherche un
problème qui n'existe plus. Un état passé s'écrit donc **au passé** —
« Dernière rédaction : … ».

La même colonne porte trois registres, qui n'appellent pas le même geste :

| Registre | Exemple | Rendu |
|---|---|---|
| avertissement | « À relire : montant chiffré » | teinte ambre — le brouillon est là, il mérite un œil |
| état | « lead en liste d'exclusion » | neutre — ce n'est pas une panne |
| échec | crédit épuisé, variable absente | teinte ambre, au passé, avec le geste à faire |

**Aucune erreur brute ne s'affiche.** `lib/task-error.ts` applique à la file la
règle qu'`(app)/error.tsx` avait déjà tranchée pour les pannes de page :
nommer la cause probable et le geste, ranger le détail technique sous un
`details`.

### Le sens ne se délègue pas à la mise en page

Une ligne de texte doit rester lisible sans son CSS. JSX ne laisse aucune
espace entre deux éléments écrits sur des lignes séparées : une suite de
valeurs qui ne tient qu'au `gap` du conteneur se recolle en
« 485 leads0 ont répondu0 RDV » dès que `display: flex` n'arrive pas.

La séparation appartient donc au contenu. Le point médian (`·`) est la
ponctuation de l'app — « besoin 40 · valeur 30 ». Il est `aria-hidden` quand
les éléments qu'il sépare sont déjà annoncés distinctement. Le `gap` reste,
pour respirer, pas pour signifier.

### Retour et repères

Un lien de retour dit d'où l'on vient, jamais où l'on suppose que l'on est.
Écrit en dur, il se trompe dès qu'il existe deux chemins vers le même écran —
et un fil d'Ariane qui se trompe de parent est pire que pas de fil du tout,
parce qu'on lui fait confiance.

La provenance voyage donc dans l'URL (`?depuis=file`), et non dans l'historique
du navigateur : le retour reste juste après un rechargement, ou si le lien est
rouvert depuis un onglet resté ouvert.

**Revenir, c'est retrouver sa place**, pas seulement la page. Deux mémoires
s'en chargent, en `sessionStorage`, restaurées après le premier rendu — jamais
dans l'état initial, qui doit rester identique côté serveur et côté client :
`ScrollMemory` rend la position de défilement ; la file rend l'action qui
était ouverte, et ne la rouvre que si elle est encore là.

### Accessibilité

Acquis, à ne pas défaire :

- lien d'évitement en tête de `(app)/layout.tsx` ;
- un seul `:focus-visible` pour toute l'app — ne jamais remettre `outline-none`
  dans un composant sans le remplacer par autre chose ;
- `aria-pressed` sur les filtres : l'état actif ne peut pas tenir à la seule
  couleur de fond ;
- un `sr-only` en toutes lettres à côté de chaque état rendu par une icône ;
- `prefers-reduced-motion` neutralise animations et transitions ;
- **un libellé visible par champ**. Le `placeholder` n'est pas un libellé.

**La cible tactile de 44 px est atteinte.** C'était une dette ouverte depuis le
début : les boutons plafonnaient à 40,5 px. Le passage de `h-9` à `h-10` les
porte à **45 px** à la racine de 112,5 %, et les champs suivent à la même
hauteur — un formulaire dont les champs et les boutons ne s'alignent pas se
voit immédiatement, sans qu'on sache dire pourquoi.

### Thème

Trois états, pas deux : **Système**, **Clair**, **Sombre**. « Système » doit
rester atteignable — c'est le bon défaut pour qui bascule son ordinateur en
sombre le soir — donc un interrupteur à deux positions ne suffit pas.

Le choix vit dans `localStorage`, pas en base : c'est une préférence
d'appareil. Le contrôle est donc **hors du formulaire** des réglages.

Mécanique, dans l'ordre où elle s'exécute :

1. un script en ligne dans `<head>` pose la classe **pendant l'analyse du
   HTML**, avant toute peinture ;
2. `suppressHydrationWarning` sur `<html>`, sinon React voit l'écart, le traite
   en erreur, et re-rend — en effaçant la classe ;
3. `ThemeSync` la repose en `useLayoutEffect`, pour le Strict Mode du
   développement.

`classList.add/remove` et jamais une réécriture de `className` : `<html>` porte
aussi les variables de police posées par `next/font`.

**Aucun utilitaire `dark:` dans l'app.** `@custom-variant dark` ne réagit qu'à
la classe, donc un `dark:` quelconque serait muet en mode « Système ». Tout
passe par les variables CSS, qui elles suivent les trois états.

### Mouvement

Sobre et fonctionnel. Les modales entrent en 180 ms, sortent en 120 ms : ce
qui s'en va n'a pas à se faire attendre. L'icône de navigation devient une roue
pendant le chargement, à dimensions égales — rien ne bouge autour.

**La zone de survol est l'élément, jamais l'icône.** Animate UI pose ses
gestionnaires sur le `<svg>` lui-même ; laissé tel quel, il faut viser un
glyphe de 16 px pour obtenir une réaction. Le déclencheur est donc posé sur
l'élément entier, via `<AnimateIcon animateOnHover asChild>`.

Deux déclenchements, et deux seulement :

| Déclenchement | Pour | Exemple |
|---|---|---|
| `animateOnHover` (sur l'élément) | ce qu'on pointe | copier, navigation, ajouter |
| `animate` + `loop` | ce qui travaille | l'étincelle pendant que le modèle rédige |

**Rien ne s'anime tout seul.** Sur un outil ouvert toute la journée, une
animation qui se déclenche sans qu'on la demande finit par fatiguer.

`icons/icon.tsx` a été patché pour respecter `prefers-reduced-motion` — le
registre ne le fait pas, et la règle CSS de `globals.css` ne peut rien pour
lui puisque Motion anime en JavaScript. **À reporter à chaque mise à jour des
composants Animate UI**, faute de quoi la régression revient sans bruit. Même
règle pour GSAP, et pour la même raison : `use-expand-transition.ts` lit le
réglage à la main, à chaque bascule.

#### Le bandeau qui devient carte

C'est le seul mouvement de l'app qui ne soit ni une entrée ni une sortie, mais
une **transformation** — et la seule raison d'avoir GSAP en plus de Motion :
Flip apparie deux éléments qui n'ont aucun rapport dans le DOM.

Repliée, une action est une ligne ; dépliée, un panneau à en-tête encre. Ce
sont deux arbres différents, que React substitue en une image. Animer la seule
hauteur ne suffit pas : la boîte glisse, mais la substitution reste visible en
son milieu, et c'est elle qu'on lit comme un à-coup.

La règle tient en trois attributs, dans `task-card.tsx` :

| Attribut | Pour | Effet |
|---|---|---|
| `data-flip-id` | ce qui existe **des deux côtés** (canal, nom, score, échéance) | glisse de l'ancienne place à la nouvelle |
| `data-reveal` | ce qui n'existe **qu'ouvert** (étape, contact, argumentaire, panneau) | paraît, une fois le fond sombre |
| `data-chevron` | la flèche, seule de son espèce | pivote sur place, sans se déplacer |
| `data-voile` | l'aplat de la carte, par-dessus l'encre | se retire vers le bas, et cadence tout le reste |

Toute pièce ajoutée à l'en-tête doit choisir son camp. Une pièce présente des
deux côtés sans `data-flip-id` sera remplacée au milieu du geste.

**Le blanc ne devient pas noir : il se retire.** Un fondu entre les deux passe
par le gris — c'est de l'arithmétique, pas un réglage : à mi-chemin le fond et
le texte se retrouvent à la même valeur et le nom de l'entreprise disparaît.
L'en-tête porte donc un **voile** (`data-voile`) de la couleur de la carte,
posé par-dessus l'encre, qui se retire vers le bas en 100 ms. Au-dessus du
bord l'encre, au-dessous la carte, jamais de gris entre les deux.

**Ce bord est l'horloge du geste.** Chaque pièce change d'encre, chaque ligne
nouvelle paraît, le chevron se retourne — au moment précis où le bord la
dépasse, calculé depuis sa position dans l'en-tête. D'où une contrainte à ne
pas défaire : **le voile descend en `ease: "none"`**. Sous une courbe, le bord
passe ailleurs qu'à l'heure calculée, et le texte bascule une image trop tôt,
en clair sur du blanc.

Le geste : le bandeau s'étire en blanc (130 à 180 ms selon la distance), le
voile se retire à partir d'un cinquième, tout suit son bord. **Ces durées sont
celles de la doctrine, et c'est délibéré** : l'accordéon s'en était éloigné au
nom de la distance parcourue — une carte traverse six cents pixels quand une
modale en parcourt dix — et il y avait gagné une lenteur qui ne ressemble pas
à l'outil. On ouvre trente actions dans une journée : ça doit répondre sous le
doigt. Six images de rideau suffisent à voir un bord passer sans l'attendre.

**Le repli n'a pas de mécanique à lui : c'est le même geste, joué à l'envers,
1,6 fois plus vite** — 125 ms, contre 170 à l'aller. Tant qu'il en avait une, il ramenait un à un les défauts
qu'on venait de retirer de l'ouverture — la substitution brutale, et la
pastille du retard qui réapparaissait sur la ligne blanche le temps du retour.
Une seule construction jouée dans les deux sens ne peut pas diverger : on pose
la timeline à sa fin (`progress(1)`) et on la remonte (`reverse()`). Le
panneau s'efface, l'encre remonte, la ligne retrouve exactement son aspect
replié — et c'est seulement là que React remplace l'arbre, quand la
substitution n'a plus rien à changer.

C'est pourquoi `useExpandTransition` rend un `shown` distinct de `expanded` :
au repli, le panneau reste monté le temps de se refermer. Sans ce sursis, son
contenu disparaît d'un coup pendant que la boîte, elle, glisse.

Deux pièges de couleur, tous deux invisibles en lecture de code :

- **Tailwind 4 écrit les couleurs à opacité modifiée en `oklab()`** (tout
  `text-…/70`), que GSAP ne sait pas lire : il replie la cible sur du noir.
  D'où `interpolable()` dans le hook — on n'interpole que du `rgb()`, on
  bascule le reste.
- **`badgeVariants` porte `transition-colors` dans ses classes de base.** Dès
  que GSAP écrit une couleur en ligne sur une pastille, la transition CSS s'en
  empare et la ramène : on voyait la pastille du retard s'effacer puis
  revenir. Deux moteurs sur la même propriété, il faut en couper un — le hook
  neutralise `transition-property` sur ce qu'il touche. Et il ne touche que ce
  qui change vraiment : les pastilles du canal et du score ont la même couleur
  des deux côtés, on les laisse tranquilles.

**Rien ne bouge en s'ouvrant.** C'est l'état d'arrivée, et il a coûté cinq
allers-retours : le canal, le nom, le score et le chevron sont au pixel près à
la même place dans les deux états, l'échéance à un pixel. La carte ne se
réorganise pas, elle change de surface — Flip ne reste là que comme filet,
pour les cas où la mise en page décale quand même quelque chose.

Ce que ça impose, et qu'on ne peut pas défaire sans que le mouvement revienne :

- **l'en-tête porte `pt-4`**, le retrait du bandeau, et non le `p-5` de ses
  trois autres côtés ; le bouton de repli porte `-my-2` pour garder sa cible
  de 40,5 px sans dicter la hauteur de la rangée. Sans ces deux-là, la
  première ligne descend de 11,5 px.
- **la gouttière est `gap-2.5` des deux côtés.** À `gap-2` dans l'en-tête, le
  nom et le score se décalaient de deux pixels.
- **ce qui décrit l'action va à droite** : l'étape rejoint l'échéance, avec
  `ml-auto` — glissée entre le canal et le nom, elle poussait les deux pièces
  qui n'ont aucune raison de bouger, de soixante-dix-sept pixels. `ml-auto`
  ne revient à l'échéance que si l'étape ne l'a pas pris : deux marges
  automatiques dans une rangée se partagent l'espace libre et sépareraient
  les deux pastilles.
- **le bandeau réserve le rembourrage de la pastille** (`px-2.5 py-0.5` sur
  une échéance sans fond). Dépliée elle devient une pastille, pour tenir sur
  l'aplat encre ; sans cette réserve, son texte rentrait de onze pixels et
  c'était le dernier morceau qui se déplaçait.
- **le chevron a la même empreinte de 40,5 px des deux côtés** — c'est elle
  qui fixe où s'arrête l'échéance. Apparié par Flip, il changeait de place
  *et* d'angle : il passait par tous les degrés intermédiaires, et une flèche
  à quarante-cinq degrés a l'air cassée. Le demi-tour au repos est sur le
  `<svg>`, la rotation animée sur l'enveloppe : sur le même nœud, ils se
  cumuleraient.

### Une contrainte qui n'est pas du design mais qui le borne

Le pooler transactionnel de Supabase tient mal les requêtes empilées :
`src/db/client.ts` fixe le pool à 5 et documente la mesure. **Toute page qui
ajoute une requête à un `Promise.all` doit compter le total concurrent de la
page**, pas seulement celui de sa fonction. Un compteur ajouté sans ce calcul
a suffi à faire échouer la file du jour.

Conséquence de conception : un compteur supplémentaire se fabrique avec
`count(*) filter (where …)` dans une requête existante, pas avec une nouvelle
requête.

---

## Dettes ouvertes

| Sujet | État |
|---|---|
| Le bandeau « il manque des réglages » en ton ambre plein | assumé, mais c'est le bloc le plus lourd de la page pour une condition *permanente*. À revoir s'il devient du papier peint |
| ~~Panneaux de groupement des `reglages`~~ | réglé : grille bento à douze colonnes, « Cadence » fondue dans « Rédaction » |
| ~~Bouton « Enregistrer » d'une page à plusieurs écrans~~ | réglé : édition en place, un enregistrement par champ, un indicateur par champ |
| Panneaux de groupement de la fiche prospect | toujours cinq empilés ; le bento des réglages donne le patron à suivre |
| ~~Cibles tactiles~~ | réglé : 45 px, boutons et champs |
| ~~Hiérarchie de « À faire »~~ | réglé : bandeau en ligne de titre, file repliée, en-tête encre sur l'action ouverte |
| ~~Bascule de thème manuelle~~ | réglé : Réglages → Apparence, trois états |
| Compte rendu d'import ligne à ligne | on annonce un nombre, pas un résultat |
| Pas de colonne `error_at` sur `tasks` | on sait *que* la rédaction a échoué, jamais *quand* |
| Points de rupture des autres écrans | les `reglages` passent par `@container` ; la file, la liste et la fiche sont toujours sur `sm`/`lg` et gardent donc la zone morte de 1024 px |
