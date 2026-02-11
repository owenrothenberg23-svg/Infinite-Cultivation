// proxy.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// In proxy mode, this file is the entrypoint. Do NOT also have middleware.ts.

const BETA_GATE_ON = process.env.BETA_GATE === "true";
const OWNER_EMAIL = (process.env.BETA_OWNER_EMAIL || "").trim().toLowerCase();

function isAsset(pathname: string) {
  // Anything with a file extension should be treated as public
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

function isPublicPath(pathname: string) {
  // Home + auth pages
  if (pathname === "/") return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;

  // Beta page must be public (both /beta and /beta/ and nested)
  if (pathname === "/beta" || pathname.startsWith("/beta/")) return true;

  // Next internals + assets
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (isAsset(pathname)) return true;

  return false;
}

export default async function middleware(req: NextRequest) {
  try {
    const { pathname, search } = req.nextUrl;

    // Allow Stripe webhook publicly (Stripe cannot be gated)
    if (pathname === "/api/stripe/webhook") {
      return NextResponse.next();
    }

    // If beta gate is off OR path is public: pass through WITHOUT touching auth.
    // (Avoids cookie refresh + redirect normalization loops in production.)
    if (!BETA_GATE_ON || isPublicPath(pathname)) {
      return NextResponse.next();
    }

    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Fail open if env missing (don’t brick the site)
    if (!supaUrl || !anon) return NextResponse.next();

    // Create a response we can attach cookies to
    const res = NextResponse.next({ request: { headers: req.headers } });

    // Create Supabase server client with cookie passthrough + ability to set cookies
    const supabase = createServerClient(supaUrl, anon, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            res.cookies.set(name, value, options);
          }
        },
      },
    });

    // Get user (may refresh cookies)
    const { data } = await supabase.auth.getUser();
    const user = data?.user ?? null;

    // Not logged in => redirect to login
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

    // Logged in but not allowlisted => send to /beta (no query)
    const u = req.nextUrl.clone();
    u.pathname = "/beta";
    u.search = "";
    return NextResponse.redirect(u);
  } catch (e) {
    console.error("proxy fatal:", e);
    return NextResponse.next(); // fail open
  }
}

// Keep matcher broad but exclude Next internals
export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
