import { z } from "zod";
import { MAX_HAVE, MAX_HAVE_LENGTH } from "@/lib/suggest/have";
import { publicHttpUrl } from "./safe-url";

/**
 * "Find new ones": Claude searches the web for recipes that use what you have.
 * What it sends back is only a list of links to look at; saving one goes
 * through Fill from link and the review, like any other link.
 */

export const MAX_FOUND = 5;

export const FindRequest = z.object({
  have: z.array(z.string().trim().min(1).max(MAX_HAVE_LENGTH)).min(1, "Add something you have first.").max(MAX_HAVE),
  /** Names of recipes already saved, so it doesn't suggest them again. */
  saved: z.array(z.string().max(120)).max(200).default([]),
});
export type FindRequest = z.infer<typeof FindRequest>;

export const FoundSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string().describe("The recipe's name as the page gives it"),
      url: z.string().describe("The recipe page's address, exactly as it appeared in the search results"),
      uses: z.array(z.string()).describe("Which of the person's items it uses, in their words"),
      why: z.string().describe("One short, plain sentence on why it fits"),
    })
  ),
});
export type Found = z.infer<typeof FoundSchema>;

export interface FoundIdea {
  title: string;
  url: string;
  site: string;
  uses: string[];
  why: string;
}

/** Same page either way: no #fragment, no trailing slash, host in lowercase. */
export function sameUrlKey(raw: string): string | null {
  const url = publicHttpUrl(raw);
  if (!url) return null;
  return `${url.hostname.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}${url.search}`;
}

/**
 * Keeps only real, public links that the search actually returned (so a
 * made-up address never reaches the phone), without repeats, at most five.
 */
export function keepRealLinks(found: Found, seen: readonly string[], have: readonly string[]): FoundIdea[] {
  const seenKeys = new Set(seen.map(sameUrlKey).filter((k): k is string => k !== null));
  const haveSet = new Set(have.map((h) => h.toLowerCase()));
  const out: FoundIdea[] = [];
  const kept = new Set<string>();
  for (const idea of found.ideas) {
    const key = sameUrlKey(idea.url);
    const url = publicHttpUrl(idea.url);
    if (!key || !url || !seenKeys.has(key) || kept.has(key)) continue;
    const title = idea.title.trim().slice(0, 120);
    if (!title) continue;
    kept.add(key);
    out.push({
      title,
      url: url.toString(),
      site: url.hostname.replace(/^www\./, ""),
      uses: idea.uses.map((u) => u.toLowerCase().trim()).filter((u) => haveSet.has(u)),
      why: idea.why.trim().slice(0, 200),
    });
    if (out.length >= MAX_FOUND) break;
  }
  return out;
}
