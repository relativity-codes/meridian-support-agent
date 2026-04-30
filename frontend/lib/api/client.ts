import type { ApiResult } from "@/lib/api/types";
import { getApiBaseUrl } from "@/lib/apiBase";

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const base = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include",
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Error ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText) as { detail?: unknown; message?: string };
        const d = errorJson.detail;
        errorMessage =
          typeof d === "string" ? d : typeof errorJson.message === "string" ? errorJson.message : errorMessage;
        if (typeof errorMessage === "object" && errorMessage !== null) {
          errorMessage = JSON.stringify(errorMessage);
        }
      } catch {
        /* use status message */
      }
      return { success: false, error: errorMessage };
    }

    const data = (await response.json()) as T;
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}
