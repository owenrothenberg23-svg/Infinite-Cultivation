// proxy.ts
import { createServerClient } from "@supabase/ssr";

const BETA_GATE_ON = process.env.BETA_GATE === "true";
const OWNER_EMAIL = (process.env.BETA_OWNER_EMAIL || "").trim().toLowerCase();

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/beta")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/api/")) return true;
  return false;
}

export async function proxy(req: Request) {
  try {
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Fail open if env missing
    if (!supaUrl || !anon) return fetch(req);

    const url = new URL(req.url);

    // Gate off or public paths => just forward
    if (!BETA_GATE_ON || isPublicPath(url.pathname)) return fetch(req);

    // Read cookies from header
    const cookieHeader = req.headers.get("cookie") || "";

    const supabase = createServerClient(supaUrl, anon, {
      cookies: {
        getAll: () => {
          return cookieHeader
            .split(";")
            .map((c) => c.trim())
            .filter(Boolean)
            .map((pair) => {
              const idx = pair.indexOf("=");
              const name = idx >= 0 ? pair.slice(0, idx) : pair;
              const value = idx >= 0 ? pair.slice(idx + 1) : "";
              return { name, value };
            });
        },
        setAll: () => {
          // NOTE: proxy doesn't automatically write Set-Cookie like middleware.
          // We'll skip refresh behavior here.
        },
      },
    });

    const { data } = await supabase.auth.getUser();
    const user = data?.user ?? null;

    if (!user) {
      const redirect = new URL("/login", url.origin);
      redirect.searchParams.set("next", url.pathname + url.search);
      return Response.redirect(redirect.toString(), 302);
    }

    const email = (user.email || "").trim().toLowerCase();
    if (OWNER_EMAIL && email === OWNER_EMAIL) return fetch(req);

    const { data: row } = await supabase
      .from("beta_allowlist")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (row?.email) return fetch(req);

    return Response.redirect(new URL("/beta", url.origin).toString(), 302);
  } catch (e) {
    console.error("proxy fatal:", e);
    return fetch(req); // fail open
  }
}
