/** Where to return after sign-up/sign-in (e.g. a shared request opened while logged out). */
const KEY = "poruch.afterAuth";

export function rememberAfterAuth(path: string): void {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    /* storage unavailable */
  }
}

export function consumeAfterAuth(fallback = "/"): string {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return path && path.startsWith("/") && !path.startsWith("//") ? path : fallback;
  } catch {
    return fallback;
  }
}

export function peekAfterAuth(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
