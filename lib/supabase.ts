// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import { headers as nextHeaders } from "next/headers";

/**
 * Env
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * 1) RLS client for API route handlers that forward Authorization headers.
 *    (Useful once you add auth; safe to keep now.)
 */
export async function supabaseRLSFromAuthHeader() {
  const h = await nextHeaders(); // ✅ in Next 16 this can be a Promise
  const auth = h.get("authorization") || undefined;

  return createClient(SUPABASE_URL, ANON_KEY, {
    global: auth ? { headers: { Authorization: auth } } : {},
  });
}

/**
 * 2) Admin client (bypasses RLS). Use ONLY in server code (route handlers).
 *    This is what your existing code was using.
 */
export function supabaseAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * 3) Back-compat export so existing imports keep working.
 *    (Your routes/pages are importing { supabaseServer } today.)
 */
export const supabaseServer = supabaseAdmin();

/**
 * 4) Optional convenience if you want a named getter instead.
 */
export function getSupabaseServer() {
  return supabaseServer;
}
// add to lib/supabase.ts (below current exports)
export function supabaseBrowser() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: true } }
  );
}
