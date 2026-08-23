import { buildGenerationSystemPrompt } from "@/features/chats/context";
import {
  completeTurn,
  failTurn,
  prepareTurn,
} from "@/features/chats/repository";
import type { ChatStreamEvent } from "@/features/chats/types";
import {
  chatIdSchema,
  sendChatMessageSchema,
} from "@/features/chats/validation";
import {
  assertTrustedMutationOrigin,
  errorResponse,
  HttpError,
  readJson,
} from "@/lib/http";
import { grokProvider } from "@/lib/grok/provider";
import { requireOwnerRequest } from "@/lib/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

type RouteContext = { params: Promise<{ chatId: string }> };

function publicGenerationError(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  console.error(error);
  return "Grok could not complete this response. Retry the message after checking the provider connection.";
}

function streamResponse(
  run: (
    send: (event: ChatStreamEvent) => void,
    close: () => void,
  ) => Promise<void>,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // The browser may already have disconnected.
        }
      };

      const send = (event: ChatStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
            ),
          );
        } catch {
          closed = true;
        }
      };

      void run(send, close).catch((error) => {
        console.error(error);
        close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    assertTrustedMutationOrigin(request);
    const owner = await requireOwnerRequest(request);
    const chatId = chatIdSchema.parse((await context.params).chatId);
    const input = sendChatMessageSchema.parse(await readJson(request));

    const provider = await grokProvider.status();
    if (!provider.installed) {
      throw new HttpError("The Grok runtime is not installed.", 503);
    }
    if (!provider.authenticated) {
      throw new HttpError("Connect Grok before sending a message.", 409);
    }

    const prepared = await prepareTurn(owner.user.id, chatId, input);

    if (prepared.kind === "replay") {
      return streamResponse(async (send, close) => {
        send({
          type: "accepted",
          value: {
            chat: prepared.chat,
            userMessage: prepared.userMessage,
            assistantMessage: prepared.assistantMessage,
          },
        });
        send({
          type: "complete",
          chat: prepared.chat,
          assistantMessage: prepared.assistantMessage,
        });
        close();
      });
    }

    return streamResponse(async (send, close) => {
      send({
        type: "accepted",
        value: {
          chat: prepared.chat,
          userMessage: prepared.userMessage,
          assistantMessage: prepared.assistantMessage,
        },
      });

      try {
        if (request.signal.aborted) {
          throw new Error("Generation cancelled.");
        }

        const result = await grokProvider.generate({
          systemPrompt: buildGenerationSystemPrompt(prepared.companion),
          messages: prepared.conversation,
          model: prepared.model,
          signal: request.signal,
          onDelta(delta) {
            send({
              type: "delta",
              assistantMessageId: prepared.assistantMessage.id,
              delta,
            });
          },
        });

        const completed = await completeTurn(owner.user.id, chatId, {
          assistantMessageId: prepared.assistantMessage.id,
          assistantText: result.text,
          userText: prepared.userText,
          previousSummary: prepared.previousSummary,
          providerSessionId: result.sessionId,
          providerModel: prepared.model || provider.models[0] || null,
          promptVersion: prepared.promptVersion,
        });

        send({
          type: "complete",
          chat: completed.chat,
          assistantMessage: completed.assistantMessage,
        });
      } catch (error) {
        const cancelled = request.signal.aborted;
        const message = cancelled
          ? "Response generation was cancelled."
          : publicGenerationError(error);

        try {
          await failTurn(owner.user.id, chatId, {
            assistantMessageId: prepared.assistantMessage.id,
            status: cancelled ? "cancelled" : "failed",
            error: message,
          });
        } catch (persistenceError) {
          console.error(persistenceError);
        }

        send({
          type: "error",
          assistantMessageId: prepared.assistantMessage.id,
          status: cancelled ? "cancelled" : "failed",
          message,
        });
      } finally {
        close();
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
