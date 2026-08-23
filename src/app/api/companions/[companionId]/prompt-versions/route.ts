import { listPromptVersions } from "@/features/companions/repository";
import { companionIdSchema } from "@/features/companions/validation";
import { errorResponse } from "@/lib/http";
import { requireOwnerRequest } from "@/lib/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ companionId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const owner = await requireOwnerRequest(request);
    const companionId = companionIdSchema.parse(
      (await context.params).companionId,
    );
    return Response.json(
      { versions: await listPromptVersions(owner.user.id, companionId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
