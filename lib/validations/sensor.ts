import { z } from "zod";

export const sensorDataSchema = z.object({
  parcelId: z.uuid("parcelId debe ser un UUID válido"),

  ambientTemp: z
    .number()
    .min(-20, "Temperatura ambiente mínima: -20°C")
    .max(60, "Temperatura ambiente máxima: 60°C"),

  ambientHumidity: z
    .number()
    .min(0, "Humedad ambiente mínima: 0%")
    .max(100, "Humedad ambiente máxima: 100%"),

  atmosphericPressure: z
    .number()
    .min(870, "Presión atmosférica mínima: 870 hPa")
    .max(1084, "Presión atmosférica máxima: 1084 hPa"),

  leafTemp: z
    .number()
    .min(-20, "Temperatura de hoja mínima: -20°C")
    .max(60, "Temperatura de hoja máxima: 60°C"),

  soilHumidity: z
    .number()
    .min(0, "Humedad del suelo mínima: 0%")
    .max(100, "Humedad del suelo máxima: 100%"),

  batteryLevel: z
    .number()
    .min(0, "Nivel de batería mínimo: 0%")
    .max(100, "Nivel de batería máximo: 100%")
    .optional(),

  rssi: z
    .int()
    .min(-120, "RSSI mínimo: -120 dBm")
    .max(-20, "RSSI máximo: -20 dBm")
    .optional(),

  timestamp: z
    .iso.datetime({ offset: true })
    .optional(),
});

export type SensorDataInput = z.infer<typeof sensorDataSchema>;
