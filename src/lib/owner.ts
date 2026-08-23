import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { pool } from "@/db/client";
import { auth } from "@/lib/auth";
import { HttpError } from "@/lib/http";

export interface OwnerState {
  configured: boolean;
  databaseReady: boolean;
  registered: boolean;
  locked: boolean;
  ownerEmail: string | null;
}

export type OwnerSession = typeof auth.$Infer.Session;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function configuredOwnerEmail(): string | null {
  const value = process.env.APP_OWNER_EMAIL;
  return value?.trim() ? normalizeEmail(value) : null;
}

export async function getOwnerState(): Promise<OwnerState> {
  const ownerEmail = configuredOwnerEmail();
  if (!ownerEmail) {
    return {
      configured: false,
      databaseReady: false,
      registered: false,
      locked: false,
      ownerEmail: null,
    };
  }

  try {
    const result = await pool.query<{ email: string }>(
      'select "email" from "user" limit 2',
    );
    const emails = result.rows.map((row) => normalizeEmail(row.email));
    return {
      configured: true,
      databaseReady: true,
      registered: emails.includes(ownerEmail),
      locked: emails.length > 0 && !emails.includes(ownerEmail),
      ownerEmail,
    };
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "";
    if (code === "42P01") {
      return {
        configured: true,
        databaseReady: false,
        registered: false,
        locked: false,
        ownerEmail,
      };
    }
    throw error;
  }
}

export async function assertOwnerSignupAllowed(email: string): Promise<void> {
  const state = await getOwnerState();

  if (!state.configured || !state.ownerEmail) {
    throw new HttpError("APP_OWNER_EMAIL is not configured.", 503);
  }
  if (!state.databaseReady) {
    throw new HttpError("The authentication database has not been migrated.", 503);
  }
  if (normalizeEmail(email) !== state.ownerEmail) {
    throw new HttpError("This deployment accepts only its configured owner.", 403);
  }
  if (state.locked) {
    throw new HttpError(
      "A different account already exists. Correct the database before continuing.",
      409,
    );
  }
  if (state.registered) {
    throw new HttpError("Owner setup is already complete. Sign in instead.", 409);
  }
}

export async function getOwnerSession(
  requestHeaders: Headers,
): Promise<OwnerSession | null> {
  const ownerEmail = configuredOwnerEmail();
  if (!ownerEmail) return null;

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session || normalizeEmail(session.user.email) !== ownerEmail) return null;
  return session;
}

export async function requireOwnerRequest(
  request: Request,
): Promise<OwnerSession> {
  const session = await getOwnerSession(request.headers);
  if (!session) throw new HttpError("Authentication required.", 401);
  return session;
}

export async function requireOwnerPage(): Promise<OwnerSession> {
  const session = await getOwnerSession(await headers());
  if (!session) redirect("/sign-in");
  return session;
}
