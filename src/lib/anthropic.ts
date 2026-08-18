import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY manquant");
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * `effort` n'existe pas sur la génération Haiku 4.5 : l'envoyer renvoie
 * une 400. On le conditionne au modèle plutôt que de le supposer.
 */
function supportsEffort(model: string): boolean {
  return !model.startsWith("claude-haiku");
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

export interface StructuredResult<T> {
  data: T;
  usage: Usage;
}

export interface StructuredOptions {
  model: string;
  /** Stable d'un lead à l'autre : c'est lui qu'on met en cache. */
  system: string;
  prompt: string;
  /** JSON Schema — objets fermés uniquement (`additionalProperties: false`). */
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

/**
 * Un appel, une sortie JSON validée par le serveur.
 *
 * Deux choses méritent l'attention ici :
 *
 * - `output_config.format` contraint la réponse au schéma côté serveur.
 *   Plus de `JSON.parse` sur une réponse bavarde, plus de boucle de
 *   réessai sur erreur de parsing.
 * - Le prompt système porte `cache_control` : il est identique d'un lead
 *   à l'autre, donc facturé un dixième du tarif d'entrée dès le deuxième
 *   appel. Le minimum cacheable est de 512 tokens sur Opus 5 — un prompt
 *   plus court ne déclenche simplement pas de cache, sans erreur.
 */
export async function completeStructured<T>({
  model,
  system,
  prompt,
  schema,
  effort = "low",
  maxTokens = 4000,
}: StructuredOptions): Promise<StructuredResult<T>> {
  const response = await getClient().messages.create({
    model,
    max_tokens: maxTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    output_config: {
      ...(supportsEffort(model) ? { effort } : {}),
      format: { type: "json_schema", schema },
    },
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Le modèle a refusé de répondre.");
  }

  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") {
    throw new Error(`Réponse sans texte (stop_reason: ${response.stop_reason}).`);
  }

  return {
    data: JSON.parse(text.text) as T,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cachedTokens: response.usage.cache_read_input_tokens ?? 0,
    },
  };
}

/** Message lisible pour l'IHM, à partir d'une erreur SDK typée. */
export function describeError(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError) {
    return "Limite de débit atteinte. Réessaie dans une minute.";
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return "Clé ANTHROPIC_API_KEY invalide ou absente.";
  }
  if (error instanceof Anthropic.NotFoundError) {
    return "Modèle introuvable — vérifie l'identifiant dans les réglages.";
  }
  // APIConnectionError dérive d'APIError : le tester en premier, sinon la
  // branche générique l'attrape et le message perd sa précision.
  if (error instanceof Anthropic.APIConnectionError) {
    return "Connexion à l'API impossible.";
  }
  if (error instanceof Anthropic.APIError) {
    return `Erreur API ${error.status ?? ""} : ${error.message}`.trim();
  }
  return error instanceof Error ? error.message : String(error);
}
