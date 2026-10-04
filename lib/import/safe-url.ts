/**
 * The server fetches pages people paste, so it must never be pointed at
 * something private (the server itself, a cloud metadata address, a home
 * router). Only plain public web addresses on the normal ports get through.
 */
export function publicHttpUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".")) return null;
  // Any IP address typed in directly: real recipe sites use names.
  if (/^[\d.]+$/.test(host) || host.startsWith("[") || host.includes(":")) return null;
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/.test(host)) return null;
  // Names that are really IPs in disguise (nip.io-style), e.g. 127-0-0-1.example.
  if (/(^|[.-])(127|10|0)[.-]\d+[.-]\d+[.-]\d+([.-]|$)/.test(host)) return null;
  return url;
}
