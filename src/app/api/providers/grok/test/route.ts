import { grokProvider } from "@/lib/grok/provider";
import { assertTrustedMutationOrigin, errorResponse } from "@/lib/http";

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
    const body = (await request.json().catch(() => ({}))) as {
      prompt?: unknown;
    };
    const prompt =
      typeof body.prompt === "string"
        ? body.prompt.trim().slice(0, 500)
        : "";

    if (!prompt) {
      return Response.json(
        { error: "A short test prompt is required." },
        { status: 400 },
      );
    }

    const providerStatus = await grokProvider.status();
    if (!providerStatus.authenticated) {
      return Response.json(
        { error: "Connect Grok before sending a test message." },
        { status: 409 },
      );
    }

    const result = await grokProvider.generate({
      systemPrompt: TEST_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      model: providerStatus.models[0],
    });

    return Response.json(
      { text: result.text },
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
