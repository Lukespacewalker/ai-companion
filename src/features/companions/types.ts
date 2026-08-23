export const responseStyles = ["brief", "balanced", "detailed"] as const;
export const memoryModes = [
  "isolated",
  "shared_profile",
  "shared_all",
] as const;

export type ResponseStyle = (typeof responseStyles)[number];
export type MemoryMode = (typeof memoryModes)[number];

export interface CompanionDto {
  id: string;
  name: string;
  description: string;
  avatarUrl: string;
  model: string;
  responseStyle: ResponseStyle;
  memoryMode: MemoryMode;
  memoryInstructions: string;
  systemPrompt: string;
  promptVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface PromptVersionDto {
  id: string;
  version: number;
  systemPrompt: string;
  createdAt: string;
}

export interface CompanionDraft {
  name: string;
  description: string;
  avatarUrl: string;
  model: string;
  responseStyle: ResponseStyle;
  memoryMode: MemoryMode;
  memoryInstructions: string;
  systemPrompt: string;
}
