export type ChatMessageRole = "user" | "assistant";
export type ChatMessageStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled";

export interface ChatSummaryDto {
  id: string;
  companionId: string;
  companionName: string;
  companionAvatarUrl: string;
  title: string;
  summary: string;
  summaryRevision: number;
  messageCount: number;
  lastMessagePreview: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  archivedAt: string | null;
}

export interface ChatMessageDto {
  id: string;
  parentMessageId: string | null;
  sequence: number;
  role: ChatMessageRole;
  content: string;
  status: ChatMessageStatus;
  provider: string | null;
  providerModel: string | null;
  providerSessionId: string | null;
  promptVersion: number | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ChatDetailDto extends ChatSummaryDto {
  messages: ChatMessageDto[];
}

export interface ChatCompanionOption {
  id: string;
  name: string;
  avatarUrl: string;
  model: string;
  promptVersion: number;
}

export interface SendMessageAcceptedEvent {
  chat: ChatSummaryDto;
  userMessage: ChatMessageDto;
  assistantMessage: ChatMessageDto;
}

export type ChatStreamEvent =
  | { type: "accepted"; value: SendMessageAcceptedEvent }
  | { type: "delta"; assistantMessageId: string; delta: string }
  | {
      type: "complete";
      chat: ChatSummaryDto;
      assistantMessage: ChatMessageDto;
    }
  | {
      type: "error";
      assistantMessageId: string;
      status: "failed" | "cancelled";
      message: string;
    };
