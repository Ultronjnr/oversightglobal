// Only allow outbound email links that point at this app's own domains.
const ALLOWED_HOSTS = ["ovasyt.tech", "www.ovasyt.tech", "oversight.global", "www.oversight.global", "oversightglobal.lovable.app"];

export function isAllowedAppLink(raw: string, requiredPath: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  const hostOk = ALLOWED_HOSTS.includes(h) || h.endsWith(".lovable.app") || h.endsWith(".lovableproject.com");
  return hostOk && u.pathname === requiredPath && !u.username && !u.password;
}
