import { grokProvider } from "@/lib/grok/provider";
import {
  assertTrustedMutationOrigin,
  errorResponse,
  HttpError,
  readJson,
} from "@/lib/http";
import { requireOwnerRequest } from "@/lib/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_SYSTEM_PROMPT = [
  "You are a connection test for a personal AI companion application.",
  "Reply naturally in one short sentence.",
  "Do not use tools, search, files, terminal commands, subagents, or external actions.",
].join(" ");

export async function POST(request: Request) {
  try {
    assertTrustedMutationOrigin(request);
    await requireOwnerRequest(request);

    const body = await readJson(request);
    const prompt =
      body && typeof body === "object" && "prompt" in body
        ? String(body.prompt || "").trim()
        : "";

    if (!prompt || prompt.length > 500) {
      throw new HttpError(
        "Prompt must contain between 1 and 500 characters.",
        400,
      );
    }

    const providerStatus = await grokProvider.status();
    if (!providerStatus.authenticated) {
      throw new HttpError(
        "Connect Grok before sending a test message.",
        409,
      );
    }

    const result = await grokProvider.generate({
      systemPrompt: TEST_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      model: providerStatus.models[0],
    });

    return Response.json(
      { text: result.text },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
