/** Wikipedia's REST summary API - fully free, no key, just a compliant
 * User-Agent per https://meta.wikimedia.org/wiki/User-Agent_policy. Gives a
 * short extract + thumbnail image for a place, which covers "past
 * details"/background for the Browse tab's place detail page without any
 * paid API. */

const USER_AGENT = "toure-app/1.0 (https://github.com; contact via app owner)";

export interface WikiSummary {
  title: string;
  extract: string;
  imageUrl?: string;
  pageUrl?: string;
}

async function fetchSummary(title: string): Promise<WikiSummary | null> {
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.type === "disambiguation") return null;
  return {
    title: data.title,
    extract: data.extract,
    imageUrl: data.thumbnail?.source,
    pageUrl: data.content_urls?.desktop?.page,
  };
}

async function searchTitle(query: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    format: "json",
    origin: "*",
    srlimit: "1",
  });
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.query?.search?.[0]?.title ?? null;
}

/** Tries an exact-title summary first (fast path for well-known place
 * names), falls back to a search when the exact title doesn't exist. */
export async function getPlaceSummary(name: string): Promise<WikiSummary | null> {
  const direct = await fetchSummary(name.replace(/ /g, "_"));
  if (direct) return direct;

  const found = await searchTitle(name);
  if (!found) return null;
  return fetchSummary(found.replace(/ /g, "_"));
}
