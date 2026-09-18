import type { ApiError } from "../types/index";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    try {
      const data = (await response.json()) as ApiError;
      if (data.detail) {
        errorMessage = data.detail;
      }
    } catch {
      // ignore non-json errors
    }
    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}
