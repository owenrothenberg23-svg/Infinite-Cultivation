// lib/stripe.ts
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set in env");
}

// Create and export a single Stripe client
export const stripe = new Stripe(secretKey, {
  // Intentionally NOT setting apiVersion so the SDK uses its bundled version.
  // This avoids TS mismatches like `"2024-06-20" is not assignable to ...`.
});
