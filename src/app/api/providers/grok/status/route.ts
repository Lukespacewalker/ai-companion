import { grokProvider } from "@/lib/grok/provider";
import { errorResponse } from "@/lib/http";
import { requireOwnerRequest } from "@/lib/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireOwnerRequest(request);
    return Response.json(
      { provider: await grokProvider.status() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
