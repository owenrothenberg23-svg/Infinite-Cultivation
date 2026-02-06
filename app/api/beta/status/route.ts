// app/api/beta/status/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const c of cookiesToSet) {
            cookieStore.set(c.name, c.value, c.options);
          }
        },
      },
    }
  );

  const { data } = await sb.auth.getUser();
  const user = data?.user ?? null;

  if (!user?.email) {
    return NextResponse.json({ allowed: false, authed: false }, { status: 200 });
  }

  const email = user.email.trim().toLowerCase();
  const owner = (process.env.BETA_OWNER_EMAIL || "").trim().toLowerCase();
  if (owner && email === owner) {
    return NextResponse.json({ allowed: true, authed: true }, { status: 200 });
  }

  const { data: row, error } = await sb
    .from("beta_allowlist")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  const allowed = !error && !!row?.email;
  return NextResponse.json({ allowed, authed: true }, { status: 200 });
}
