// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const BETA_GATE_ON = process.env.BETA_GATE === "true";
const OWNER_EMAIL = (process.env.BETA_OWNER_EMAIL || "").trim().toLowerCase();

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/login")) return true; // /login + /login/callback
  if (pathname.startsWith("/beta")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;

  // VERY IMPORTANT: don't redirect API routes in middleware
  if (pathname.startsWith("/api/")) return true;

  return false;
}

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } });

  // If gate is off, just keep your auth-cookie refresh behavior
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            res.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Keep session fresh (your original behavior)
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  if (!BETA_GATE_ON) return res;

  const { pathname, search } = req.nextUrl;

  // Public paths bypass beta gate
  if (isPublicPath(pathname)) return res;

  // If not logged in, send to login with "next"
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + (search || ""));
    return NextResponse.redirect(url);
  }

  const email = (user.email || "").trim().toLowerCase();

  // Owner bypass (optional)
  if (OWNER_EMAIL && email === OWNER_EMAIL) return res;

  // Allowlist check
  const { data: row, error } = await supabase
    .from("beta_allowlist")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (!error && row?.email) {
    return res; // allowed
  }

  // Logged in but not allowlisted => go to /beta
  const url = req.nextUrl.clone();
  url.pathname = "/beta";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
