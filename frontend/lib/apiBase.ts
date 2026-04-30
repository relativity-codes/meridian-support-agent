/**
 * API origin for fetch(). Empty string = same origin (static UI served by FastAPI on :8000).
 * For `next dev` on :3000, set NEXT_PUBLIC_API_URL to your API (e.g. http://127.0.0.1:8000).
 *
 * In the browser, if NEXT_PUBLIC_API_URL only differs from the page by `localhost` vs
 * `127.0.0.1` on the same port, we force same-origin (empty base) so the httpOnly session
 * cookie set at login is sent on `/auth/me` and other API calls.
 */

function effectivePort(u: URL): string {
  if (u.port) return u.port;
  return u.protocol === "https:" ? "443" : "80";
}

function isLoopbackAliasPair(a: string, b: string): boolean {
  const hosts = new Set([a.toLowerCase(), b.toLowerCase()]);
  return hosts.has("localhost") && hosts.has("127.0.0.1");
}

export function getApiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  if (!raw || typeof window === "undefined") {
    return raw;
  }
  try {
    const page = new URL(window.location.origin);
    const configured = new URL(raw);
    if (configured.origin === page.origin) {
      return "";
    }
    if (
      configured.protocol === page.protocol &&
      effectivePort(configured) === effectivePort(page) &&
      isLoopbackAliasPair(configured.hostname, page.hostname)
    ) {
      return "";
    }
    return raw;
  } catch {
    return raw;
  }
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
