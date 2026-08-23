import { z } from "zod";
import {
  createChat,
  listChats,
} from "@/features/chats/repository";
import { createChatSchema } from "@/features/chats/validation";
import {
  assertTrustedMutationOrigin,
  errorResponse,
  readJson,
} from "@/lib/http";
import { requireOwnerRequest } from "@/lib/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const optionalCompanionIdSchema = z.string().uuid().optional();

export async function GET(request: Request) {
  try {
    const owner = await requireOwnerRequest(request);
    const url = new URL(request.url);
    const companionId = optionalCompanionIdSchema.parse(
      url.searchParams.get("companionId") || undefined,
    );
    const includeArchived = url.searchParams.get("includeArchived") === "1";

    return Response.json(
      {
        chats: await listChats(owner.user.id, {
          companionId,
          includeArchived,
        }),
      },
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
    const input = createChatSchema.parse(await readJson(request));
    const chat = await createChat(owner.user.id, input);

    return Response.json(
      { chat },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
