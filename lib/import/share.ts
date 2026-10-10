import { parseLink } from "@/lib/model/recipe";

/**
 * Getting a link into the app without typing it: from the clipboard, from an
 * iPhone Shortcut (/?add=...), or from Android's share menu (/?url=&text=).
 * Shared text is often a caption with the link at the end, so the first web
 * address in it wins. Pure so it can be tested.
 */

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"']+/i;

/** The first usable web link in some text, tidied, or null. */
export function linkInText(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  const found = trimmed.match(URL_IN_TEXT)?.[0].replace(/[).,!?]+$/, "") ?? (/\s/.test(trimmed) ? null : trimmed);
  if (!found) return null;
  const link = parseLink(found);
  return link.ok ? link.url : null;
}

/** A link handed to the app in its address (?add=, or ?url= / ?text= from a share menu). */
export function sharedLink(search: string): string | null {
  const q = new URLSearchParams(search);
  return linkInText(q.get("add")) ?? linkInText(q.get("url")) ?? linkInText(q.get("text"));
}

/** The address without the share bits, so a reload doesn't start another recipe. */
export function withoutShare(href: string): string {
  const u = new URL(href);
  for (const k of ["add", "url", "text", "title"]) u.searchParams.delete(k);
  return `${u.pathname}${u.search}${u.hash}`;
}
