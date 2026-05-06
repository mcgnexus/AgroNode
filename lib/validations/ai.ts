import { z } from "zod";

export const aiChatSchema = z.object({
  parcelId: z.uuid("parcelId debe ser un UUID válido"),
  message: z.string().min(1, "El mensaje no puede estar vacío").max(2000, "Máximo 2000 caracteres"),
});

export type AiChatInput = z.infer<typeof aiChatSchema>;
