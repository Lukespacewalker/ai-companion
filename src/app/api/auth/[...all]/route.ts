import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import {
  assertTrustedMutationOrigin,
  errorResponse,
  HttpError,
  readJson,
} from "@/lib/http";
import { assertOwnerSignupAllowed } from "@/lib/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

export async function POST(request: Request) {
  try {
    assertTrustedMutationOrigin(request);

    if (new URL(request.url).pathname.endsWith("/sign-up/email")) {
      const body = await readJson(request.clone());
      if (
        !body ||
        typeof body !== "object" ||
        !("email" in body) ||
        typeof body.email !== "string"
      ) {
        throw new HttpError("A valid owner email is required.", 400);
      }
      await assertOwnerSignupAllowed(body.email);
    }

    return handlers.POST(request);
  } catch (error) {
    return errorResponse(error);
  }
}
