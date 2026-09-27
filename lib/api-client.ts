async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/auth") && !window.location.pathname.startsWith("/join")) {
    // The session ended (signed out, expired, or belongs to a different database). Go to sign-in and come back here,
    // instead of leaving an unhandled "Not signed in" error on screen. The promise stays pending, so no error is thrown.
    window.location.assign(`/auth/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    return new Promise<T>(() => {});
  }
  if (!res.ok) throw new Error(body.error || `Request to ${url} failed`);
  return body as T;
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, data?: unknown) => request<T>(url, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(url: string, data?: unknown) => request<T>(url, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};

export function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Date(iso).toLocaleDateString("en-IN", opts);
}
