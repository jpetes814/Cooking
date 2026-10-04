import { requireMember } from "@/lib/ai/guard";
import { runStructured, type AiImage } from "@/lib/ai/claude";
import { mockExtract } from "@/lib/ai/mocks";
import { ExtractedRecipeSchema, IMPORT_SYSTEM, photoPrompt } from "@/lib/ai/prompts/import";
import { isOwnPhotoUrl, ReadPhotosRequest } from "@/lib/import/photos";
import { draftFrom } from "@/lib/import/run";

export const maxDuration = 60;

const NOTHING_FOUND =
  "Couldn't find a recipe in that photo. Try a cookbook page, a recipe card, or a screenshot of the caption.";

/** Reads recipe photos into a draft for the editor. Never saves anything. */
export async function POST(req: Request) {
  const gate = await requireMember(req);
  if (!gate.ok) return gate.response;

  const parsed = ReadPhotosRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Those photos can't be read." }, { status: 400 });
  }
  const { images, urls, usedTags } = parsed.data;

  const mock = process.env.AI_MOCK === "1";
  // Uploaded photos must be this person's own (tests use local addresses, so skip there).
  if (!mock && !urls.every((u) => isOwnPhotoUrl(u, gate.member.uid))) {
    return Response.json({ error: "Those photos can't be read." }, { status: 400 });
  }

  const all: AiImage[] = [
    ...urls.map((url) => ({ kind: "url" as const, url })),
    ...images.map((i) => ({ kind: "base64" as const, mediaType: i.mediaType, data: i.data })),
  ];

  const res = mock
    ? {
        ok: true as const,
        data: mockExtract("garlic"),
        usage: { model: "mock", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
      }
    : await runStructured({
        role: "reader",
        effort: "low",
        system: IMPORT_SYSTEM,
        prompt: photoPrompt(all.length, usedTags),
        images: all,
        schema: ExtractedRecipeSchema,
        maxTokens: 8000,
      });

  const result = draftFrom(res, NOTHING_FOUND);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ draft: result.draft, via: result.via });
}
