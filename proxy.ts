// proxy.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const BETA_GATE_ON = process.env.BETA_GATE === "true";
const OWNER_EMAIL = (process.env.BETA_OWNER_EMAIL || "").trim().toLowerCase();

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/beta")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/api/")) return true; // never gate APIs here
  return false;
}

export async function proxy(req: NextRequest) {
  try {
    // If env vars are missing in prod, don't take the whole site down.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return NextResponse.next();

    let res = NextResponse.next({ request: { headers: req.headers } });

    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            res.cookies.set(name, value, options);
          }
        },
      },
    });

    // Refresh session (non-fatal)
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user ?? null;

    // Gate off? just return (keeping refresh behavior)
    if (!BETA_GATE_ON) return res;

    const { pathname, search } = req.nextUrl;

    if (isPublicPath(pathname)) return res;

    // Not logged in
    if (!user) {
      const u = req.nextUrl.clone();
      u.pathname = "/login";
      u.searchParams.set("next", pathname + (search || ""));
      return NextResponse.redirect(u);
    }

    const email = (user.email || "").trim().toLowerCase();

    // Owner bypass
    if (OWNER_EMAIL && email === OWNER_EMAIL) return res;

    // Allowlist check
    const { data: row, error } = await supabase
      .from("beta_allowlist")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (!error && row?.email) return res;

    // Logged in but not allowlisted
    const u = req.nextUrl.clone();
    u.pathname = "/beta";
    u.search = "";
    return NextResponse.redirect(u);
  } catch (e) {
    // If proxy fails, do NOT hard-brick the site.
    console.error("proxy fatal:", e);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
