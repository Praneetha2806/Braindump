import type { Link } from "./db.ts";

function meta(html: string, key: string): string | null {
  // Matches <meta property="og:title" content="..."> in either attribute order.
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i").exec(html);
  const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i").exec(html);
  return decode((a ?? b)?.[1]?.trim() || null);
}

function decode(s: string | null) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

export async function fetchPreview(url: string): Promise<Omit<Link, "id">> {
  const fallback = { url, title: null, description: null, image: null, site_name: new URL(url).hostname.replace(/^www\./, "") };
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; BrainDumpBot/0.1)", accept: "text/html,*/*" },
    });
    const type = res.headers.get("content-type") ?? "";
    if (type.startsWith("image/")) return { ...fallback, image: url };
    if (!type.includes("html")) return fallback;
    const html = (await res.text()).slice(0, 300_000);
    const title = meta(html, "og:title") ?? decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || null);
    let image = meta(html, "og:image") ?? meta(html, "twitter:image");
    if (image) image = new URL(image, res.url).toString();
    return {
      url,
      title,
      description: meta(html, "og:description") ?? meta(html, "description"),
      image,
      site_name: meta(html, "og:site_name") ?? fallback.site_name,
    };
  } catch {
    return fallback;
  }
}
