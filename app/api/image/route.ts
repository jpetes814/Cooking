import { z } from "zod";
import { requireMember } from "@/lib/ai/guard";
import { mockSources } from "@/lib/ai/mocks";
import { liveSources } from "@/lib/import/sources";
import { MAX_URL } from "@/lib/model/recipe";

export const maxDuration = 30;

const Body = z.object({ url: z.string().url().max(MAX_URL) });

/**
 * Fetches a recipe page's dish photo for the phone, which can't read other
 * sites' pictures itself. Hands the picture back; never stores it.
 */
export async function POST(req: Request) {
  const gate = await requireMember(req);
  if (!gate.ok) return gate.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That isn't a picture address." }, { status: 400 });

  const sources = process.env.AI_MOCK === "1" ? mockSources : liveSources;
  const res = await sources.image(parsed.data.url);
  if (!res.ok) return Response.json({ error: res.error }, { status: 422 });
  return new Response(res.bytes as BodyInit, {
    headers: { "content-type": res.type, "cache-control": "private, no-store" },
  });
}
