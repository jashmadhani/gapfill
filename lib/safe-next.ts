/** Where to go after signing in: only same-site paths, so a crafted link can't send someone to another site. */
export function safeNext(value: string | null | undefined, fallback = "/discover") {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : fallback;
}
