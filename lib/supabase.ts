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
 *    Use this when you want Supabase Auth + RLS to apply.
 *
 *    IMPORTANT:
 *    - This reads the incoming request's Authorization header.
 *    - It does NOT use cookies (no cookie adapters / no cookie writing).
 */
export async function supabaseRLSFromAuthHeader() {
  // In Next 16, headers() can be a Promise.
  const h = await nextHeaders();
  const auth = h.get("authorization") || "";

  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: auth ? { headers: { Authorization: auth } } : {},
  });
}

/**
 * 2) Admin client (bypasses RLS). Use ONLY in server code (route handlers).
 */
export function supabaseAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * 3) Back-compat export so existing imports keep working.
 */
export const supabaseServer = supabaseAdmin();

/**
 * 4) Convenience getter (SYNC on purpose).
 *    This prevents "Promise<...>" type explosions in your routes.
 */
export function getSupabaseServer() {
  return supabaseServer;
}
