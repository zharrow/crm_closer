-- Verrouillage PostgREST.
--
-- Supabase expose automatiquement chaque table du schéma `public` via son
-- API REST, accessible avec la clé anonyme — celle qui est publiée dans
-- le bundle JavaScript du navigateur. Sans RLS, n'importe qui pourrait
-- lire tout le pipeline commercial en lisant le code source de la page.
--
-- On active donc RLS sans définir la moindre policy : PostgREST se voit
-- alors refuser tout accès, en lecture comme en écriture. L'application
-- n'est pas gênée — elle passe par Drizzle sur la connexion Postgres
-- directe, qui appartient au propriétaire des tables et n'est pas
-- soumise à RLS.
--
-- Conséquence à connaître : la protection réelle des données de l'app,
-- c'est le middleware d'authentification et la liste ALLOWED_EMAILS.
-- RLS ne ferme ici que la porte PostgREST.

ALTER TABLE "leads"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_signals"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sequences"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sequence_steps"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollments"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppressions"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_runs"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings"        ENABLE ROW LEVEL SECURITY;

-- `settings` doit rester une ligne unique : la contrainte le garantit au
-- niveau du moteur plutôt que de compter sur le code applicatif.
ALTER TABLE "settings" ADD CONSTRAINT "settings_singleton" CHECK ("id" = 1);
