# Prospection

Outil de prospection B2B : sourcing, scoring par signaux, séquences,
rédaction assistée. **Aucun message ne part tout seul** — l'app rédige, tu
copies, tu envoies depuis ton client mail, tu marques envoyé.

```
Next.js 16 (App Router)  ·  Supabase Postgres  ·  Drizzle  ·  Vercel
Tailwind v4 + shadcn/ui  ·  Claude (rédaction)  ·  QStash (jobs différés)
```

## Pourquoi l'envoi est manuel

Un domaine neuf qui envoie en masse finit en spam, définitivement. La
montée en charge d'un expéditeur prend deux à trois semaines. Tant que ce
n'est pas fait, l'envoi automatique est un piège : il coûte la
délivrabilité de ton domaine pour gagner trois clics.

L'app fait donc tout le travail sauf l'envoi. Le passage à l'envoi
automatique est prévu, voir *Phase 2* plus bas.

---

## Mise en route (30 minutes)

### 1. Supabase

Crée un projet sur [supabase.com](https://supabase.com), puis relève dans
**Project Settings** :

| Valeur | Où la trouver |
|---|---|
| `DATABASE_URL` | Database → Connection string → **Transaction pooler** (port 6543) |
| `DIRECT_URL` | Database → Connection string → **Session pooler** (port 5432) |
| `NEXT_PUBLIC_SUPABASE_URL` | API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | API → Project API keys → `anon` `public` |

### 1 bis. Créer ton compte

Il n'y a **pas de page d'inscription** dans l'app, et c'est volontaire :
un outil à un seul utilisateur n'a aucune raison d'exposer un formulaire
d'inscription au public. Le compte se crée une fois, à la main.

Dans Supabase → **Authentication → Users** → *Add user* → *Create new user* :

- ton adresse email,
- un mot de passe (prends-en un long, ton gestionnaire le retiendra),
- coche **Auto Confirm User** — sinon Supabase attend une confirmation par
  email que rien ne viendra valider.

Cette même adresse doit figurer dans `ALLOWED_EMAILS`, sinon la connexion
est refusée même avec le bon mot de passe.

Mot de passe oublié plus tard : Authentication → Users → ton compte →
*Reset password*. Pas de flux de réinitialisation dans l'app non plus.

### 2. Variables d'environnement

```bash
cp .env.example .env.local
openssl rand -hex 32   # → UNSUBSCRIBE_SECRET
openssl rand -hex 32   # → CRON_SECRET
```

Renseigne au minimum `DATABASE_URL`, `DIRECT_URL`, les deux variables
Supabase, `ALLOWED_EMAILS` (ton adresse) et `ANTHROPIC_API_KEY`.

> `ALLOWED_EMAILS` n'est pas optionnel. L'app n'expose aucun formulaire
> d'inscription, mais l'endpoint `/auth/v1/signup` de Supabase, lui, reste
> joignable avec la clé anonyme — qui est publique par nature, elle part
> dans le JavaScript du navigateur. La liste blanche est ce qui rend un
> compte auto-créé inutile. Sans elle, personne ne peut entrer, toi
> compris.
>
> Ceinture et bretelles : dans Supabase → **Authentication → Sign In / Up
> → Email**, désactive *Allow new users to sign up*. Ton compte existe
> déjà, tu n'en créeras pas d'autre.

### 3. Base de données

```bash
pnpm install
pnpm db:migrate   # crée les tables + verrouille l'API REST Supabase
```

Supabase te livre un Postgres vide : il gère le schéma `auth` (ton compte),
mais aucune table applicative n'existe avant cette commande. `db:migrate`
exécute les fichiers SQL de `drizzle/`, générés depuis `src/db/schema.ts`.

`pnpm db:seed` existe aussi mais n'est plus nécessaire : la séquence par
défaut se crée toute seule au premier accès. Le seed sert à préparer une
base à l'avance, ou à repartir d'une séquence propre après l'avoir
modifiée.

### 4. Lancer

```bash
pnpm dev
```

Va sur `http://localhost:3000`, connecte-toi, puis remplis **Réglages** —
ton offre, tes mentions légales, ton lien de RDV. Le modèle rédige à
partir de là ; sans ces champs les messages sont creux.

---

## Déploiement sur Vercel

```bash
vercel link
vercel env pull   # vérifie ce qui est déjà là
```

Reporte toutes les variables de `.env.local` dans **Settings →
Environment Variables**, en corrigeant `NEXT_PUBLIC_APP_URL` par l'URL de
production, **sans slash final**.

Dans Supabase → **Authentication → URL Configuration**, mets *Site URL* à
`https://ton-app.vercel.app`. La connexion par mot de passe n'utilise pas
de redirection, mais ce champ sert aux emails que Supabase peut envoyer
(réinitialisation de mot de passe depuis le tableau de bord).

### QStash

[console.upstash.com/qstash](https://console.upstash.com/qstash) →
copie `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`.

Gratuit jusqu'à 500 messages/jour. Sans ces clés l'app fonctionne quand
même, mais l'enrichissement s'exécute en ligne — un import de cinquante
leads dépassera alors la limite de 60 s d'une fonction Vercel.

### Cron

`vercel.json` déclare une exécution quotidienne à 5 h UTC. Le plan Hobby
n'en autorise qu'une par jour, c'est prévu pour : le cron ne fait aucun
travail lourd, il découpe et délègue à QStash.

---

## Comment ça marche

```
import CSV / sourcing Places
        ↓
enrich:lead          sonde du site → signaux → Pappers → adresse
        ↓
score                somme pondérée des signaux, bornée à 100
        ↓
inscription          score ≥ seuil, joignable, jamais exclu
        ↓
tâche                une action datée, dans la file du jour
        ↓
draft:task           rédaction Claude + linter de style + garde-fous
        ↓
tu copies, tu envoies, tu marques  →  l'étape suivante est programmée
```

### Les signaux

Ils viennent du site lui-même, pas d'une API payante. Ce sont eux qui
rendent la personnalisation vraie : un constat vérifiable vaut mieux que
n'importe quelle formule d'accroche.

| Signal | Poids |
|---|---|
| `no_website` — aucun site référencé | 40 |
| `unreachable` — site en erreur ou trop lent à répondre | 35 |
| `social_only` — présence limitée à une page Facebook | 35 |
| `http_only` — pas de HTTPS | 30 |
| `not_responsive` — pas adapté au mobile | 25 |
| `recent_company` — entreprise de moins de 3 ans | 20 |
| `slow` — page d'accueil au-delà de 3 s | 20 |
| `stale` — copyright figé depuis plus de 2 ans | 15 |

Les libellés sont réutilisés tels quels dans les messages.

### Les trois barrières sur la rédaction

1. **Les gabarits à fentes** (`lib/templates.ts`) — le modèle ne remplit
   que `hook`, `bridge`, `ask`. Formule d'appel, signature et mentions
   légales sont du code, donc constantes et non facturées en tokens.
2. **Le linter de style** (`lib/style.ts`) — liste noire de formules, et
   rejet si l'écart-type des longueurs de phrases descend sous 3 mots
   (un rythme plat est le marqueur le plus reconnaissable d'un texte
   généré). Deux régénérations maximum, avec le motif du rejet.
3. **Les garde-fous** (`lib/guardrails.ts`) — regex sur les montants,
   délais, engagements et remises, appliquées *après* génération. Un
   brouillon qui les déclenche t'est présenté avec un avertissement.

Le prompt interdit déjà tout ça, mais une consigne n'est pas une
garantie : le contrôle est mécanique, pas déclaratif.

### Coût

Le prompt système porte un marqueur de cache : il est identique d'un lead
à l'autre, donc facturé un dixième du tarif d'entrée dès le deuxième
appel. À vingt messages par jour sur Opus 5, compte **~0,30 €/jour**.
Bascule sur Haiku 4.5 dans les réglages pour diviser par cinq, au prix
d'accroches plus plates.

---

## Points d'attention

**La liste d'exclusion n'est jamais purgée.** C'est la preuve qu'une
opposition a été respectée. La vider reviendrait à risquer de recontacter
quelqu'un qui s'y est opposé.

**Le lien de désinscription est obligatoire**, même en envoi manuel. Il
est ajouté au pied de chaque email par le code, et alimente la liste
d'exclusion sans intervention de ta part.

**La sécurité repose sur `ALLOWED_EMAILS` et le proxy** (`src/proxy.ts`,
l'ex-middleware, renommé par la convention Next 16), pas sur
RLS. L'app accède à Postgres en direct, ce qui contourne RLS par
construction. La migration `0001` active RLS sans policy uniquement pour
fermer l'API REST publique de Supabase — utile si la clé anonyme fuite,
mais ce n'est pas ce qui protège tes données.

**Google Places facture chaque requête.** Le masque de champs dans
`lib/places.ts` détermine le palier tarifaire : vérifie la grille avant
de l'élargir, et garde la liste de requêtes courte.

**LinkedIn reste manuel par nature.** L'automatisation des messages est
hors conditions d'utilisation et les restrictions de compte sont
fréquentes et souvent définitives.

---

## Phase 2 — envoi automatique

Prévue, pas abandonnée. Il faudra :

1. un fournisseur d'envoi (Resend, Postmark ou SES) avec SPF, DKIM et
   DMARC configurés sur un sous-domaine dédié ;
2. la réception des réponses par webhook, avec adressage VERP pour
   rattacher chaque réponse à sa conversation ;
3. une montée en charge progressive — 20 envois/jour, doublement
   hebdomadaire, coupe-circuit au-delà de 3 % de rebonds ;
4. l'agent répondeur, avec escalade vers toi sur demande de prix.

Le code de référence de ce moteur existe déjà dans `prospect/` (archive
de la version VPS/Docker). Il est à transposer en serverless, pas à
réécrire.

---

## Commandes

| Commande | Effet |
|---|---|
| `pnpm dev` | serveur de développement |
| `pnpm build` | build de production |
| `pnpm typecheck` | vérification TypeScript |
| `pnpm db:generate` | génère une migration après modification du schéma |
| `pnpm db:migrate` | applique les migrations |
| `pnpm db:studio` | explorateur de base |
| `pnpm db:seed` | séquence par défaut (optionnel — l'app la crée seule) |
