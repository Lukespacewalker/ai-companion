import { z } from "zod";
import { memoryModes, responseStyles } from "./types";

const avatarUrlSchema = z
  .string()
  .trim()
  .max(2048, "Avatar URL is too long.")
  .refine(
    (value) => !value || URL.canParse(value),
    "Avatar URL must be an absolute URL.",
  );

export const createCompanionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters.")
    .max(80, "Name must contain at most 80 characters."),
  description: z
    .string()
    .trim()
    .max(500, "Description must contain at most 500 characters."),
  avatarUrl: avatarUrlSchema,
  model: z
    .string()
    .trim()
    .min(1, "Model is required.")
    .max(120, "Model name is too long."),
  responseStyle: z.enum(responseStyles),
  memoryMode: z.enum(memoryModes),
  memoryInstructions: z
    .string()
    .trim()
    .max(4000, "Memory instructions must contain at most 4,000 characters."),
  systemPrompt: z
    .string()
    .trim()
    .min(20, "System prompt must contain at least 20 characters.")
    .max(24_000, "System prompt must contain at most 24,000 characters."),
});

export const updateCompanionSchema = createCompanionSchema
  .partial()
  .extend({
    archived: z.boolean().optional(),
    expectedPromptVersion: z.number().int().positive(),
  })
  .refine(
    (value) =>
      Object.keys(value).some((key) => key !== "expectedPromptVersion"),
    "At least one companion field must be changed.",
  );

export const companionIdSchema = z.string().uuid("Invalid companion ID.");

export type CreateCompanionInput = z.infer<typeof createCompanionSchema>;
export type UpdateCompanionInput = z.infer<typeof updateCompanionSchema>;
