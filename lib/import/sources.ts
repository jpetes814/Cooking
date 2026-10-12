import { metaDescription, pageImage, pageText, recipeFromHtml } from "./html";
import { publicHttpUrl } from "./safe-url";
import type { ImportDraft } from "./draft";

/**
 * Talking to the outside world: recipe pages, TikTok and YouTube previews.
 * Server only. Everything is time-boxed and size-capped, and redirects are
 * checked hop by hop so a public link can't bounce to a private address.
 */

const TIMEOUT_MS = 8000;
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 4;
// Some sites refuse requests that don't look like a browser.
const HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; RecipeBox/1.0; +https://github.com)",
  accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
};

export type Fetched = { ok: true; body: string; finalUrl: string } | { ok: false; error: string };

const MAX_IMAGE_BYTES = 6_000_000;

async function readBytes(res: Response, max: number): Promise<Uint8Array | null> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

async function readCapped(res: Response): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Follows redirects hop by hop, checking every address. Returns the final response. */
async function follow(raw: string, accept: string): Promise<{ ok: true; res: Response; url: URL } | { ok: false; error: string }> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = publicHttpUrl(current);
    if (!url) return { ok: false, error: "That link can't be opened from here." };
    let res: Response;
    try {
      res = await fetch(url, { headers: { ...HEADERS, accept }, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      return { ok: false, error: "Couldn't reach that site." };
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return { ok: false, error: "That site sent us nowhere." };
      current = new URL(next, url).toString();
      continue;
    }
    if (!res.ok) return { ok: false, error: `That site said no (${res.status}).` };
    return { ok: true, res, url };
  }
  return { ok: false, error: "That link redirects too many times." };
}

const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|avif)$/;

/** A picture from the web, size-capped and checked to really be an image. */
export async function fetchImage(raw: string): Promise<{ ok: true; bytes: Uint8Array; type: string } | { ok: false; error: string }> {
  const got = await follow(raw, "image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8");
  if (!got.ok) return got;
  const type = (got.res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!IMAGE_TYPES.test(type)) {
    await got.res.body?.cancel();
    return { ok: false, error: "That isn't a picture." };
  }
  const bytes = await readBytes(got.res, MAX_IMAGE_BYTES);
  if (!bytes) return { ok: false, error: "That picture is too big." };
  return { ok: true, bytes, type };
}

export async function fetchText(raw: string): Promise<Fetched> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = publicHttpUrl(current);
    if (!url) return { ok: false, error: "That link can't be opened from here." };
    let res: Response;
    try {
      res = await fetch(url, { headers: HEADERS, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      return { ok: false, error: "Couldn't reach that site. Check the link, or try again in a moment." };
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return { ok: false, error: "That site sent us nowhere." };
      current = new URL(next, url).toString();
      continue;
    }
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 403 || res.status === 401
            ? "That site doesn't let apps read its pages. Type it in, or try a screenshot later."
            : `That site said no (${res.status}).`,
      };
    }
    const body = await readCapped(res);
    if (body === null) return { ok: false, error: "That page is too big to read." };
    return { ok: true, body, finalUrl: url.toString() };
  }
  return { ok: false, error: "That link redirects too many times." };
}

export interface Sources {
  /** A recipe page: exact JSON-LD if it has it, otherwise its readable text. */
  page(url: string): Promise<{ ok: true; recipe: ImportDraft | null; text: string; image?: string | null } | { ok: false; error: string }>;
  /** A TikTok video's caption and creator. */
  tiktok(url: string): Promise<{ ok: true; caption: string; author: string; image?: string | null } | { ok: false; error: string }>;
  /** A YouTube video's title and, with a key, its description. */
  youtube(url: string): Promise<{ ok: true; title: string; description: string; image?: string | null } | { ok: false; error: string }>;
  /** A picture's bytes, for adding a dish photo to a recipe. */
  image(url: string): Promise<{ ok: true; bytes: Uint8Array; type: string } | { ok: false; error: string }>;
}

const str = (v: unknown) => (typeof v === "string" && v ? v : null);

async function oembed(endpoint: string): Promise<Record<string, unknown> | null> {
  const res = await fetchText(endpoint);
  if (!res.ok) return null;
  try {
    return JSON.parse(res.body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** The 11-character id from any common YouTube link shape. */
export function youtubeId(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.hostname === "youtu.be") return u.pathname.slice(1, 12) || null;
    const v = u.searchParams.get("v");
    if (v) return v.slice(0, 11);
    const m = u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export const liveSources: Sources = {
  async page(url) {
    const res = await fetchText(url);
    if (!res.ok) return res;
    const recipe = recipeFromHtml(res.body);
    const text = recipe ? "" : `${metaDescription(res.body)}\n${pageText(res.body)}`.trim();
    return { ok: true, recipe, text, image: pageImage(res.body, res.finalUrl) };
  },

  async tiktok(url) {
    const data = await oembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
    const caption = typeof data?.title === "string" ? data.title : "";
    if (!data) return { ok: false, error: "TikTok didn't share that video. It may be private or removed." };
    return { ok: true, caption, author: typeof data.author_name === "string" ? data.author_name : "", image: str(data.thumbnail_url) };
  },

  async youtube(url) {
    const data = await oembed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    if (!data) return { ok: false, error: "YouTube didn't share that video. It may be private or removed." };
    const title = typeof data.title === "string" ? data.title : "";
    let description = "";
    const key = process.env.YOUTUBE_API_KEY;
    const id = youtubeId(url);
    if (key && id) {
      const res = await fetchText(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${encodeURIComponent(key)}`
      );
      if (res.ok) {
        try {
          const json = JSON.parse(res.body) as { items?: { snippet?: { description?: string } }[] };
          description = json.items?.[0]?.snippet?.description ?? "";
        } catch {
          // No description is fine; the title still helps.
        }
      }
    }
    return { ok: true, title, description, image: str(data.thumbnail_url) };
  },

  image: fetchImage,
};
