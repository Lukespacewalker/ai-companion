import { betterAuth } from "better-auth";
import { pool } from "../db/client";

function requireAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "BETTER_AUTH_SECRET must contain at least 32 characters.",
    );
  }
  return secret;
}

const baseURL =
  process.env.BETTER_AUTH_URL?.trim() || "http://127.0.0.1:3000";

export const auth = betterAuth({
  appName: "AI Companion",
  database: pool,
  baseURL,
  secret: requireAuthSecret(),
  trustedOrigins: [new URL(baseURL).origin],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
  },
  advanced: {
    database: {
      joins: true,
    },
  },
});
