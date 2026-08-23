import { z } from "zod";

export const chatIdSchema = z.string().uuid("Invalid chat ID.");

export const createChatSchema = z.object({
  companionId: z.string().uuid("Invalid companion ID."),
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty.")
    .max(160, "Title must contain at most 160 characters.")
    .optional(),
});

export const updateChatSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty.")
      .max(160, "Title must contain at most 160 characters.")
      .optional(),
    archived: z.boolean().optional(),
  })
  .refine(
    (value) => value.title !== undefined || value.archived !== undefined,
    "At least one chat field must be changed.",
  );

export const sendChatMessageSchema = z.object({
  clientMessageId: z.string().uuid("Invalid client message ID."),
  content: z
    .string()
    .trim()
    .min(1, "Message cannot be empty.")
    .max(8_000, "Message must contain at most 8,000 characters."),
});

export type CreateChatInput = z.infer<typeof createChatSchema>;
export type UpdateChatInput = z.infer<typeof updateChatSchema>;
export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;
