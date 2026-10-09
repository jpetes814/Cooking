import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { FALLBACK_ROLES, MODELS, type ModelRole } from "./models";

/**
 * The one way the app calls Claude. Every call:
 * - picks its model by role (lib/ai/models.ts),
 * - asks for JSON that must match a zod schema (structured outputs),
 * - opts into server-side fallbacks, so if a model declines, another answers,
 * - returns token usage so the app can log what it spent.
 *
 * Server only. Routes check the signed-in member (lib/ai/guard.ts) first.
 * Tests and local dev set AI_MOCK=1 and use lib/ai/mocks.ts instead.
 */

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface Usage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

export type AiResult<T> = { ok: true; data: T; usage: Usage } | { ok: false; status: number; error: string };

/** A picture for Claude to look at: bytes we already have, or an address it can fetch. */
export type AiImage =
  | { kind: "base64"; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string }
  | { kind: "url"; url: string };

export interface StructuredCall<S extends z.ZodType> {
  role: ModelRole;
  effort: Effort;
  /** Stable instructions. Cached, so keep anything that varies per request out of it. */
  system: string;
  prompt: string;
  /** Photos sent ahead of the prompt, in order. */
  images?: AiImage[];
  schema: S;
  maxTokens?: number;
}

let client: Anthropic | null = null;

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) || process.env.AI_MOCK === "1";
}

export async function runStructured<S extends z.ZodType>(call: StructuredCall<S>): Promise<AiResult<z.infer<S>>> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, status: 503, error: "The AI isn't set up on the server yet (ANTHROPIC_API_KEY)." };
  }
  client ??= new Anthropic();
  const fallback = FALLBACK_ROLES.has(call.role);

  try {
    const response = await client.beta.messages.parse({
      model: MODELS[call.role],
      max_tokens: call.maxTokens ?? 16000,
      system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userContent(call) }],
      output_config: { effort: call.effort, format: betaZodOutputFormat(call.schema) },
      ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, status: 422, error: "Claude couldn't help with that one. Try rewording it." };
    }
    if (response.stop_reason === "max_tokens") {
      return { ok: false, status: 502, error: "The answer ran too long. Try a shorter recipe." };
    }
    if (!response.parsed_output) {
      return { ok: false, status: 502, error: "Claude's answer came back in the wrong shape. Try again." };
    }
    return {
      ok: true,
      data: response.parsed_output as z.infer<S>,
      usage: {
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      },
    };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, status: 429, error: "Too many requests right now. Give it a minute." };
    }
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, status: 503, error: "The server's Claude key isn't working. Check ANTHROPIC_API_KEY." };
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API error", err.status, err.message);
      return { ok: false, status: 502, error: "Claude had a problem. Try again in a moment." };
    }
    console.error("Claude call failed", err);
    return { ok: false, status: 502, error: "Couldn't reach Claude. Try again in a moment." };
  }
}

function userContent(call: { prompt: string; images?: AiImage[] }) {
  if (!call.images?.length) return call.prompt;
  return [
    ...call.images.map((img) => ({
      type: "image" as const,
      source:
        img.kind === "base64"
          ? { type: "base64" as const, media_type: img.mediaType, data: img.data }
          : { type: "url" as const, url: img.url },
    })),
    { type: "text" as const, text: call.prompt },
  ];
}

export interface WebSearchCall<S extends z.ZodType> {
  role: ModelRole;
  effort: Effort;
  system: string;
  prompt: string;
  /** Claude hands its answer to this tool; its input must match the schema. */
  answerTool: { name: string; description: string };
  schema: S;
  /** How many searches Claude may run. */
  maxSearches: number;
  maxTokens?: number;
}

export type WebSearchResult<T> =
  | { ok: true; data: T; usage: Usage; /** Every address the searches returned, to check answers against. */ seen: string[] }
  | { ok: false; status: number; error: string };

const MAX_CONTINUES = 4;

/**
 * Claude searches the web, then hands back a structured answer through a
 * strict tool (structured outputs can't be used alongside search citations).
 * Long searches can pause; this picks them back up a few times.
 */
export async function runWebSearch<S extends z.ZodType>(call: WebSearchCall<S>): Promise<WebSearchResult<z.infer<S>>> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, status: 503, error: "The AI isn't set up on the server yet (ANTHROPIC_API_KEY)." };
  }
  client ??= new Anthropic();
  const fallback = FALLBACK_ROLES.has(call.role);
  const inputSchema = z.toJSONSchema(call.schema) as Record<string, unknown>;
  delete inputSchema.$schema;
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: call.prompt }];
  const seen = new Set<string>();
  const usages: Usage[] = [];

  try {
    for (let i = 0; i <= MAX_CONTINUES; i++) {
      const response = await client.beta.messages.create({
        model: MODELS[call.role],
        max_tokens: call.maxTokens ?? 16000,
        system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
        messages,
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: call.maxSearches },
          {
            name: call.answerTool.name,
            description: call.answerTool.description,
            input_schema: inputSchema as Anthropic.Beta.BetaTool.InputSchema,
            strict: true,
          },
        ],
        output_config: { effort: call.effort },
        ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
      usages.push({
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      });

      for (const block of response.content) {
        // An error comes back as an object; results come back as a list.
        if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
          for (const r of block.content) seen.add(r.url);
        }
      }

      if (response.stop_reason === "refusal") {
        return { ok: false, status: 422, error: "Claude couldn't help with that one. Try different ingredients." };
      }
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      const answer = response.content.find(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === call.answerTool.name
      );
      if (!answer) {
        if (response.stop_reason === "max_tokens") {
          return { ok: false, status: 502, error: "The search ran too long. Try fewer ingredients." };
        }
        return { ok: false, status: 502, error: "Claude didn't come back with any recipes. Try again." };
      }
      const parsed = call.schema.safeParse(answer.input);
      if (!parsed.success) {
        return { ok: false, status: 502, error: "Claude's answer came back in the wrong shape. Try again." };
      }
      return { ok: true, data: parsed.data, usage: addUsage(usages), seen: [...seen] };
    }
    return { ok: false, status: 504, error: "The search took too long. Try again in a moment." };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, status: 429, error: "Too many requests right now. Give it a minute." };
    }
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, status: 503, error: "The server's Claude key isn't working. Check ANTHROPIC_API_KEY." };
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API error", err.status, err.message);
      return { ok: false, status: 502, error: "Claude had a problem. Try again in a moment." };
    }
    console.error("Claude web search failed", err);
    return { ok: false, status: 502, error: "Couldn't reach Claude. Try again in a moment." };
  }
}

/** Sum usage across several calls. */
export function addUsage(list: Usage[]): Usage {
  return list.reduce(
    (acc, u) => ({
      model: acc.model || u.model,
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
      cacheReadTokens: acc.cacheReadTokens + u.cacheReadTokens,
    }),
    { model: "", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 }
  );
}
