import { z } from "zod";

const nodeCodeSchema = z
  .string()
  .min(1, "node_code es requerido")
  .max(50, "node_code máximo 50 caracteres")
  .regex(/^[A-Za-z0-9\-_]+$/, "Solo letras, números, guion y guion bajo");

export const nodeCodeQuerySchema = z.object({
  node_code: nodeCodeSchema,
});

export const readingsQuerySchema = z.object({
  node_code: nodeCodeSchema,
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().min(1).max(500))
    .default(100),
});

export const createNodeSchema = z.object({
  node_code: nodeCodeSchema,
  name: z.string().max(255).optional(),
  location_name: z.string().max(255).optional(),
  crop: z.string().max(100).optional(),
  wifi_ssid: z.string().max(100).optional(),
  wifi_password: z.string().max(255).optional(),
  api_token: z.string().min(1, "api_token es requerido").max(500),
});

export const ingestReadingSchema = z.object({
  node_code: nodeCodeSchema,
  token: z.string().min(1, "token es requerido"),
  air_temp_c: z.number().optional(),
  air_humidity_pct: z.number().min(0).max(100).optional(),
  pressure_hpa: z.number().optional(),
  leaf_temp_c: z.number().optional(),
  soil_moisture_raw: z.number().int().optional(),
  soil_moisture_pct: z.number().min(0).max(100).optional(),
  battery_v: z.number().optional(),
  rssi_dbm: z.number().int().optional(),
  measured_at: z.string().datetime({ offset: true }).optional(),
});

export type CreateNodeInput = z.infer<typeof createNodeSchema>;
export type IngestReadingInput = z.infer<typeof ingestReadingSchema>;