// proxy.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// In proxy mode, this file is the entrypoint.
// Do NOT also have middleware.ts.

const BETA_GATE_ON = process.env.BETA_GATE === "true";
const OWNER_EMAIL = (process.env.BETA_OWNER_EMAIL || "")
  .trim()
  .toLowerCase();

function isAsset(pathname: string) {
  // Anything with a file extension should be treated as public.
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

function isPublicPath(pathname: string) {
  /*
   * PUBLIC DISCOVERY PAGES
   *
   * These pages are intentionally browseable without an account.
   */

  // Home
  if (pathname === "/") return true;

  // Novel discovery
  if (
    pathname === "/library" ||
    pathname.startsWith("/library/")
  ) {
    return true;
  }

  if (
    pathname === "/rankings" ||
    pathname.startsWith("/rankings/")
  ) {
    return true;
  }

  // Public novel pages
  if (
    pathname === "/novel" ||
    pathname.startsWith("/novel/")
  ) {
    return true;
  }

  // Public community lists index
  if (
    pathname === "/lists" ||
    pathname.startsWith("/lists/")
  ) {
    return true;
  }

  // Individual public list pages
  if (
    pathname === "/list" ||
    pathname.startsWith("/list/")
  ) {
    return true;
  }

  // Public user/profile pages
  if (
    pathname === "/user" ||
    pathname.startsWith("/user/")
  ) {
    return true;
  }

  /*
   * AUTH / BETA PAGES
   */

  if (
    pathname === "/login" ||
    pathname.startsWith("/login/")
  ) {
    return true;
  }

  if (
    pathname === "/beta" ||
    pathname.startsWith("/beta/")
  ) {
    return true;
  }

  /*
   * NEXT INTERNALS / STATIC ASSETS
   */

  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (isAsset(pathname)) return true;

  return false;
}

export default async function middleware(req: NextRequest) {
  try {
    const { pathname, search } = req.nextUrl;

    /*
     * Stripe must always be able to reach its webhook.
     */
    if (pathname === "/api/stripe/webhook") {
      return NextResponse.next();
    }

    /*
     * Public pages bypass the beta/auth gate entirely.
     *
     * If the beta gate is disabled, everything passes through
     * and route/API-level auth remains responsible for protecting
     * mutations and private resources.
     */
    if (!BETA_GATE_ON || isPublicPath(pathname)) {
      return NextResponse.next();
    }

    const supaUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const anon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    /*
     * Fail open if environment configuration is missing.
     * Avoid accidentally bricking the entire site.
     */
    if (!supaUrl || !anon) {
      return NextResponse.next();
    }

    /*
     * Response used for refreshed Supabase auth cookies.
     */
    const res = NextResponse.next({
      request: {
        headers: req.headers,
      },
    });

    const supabase = createServerClient(
      supaUrl,
      anon,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),

          setAll: (cookiesToSet) => {
            for (const {
              name,
              value,
              options,
            } of cookiesToSet) {
              res.cookies.set(
                name,
                value,
                options
              );
            }
          },
        },
      }
    );

    /*
     * Resolve authenticated user.
     *
     * getUser() verifies the token rather than trusting
     * the session cookie alone.
     */
    const { data } =
      await supabase.auth.getUser();

    const user = data?.user ?? null;

    /*
     * Protected route + no authenticated user:
     * send to login and preserve intended destination.
     */
    if (!user) {
      const u = req.nextUrl.clone();

      u.pathname = "/login";

      u.searchParams.set(
        "next",
        pathname + (search || "")
      );

      return NextResponse.redirect(u);
    }

    const email = (user.email || "")
      .trim()
      .toLowerCase();

    /*
     * Beta owner bypass.
     */
    if (
      OWNER_EMAIL &&
      email === OWNER_EMAIL
    ) {
      return res;
    }

    /*
     * Beta allowlist.
     */
    const { data: row, error } =
      await supabase
        .from("beta_allowlist")
        .select("email")
        .eq("email", email)
        .maybeSingle();

    if (!error && row?.email) {
      return res;
    }

    /*
     * Authenticated but not approved for the private beta.
     */
    const u = req.nextUrl.clone();

    u.pathname = "/beta";
    u.search = "";

    return NextResponse.redirect(u);
  } catch (error) {
    console.error("proxy fatal:", error);

    // Fail open rather than bringing the site down.
    return NextResponse.next();
  }
}

/*
 * Keep matcher broad.
 * Static Next assets are excluded.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image).*)",
  ],
};