import {
  getCompanion,
  updateCompanion,
} from "@/features/companions/repository";
import {
  companionIdSchema,
  updateCompanionSchema,
} from "@/features/companions/validation";
import {
  assertTrustedMutationOrigin,
  errorResponse,
  HttpError,
  readJson,
} from "@/lib/http";
import { requireOwnerRequest } from "@/lib/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ companionId: string }> };

async function companionId(context: RouteContext): Promise<string> {
  return companionIdSchema.parse((await context.params).companionId);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const owner = await requireOwnerRequest(request);
    const companion = await getCompanion(
      owner.user.id,
      await companionId(context),
    );
    if (!companion) throw new HttpError("Companion not found.", 404);
    return Response.json(
      { companion },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    assertTrustedMutationOrigin(request);
    const owner = await requireOwnerRequest(request);
    const input = updateCompanionSchema.parse(await readJson(request));
    const companion = await updateCompanion(
      owner.user.id,
      await companionId(context),
      input,
    );
    return Response.json(
      { companion },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    assertTrustedMutationOrigin(request);
    const owner = await requireOwnerRequest(request);
    const version = Number(new URL(request.url).searchParams.get("version"));
    if (!Number.isInteger(version) || version < 1) {
      throw new HttpError("A valid prompt version is required.", 400);
    }
    const companion = await updateCompanion(
      owner.user.id,
      await companionId(context),
      { archived: true, expectedPromptVersion: version },
    );
    return Response.json(
      { companion },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
