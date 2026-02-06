// lib/supabaseRoute.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getSupabaseRoute() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // In route handlers we usually don't need to set/remove cookies for reads.
        // (If you later need it, we can wire this to a NextResponse.)
        set() {},
        remove() {},
      },
    }
  );
}
