import { requireMember } from "@/lib/ai/guard";
import { runWebSearch } from "@/lib/ai/claude";
import { mockFind, mockSources } from "@/lib/ai/mocks";
import { FIND_SYSTEM, findPrompt } from "@/lib/ai/prompts/find";
import { FindRequest, FoundSchema, keepRealLinks, type FoundIdea } from "@/lib/import/find";
import { liveSources, type Sources } from "@/lib/import/sources";

export const maxDuration = 120;

const PICTURE_WAIT_MS = 8_000;

/** Looks up each page's dish picture at the same time. Slow or broken pages just go without. */
async function withPictures(ideas: FoundIdea[], sources: Sources): Promise<FoundIdea[]> {
  const picture = async (url: string): Promise<string | null> => {
    const page = await sources.page(url);
    return page.ok ? (page.image ?? null) : null;
  };
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), PICTURE_WAIT_MS));
  const images = await Promise.all(ideas.map((i) => Promise.race([picture(i.url).catch(() => null), timeout])));
  return ideas.map((idea, i) => ({ ...idea, imageUrl: images[i] }));
}

/** Searches the web for recipes that use what you have. Returns links only; never saves anything. */
export async function POST(req: Request) {
  const gate = await requireMember(req);
  if (!gate.ok) return gate.response;

  const parsed = FindRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Add something you have first." }, { status: 400 });
  }

  const mock = process.env.AI_MOCK === "1";
  const res = mock
    ? { ok: true as const, data: mockFind(parsed.data.have).found, seen: mockFind(parsed.data.have).seen }
    : await runWebSearch({
        role: "finder",
        effort: "medium",
        system: FIND_SYSTEM,
        prompt: findPrompt(parsed.data),
        answerTool: { name: "share_recipes", description: "Share the recipes you found with the person." },
        schema: FoundSchema,
        maxSearches: 5,
      });
  if (!res.ok) return Response.json({ error: res.error }, { status: res.status });

  const ideas = keepRealLinks(res.data, res.seen, parsed.data.have);
  if (!ideas.length) {
    return Response.json({ error: "Couldn't find recipe pages for those. Try fewer or more common items." }, { status: 404 });
  }
  return Response.json({ ideas: await withPictures(ideas, mock ? mockSources : liveSources) });
}
