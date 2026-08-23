export type GrokConnectionState =
  | "unavailable"
  | "signed-out"
  | "authorizing"
  | "ready"
  | "error";

export type GrokDeviceLoginState =
  | "idle"
  | "authorizing"
  | "completed"
  | "failed"
  | "cancelled";

export interface GrokDeviceLoginSnapshot {
  id: string;
  state: GrokDeviceLoginState;
  verificationUrl?: string;
  userCode?: string;
  instructions?: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface GrokProviderStatus {
  id: "grok-cli-oauth";
  state: GrokConnectionState;
  installed: boolean;
  authenticated: boolean;
  authMode: "oauth-cli";
  deployment: "persistent-self-hosted";
  binary?: string;
  models: string[];
  detail?: string;
  login?: GrokDeviceLoginSnapshot;
}

export interface GrokChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GrokGenerateRequest {
  systemPrompt: string;
  messages: GrokChatMessage[];
  model?: string;
  onDelta?: (delta: string) => void;
}

export interface GrokGenerateResult {
  text: string;
  sessionId: string;
  stopReason?: string;
}
