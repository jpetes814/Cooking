import { z } from "zod";
import { requireMember } from "@/lib/ai/guard";
import { runStructured } from "@/lib/ai/claude";
import { mockExtract, mockSources } from "@/lib/ai/mocks";
import { ExtractedRecipeSchema, IMPORT_SYSTEM, importPrompt } from "@/lib/ai/prompts/import";
import { importRecipe, type Extract } from "@/lib/import/run";
import { liveSources } from "@/lib/import/sources";
import { MAX_URL } from "@/lib/model/recipe";

export const maxDuration = 60;

const Body = z.object({ url: z.string().min(1).max(MAX_URL) });

/** Reads a pasted link and returns a recipe draft for the editor. Never saves anything. */
export async function POST(req: Request) {
  const gate = await requireMember(req);
  if (!gate.ok) return gate.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Paste a link first." }, { status: 400 });

  const mock = process.env.AI_MOCK === "1";
  const extract: Extract = mock
    ? async (_kind, text) => ({
        ok: true,
        data: mockExtract(text),
        usage: { model: "mock", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
      })
    : (kind, text) =>
        runStructured({
          role: "reader",
          effort: "low",
          system: IMPORT_SYSTEM,
          prompt: importPrompt(kind, text),
          schema: ExtractedRecipeSchema,
          maxTokens: 8000,
        });

  const result = await importRecipe(parsed.data.url, { sources: mock ? mockSources : liveSources, extract });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ draft: result.draft, via: result.via });
}
