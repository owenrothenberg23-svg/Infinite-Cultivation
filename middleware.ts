import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/beta")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/api/")) return true; // never redirect APIs
  return false;
}

export async function middleware(req: NextRequest) {
  // ✅ Read env INSIDE middleware (runtime), not module scope
  const BETA_GATE_ON = process.env.BETA_GATE === "true";
  const OWNER_EMAIL = (process.env.BETA_OWNER_EMAIL || "").trim().toLowerCase();

  const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const SUPABASE_ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  // ✅ Critical: never crash the whole site if env is missing
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.next();
  }

  const { pathname, search } = req.nextUrl;

  // Public paths bypass
  if (isPublicPath(pathname)) return NextResponse.next();

  let res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          res.cookies.set(name, value, options);
        }
      },
    },
  });

  // Keep session fresh
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  // If gate is off, just keep refresh behavior
  if (!BETA_GATE_ON) return res;

  // If not logged in, send to login with "next"
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + (search || ""));
    return NextResponse.redirect(url);
  }

  const email = (user.email || "").trim().toLowerCase();

  // Owner bypass
  if (OWNER_EMAIL && email === OWNER_EMAIL) return res;

  // Allowlist check
  const { data: row } = await supabase
    .from("beta_allowlist")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (row?.email) return res;

  // Logged in but not allowlisted => go to /beta
  const url = req.nextUrl.clone();
  url.pathname = "/beta";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
