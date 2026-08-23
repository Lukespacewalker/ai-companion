import {
  getChat,
  updateChat,
} from "@/features/chats/repository";
import {
  chatIdSchema,
  updateChatSchema,
} from "@/features/chats/validation";
import {
  assertTrustedMutationOrigin,
  errorResponse,
  HttpError,
  readJson,
} from "@/lib/http";
import { requireOwnerRequest } from "@/lib/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ chatId: string }> };

async function readChatId(context: RouteContext): Promise<string> {
  return chatIdSchema.parse((await context.params).chatId);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const owner = await requireOwnerRequest(request);
    const chat = await getChat(owner.user.id, await readChatId(context));
    if (!chat) throw new HttpError("Chat not found.", 404);

    return Response.json(
      { chat },
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
    const input = updateChatSchema.parse(await readJson(request));
    const chat = await updateChat(
      owner.user.id,
      await readChatId(context),
      input,
    );

    return Response.json(
      { chat },
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
    const chat = await updateChat(owner.user.id, await readChatId(context), {
      archived: true,
    });

    return Response.json(
      { chat },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
