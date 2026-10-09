import { requireMember } from "@/lib/ai/guard";
import { runWebSearch } from "@/lib/ai/claude";
import { mockFind } from "@/lib/ai/mocks";
import { FIND_SYSTEM, findPrompt } from "@/lib/ai/prompts/find";
import { FindRequest, FoundSchema, keepRealLinks } from "@/lib/import/find";

export const maxDuration = 120;

/** Searches the web for recipes that use what you have. Returns links only; never saves anything. */
export async function POST(req: Request) {
  const gate = await requireMember(req);
  if (!gate.ok) return gate.response;

  const parsed = FindRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Add something you have first." }, { status: 400 });
  }

  const res =
    process.env.AI_MOCK === "1"
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
  return Response.json({ ideas });
}
