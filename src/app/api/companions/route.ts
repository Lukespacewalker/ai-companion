import {
  createCompanion,
  listCompanions,
} from "@/features/companions/repository";
import { createCompanionSchema } from "@/features/companions/validation";
import {
  assertTrustedMutationOrigin,
  errorResponse,
  readJson,
} from "@/lib/http";
import { requireOwnerRequest } from "@/lib/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const owner = await requireOwnerRequest(request);
    return Response.json(
      { companions: await listCompanions(owner.user.id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutationOrigin(request);
    const owner = await requireOwnerRequest(request);
    const input = createCompanionSchema.parse(await readJson(request));
    const companion = await createCompanion(owner.user.id, input);
    return Response.json(
      { companion },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
