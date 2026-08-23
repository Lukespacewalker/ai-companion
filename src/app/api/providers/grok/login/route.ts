import { grokProvider } from "@/lib/grok/provider";
import { assertTrustedMutationOrigin, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertTrustedMutationOrigin(request);
    return Response.json(
      { login: await grokProvider.startLogin() },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
