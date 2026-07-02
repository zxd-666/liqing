export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

const SEARCH_URL = "https://duckduckgo.com/html/";
const SEARCH_TIMEOUT_MS = 10_000;

export async function searchWeb(query: string, signal?: AbortSignal): Promise<WebSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const res = await fetchWithTimeout(`${SEARCH_URL}?${params.toString()}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 AppleWebKit/537.36 Chrome/126 Safari/537.36",
      Accept: "text/html"
    }
  }, signal, SEARCH_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error(`联网搜索失败：HTTP ${res.status}`);
  }
  return parseDuckDuckGoHtml(await res.text()).slice(0, 5);
}

export function formatSearchContext(results: WebSearchResult[]) {
  if (results.length === 0) {
    return "联网搜索未找到可用结果。不要编造事实；只能给出思考框架和需要核验的问题。";
  }
  return [
    `联网搜索结果，搜索时间：${new Date().toISOString()}`,
    ...results.map((item, index) => [
      `${index + 1}. ${item.title}`,
      `摘要：${item.snippet || "无摘要"}`,
      `来源：${item.url}`
    ].join("\n"))
  ].join("\n\n");
}

function parseDuckDuckGoHtml(html: string): WebSearchResult[] {
  const blocks = html.match(/<div class="result[\s\S]*?<\/div>\s*<\/div>/g) ?? [];
  const results: WebSearchResult[] = [];
  for (const block of blocks) {
    const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!titleMatch) continue;
    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)
      ?? block.match(/<div[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/div>/);
    const title = cleanHtml(titleMatch[2]);
    const url = normalizeDuckDuckGoUrl(decodeHtml(titleMatch[1]));
    const snippet = cleanHtml(snippetMatch?.[1] ?? "");
    if (title && url && !results.some((item) => item.url === url)) {
      results.push({ title, url, snippet });
    }
  }
  return results;
}

function normalizeDuckDuckGoUrl(value: string) {
  try {
    const url = new URL(value, "https://duckduckgo.com");
    const redirected = url.searchParams.get("uddg");
    return redirected ? decodeURIComponent(redirected) : url.href;
  } catch {
    return value;
  }
}

function cleanHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number.parseInt(num, 10)));
}

async function fetchWithTimeout(url: string, init: RequestInit, parentSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abort = () => controller.abort();
  parentSignal?.addEventListener("abort", abort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (timedOut) throw new Error("联网搜索超时，请稍后重试");
    throw err;
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abort);
  }
}
