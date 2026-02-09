// middleware.ts
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
  if (pathname.startsWith("/api/")) return true; // never gate API via middleware
  return false;
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname, search } = req.nextUrl;

  // Always allow public paths
  if (isPublicPath(pathname)) return res;

  // If env is missing, DO NOT crash the whole site
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    console.error("middleware: missing supabase env", {
      hasUrl: !!url,
      hasAnon: !!anon,
    });
    return res; // fail-open
  }

  try {
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

    // Refresh session
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user ?? null;

    // If beta gate is off, just return (still refreshed cookies)
    if (!BETA_GATE_ON) return res;

    // Not logged in -> go to login
    if (userErr || !user) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname + (search || ""));
      return NextResponse.redirect(url);
    }

    const email = (user.email || "").trim().toLowerCase();

    // Owner bypass
    if (OWNER_EMAIL && email === OWNER_EMAIL) return res;

    // Allowlist check (if this errors, fail-open instead of 500)
    const { data: row, error } = await supabase
      .from("beta_allowlist")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (!error && row?.email) return res;

    const url2 = req.nextUrl.clone();
    url2.pathname = "/beta";
    url2.search = "";
    return NextResponse.redirect(url2);
  } catch (e) {
    console.error("middleware fatal (fail-open):", e);
    return res; // fail-open prevents 500 site-wide
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
