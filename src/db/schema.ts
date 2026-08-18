import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const leadSource = pgEnum("lead_source", [
  "google_places",
  "csv_import",
  "manual",
  "linkedin",
]);

export const leadStatus = pgEnum("lead_status", [
  "new", // sourcé, pas encore enrichi
  "enriched", // signaux détectés
  "scored", // score calculé
  "enrolled", // dans une séquence
  "engaged", // a répondu
  "booked", // RDV pris
  "won",
  "lost",
  "suppressed", // opposition / exclusion
]);

export const channel = pgEnum("channel", [
  "email",
  "linkedin",
  "phone",
  "contact_form",
]);

/**
 * Le cycle de vie d'une action. `drafted` est l'état qui compte : le
 * message est rédigé et attend que tu le copies. Rien ne part tout seul.
 */
export const taskStatus = pgEnum("task_status", [
  "pending", // créée, brouillon pas encore généré
  "drafted", // brouillon prêt, en attente de toi
  "done", // tu l'as envoyé à la main
  "skipped",
  "failed", // la rédaction a échoué, voir `error`
]);

export const enrollmentStatus = pgEnum("enrollment_status", [
  "active",
  "paused",
  "completed",
  "stopped",
]);

export const conversationStatus = pgEnum("conversation_status", [
  "open",
  "closed_won",
  "closed_lost",
]);

export const messageRole = pgEnum("message_role", [
  "us", // ce que tu as envoyé
  "prospect", // ce qu'il a répondu
  "draft", // brouillon proposé par l'IA, pas encore envoyé
]);

export const suppressionReason = pgEnum("suppression_reason", [
  "unsubscribe",
  "complaint",
  "bounce",
  "manual",
]);

export const suggestionStatus = pgEnum("suggestion_status", [
  "proposed", // proposée, pas encore tranchée
  "accepted", // ajoutée à la liste de sourcing
  "dismissed", // écartée — ne sera plus jamais reproposée
]);

/* ------------------------------------------------------------------ */
/* Leads                                                               */
/* ------------------------------------------------------------------ */

/**
 * Google Places : seul `placeId` est stockable sans limite de durée, le
 * reste du contenu doit être rafraîchi — d'où `placesRefreshedAt`, que le
 * cron quotidien utilise pour re-sonder les fiches périmées.
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: leadSource("source").notNull(),
    /**
     * La requête Places qui a ramené cette fiche, gardée telle quelle
     * pour mesurer le rendement de chaque requête. Nulle pour un lead
     * importé, créé à la main, ou sourcé avant l'ajout de ce suivi.
     */
    sourceQuery: text("source_query"),
    status: leadStatus("status").notNull().default("new"),

    placeId: text("place_id"),
    siren: text("siren"),

    companyName: text("company_name").notNull(),
    contactName: text("contact_name"),
    contactRole: text("contact_role"),

    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    linkedinUrl: text("linkedin_url"),
    contactFormUrl: text("contact_form_url"),

    address: text("address"),
    city: text("city"),
    postalCode: text("postal_code"),
    lat: real("lat"),
    lng: real("lng"),

    // Firmographie (Pappers)
    naf: text("naf"),
    headcount: integer("headcount"),
    revenue: integer("revenue"),
    incorporatedAt: timestamp("incorporated_at", { withTimezone: true }),

    score: integer("score"),
    scoreRationale: text("score_rationale"),
    scoredAt: timestamp("scored_at", { withTimezone: true }),

    notes: text("notes"),

    placesRefreshedAt: timestamp("places_refreshed_at", { withTimezone: true }),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("leads_place_id_key").on(t.placeId),
    index("leads_status_idx").on(t.status),
    index("leads_score_idx").on(t.score),
    index("leads_email_idx").on(t.email),
    index("leads_company_idx").on(t.companyName),
    index("leads_source_query_idx").on(t.sourceQuery),
  ],
);

/**
 * Un signal = une raison objective et vérifiable de contacter ce lead.
 * C'est ce qui sépare une personnalisation réelle d'un publipostage :
 * le libellé est réutilisé tel quel dans le message.
 */
export const leadSignals = pgTable(
  "lead_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    weight: integer("weight").notNull().default(0),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("lead_signals_lead_idx").on(t.leadId),
    uniqueIndex("lead_signals_lead_kind_key").on(t.leadId, t.kind),
  ],
);

/* ------------------------------------------------------------------ */
/* Séquences                                                           */
/* ------------------------------------------------------------------ */

export const sequences = pgTable(
  "sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Identifiant stable de la séquence dans le code : `email` pour la
     * séquence par défaut, `phone` pour celle des leads sans adresse.
     * Nul pour une séquence créée à la main — c'est pour ça que la
     * colonne est nullable, et unique seulement sur les valeurs posées.
     */
    key: text("key"),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sequences_key_key").on(t.key)],
);

export const sequenceSteps = pgTable(
  "sequence_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => sequences.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    channel: channel("channel").notNull(),
    /** Délai depuis l'étape précédente. */
    delayHours: integer("delay_hours").notNull().default(72),
    /** Gabarit structurel : first_touch, follow_up, break_up. */
    templateKey: text("template_key").notNull().default("first_touch"),
    /** Intention de l'étape, passée au modèle avec le gabarit. */
    brief: text("brief").notNull(),
  },
  (t) => [uniqueIndex("sequence_steps_position_key").on(t.sequenceId, t.position)],
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => sequences.id, { onDelete: "restrict" }),
    status: enrollmentStatus("status").notNull().default("active"),
    currentPosition: integer("current_position").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("enrollments_lead_sequence_key").on(t.leadId, t.sequenceId),
    index("enrollments_status_idx").on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Tâches — la file de travail                                         */
/* ------------------------------------------------------------------ */

/**
 * Une tâche = une action à faire pour un lead, à une date.
 *
 * C'est l'écran d'accueil de l'outil. Le message est rédigé
 * automatiquement ; l'envoi reste un geste humain, quel que soit le
 * canal. `dueAt` pilote l'apparition dans la file du jour.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id").references(() => enrollments.id, {
      onDelete: "set null",
    }),
    channel: channel("channel").notNull(),
    status: taskStatus("status").notNull().default("pending"),
    stepPosition: integer("step_position"),
    templateKey: text("template_key"),
    brief: text("brief"),

    subject: text("subject"),
    body: text("body"),
    /** Motif du rejet quand la rédaction échoue. */
    error: text("error"),

    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tasks_due_idx").on(t.status, t.dueAt),
    index("tasks_lead_idx").on(t.leadId),
  ],
);

/* ------------------------------------------------------------------ */
/* Conversation                                                        */
/* ------------------------------------------------------------------ */

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    status: conversationStatus("status").notNull().default("open"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("conversations_lead_key").on(t.leadId),
    index("conversations_status_idx").on(t.status),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRole("role").notNull(),
    channel: channel("channel").notNull().default("email"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Rendez-vous                                                         */
/* ------------------------------------------------------------------ */

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  attended: boolean("attended"),
  amount: integer("amount"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Liste d'exclusion — jamais purgée                                   */
/* ------------------------------------------------------------------ */

/**
 * `value` est un email exact, ou un domaine (`@exemple.fr`) pour exclure
 * une société entière. Cette table est la preuve qu'une opposition a été
 * respectée : elle n'est jamais purgée, contrairement aux leads.
 */
export const suppressions = pgTable(
  "suppressions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    value: text("value").notNull(),
    reason: suppressionReason("reason").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("suppressions_value_key").on(t.value)],
);

/* ------------------------------------------------------------------ */
/* Journal des appels modèle                                           */
/* ------------------------------------------------------------------ */

/**
 * Trace de chaque appel : coût, latence, et le motif de rejet quand le
 * contrôle de style ou les garde-fous ont refusé un brouillon. C'est là
 * qu'il faut regarder quand la rédaction se dégrade.
 */
export const aiRuns = pgTable(
  "ai_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    kind: text("kind").notNull(), // draft | reply
    model: text("model").notNull(),
    attempts: integer("attempts").notNull().default(1),
    rejections: jsonb("rejections").$type<string[]>(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cachedTokens: integer("cached_tokens"),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_runs_created_idx").on(t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Mémoire des requêtes de sourcing proposées                          */
/* ------------------------------------------------------------------ */

/**
 * Ce qui a déjà été proposé, pour ne jamais le reproposer.
 *
 * Une requête écartée porte autant d'information qu'une requête retenue :
 * elle dit « ce métier ou cette zone ne m'intéressent pas ». La garder
 * coûte une ligne et évite au modèle de resservir la même idée à chaque
 * appel. L'unicité est posée sur `lower(query)` : « Restaurant Toulouse »
 * et « restaurant toulouse » sont la même requête pour Google.
 */
export const querySuggestions = pgTable(
  "query_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    query: text("query").notNull(),
    /** Pourquoi le modèle la propose. Affiché sous la suggestion. */
    rationale: text("rationale"),
    status: suggestionStatus("status").notNull().default("proposed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("query_suggestions_query_key").on(sql`lower(${t.query})`),
    index("query_suggestions_status_idx").on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Réglages — ligne unique                                             */
/* ------------------------------------------------------------------ */

/**
 * Tout ce qui change sans redéployer : ton offre, ton identité
 * d'expéditeur, le modèle, les seuils. `id` est contraint à 1.
 */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),

  senderFirstName: text("sender_first_name").notNull().default(""),
  /** Mentions légales obligatoires en prospection B2B. */
  senderIdentity: text("sender_identity").notNull().default(""),
  bookingUrl: text("booking_url").notNull().default(""),

  /** Ce que tu vends, en une phrase. Injecté dans chaque rédaction. */
  offer: text("offer").notNull().default(""),
  /** Les problèmes concrets que tu résous. */
  painPoints: text("pain_points").notNull().default(""),

  draftModel: text("draft_model").notNull().default("claude-opus-5"),
  draftEffort: text("draft_effort").notNull().default("low"),

  minEnrollScore: integer("min_enroll_score").notNull().default(40),
  enrollBatch: integer("enroll_batch").notNull().default(20),
  dailyTaskCap: integer("daily_task_cap").notNull().default(20),

  placesQueries: text("places_queries").notNull().default(""),
  sourcingEnabled: boolean("sourcing_enabled").notNull().default(false),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Lead = typeof leads.$inferSelect;
export type LeadSignal = typeof leadSignals.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type SequenceStep = typeof sequenceSteps.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type QuerySuggestion = typeof querySuggestions.$inferSelect;
export type Message = typeof messages.$inferSelect;
