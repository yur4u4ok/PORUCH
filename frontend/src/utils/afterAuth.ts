/**
 * Where to return after sign-up/sign-in: the action a guest picked («ask for help», «requests
 * nearby») or a shared request they opened while logged out.
 *
 * Kept in localStorage, not sessionStorage: the email confirmation link opens in a new tab, and
 * the choice must survive that. It expires after a day so an old choice doesn't hijack a later visit.
 */
const KEY = "poruch.afterAuth";
const TTL_MS = 24 * 60 * 60 * 1000;

function isLocal(path: string | null | undefined): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}

function read(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw) as { path?: string; at?: number };
    if (!isLocal(path) || typeof at !== "number" || Date.now() - at > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

export function rememberAfterAuth(path: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    /* storage unavailable: the guest lands on the home screen instead */
  }
}

export function consumeAfterAuth(fallback = "/"): string {
  const path = read();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return path ?? fallback;
}

export function peekAfterAuth(): string | null {
  return read();
}
