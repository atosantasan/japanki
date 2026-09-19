export function shouldBypassServiceWorkerCache(url: URL): boolean {
  const host = url.hostname.toLowerCase();

  if (host === "supabase.co" || host.endsWith(".supabase.co")) {
    return true;
  }

  if (host === "stripe.com" || host.endsWith(".stripe.com")) {
    return true;
  }

  if (host === "accounts.google.com" || host === "oauth2.googleapis.com") {
    return true;
  }

  if (url.pathname.startsWith("/auth/") || url.pathname.startsWith("/api/")) {
    return true;
  }

  return false;
}
