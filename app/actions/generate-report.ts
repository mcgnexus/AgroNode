"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getDefaultParcel,
  getLatestSensorData,
  getWeeklyForecast,
} from "@/lib/data-fetching";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const REQUEST_TIMEOUT_MS = 45_000;
const MODEL = "deepseek-chat";

export const diagnosisSchema = z.object({
  waterStress: z.enum(["LOW", "MED", "HIGH"]),
  diseaseRisk: z.enum(["LOW", "MED", "HIGH"]),
  frostRisk: z.enum(["LOW", "MED", "HIGH"]),
  irrigationDecision: z.enum(["IRRIGATE_NOW", "DELAY", "NO_IRRIGATION"]),
  actionableAdvice: z.string(),
  soilStatus: z.string(),
  deltaTAssessment: z.string(),
});

export type DiagnosisReport = z.infer<typeof diagnosisSchema>;

export interface DashboardReportResult {
  ok: boolean;
  report: DiagnosisReport | null;
  rawResponse: string | null;
  error: string | null;
  tokensUsed: number | null;
}

function buildDiagnosisSystemPrompt(params: {
  parcelName: string;
  cropType: string;
  sensor: {
    ambientTemp: number;
    ambientHumidity: number;
    leafTemp: number;
    soilHumidity: number;
    atmosphericPressure: number;
    deltaT: number;
  };
  forecastSummary: string;
}): string {
  return `Eres un motor de diagnóstico agrícola automatizado. Tu ÚNICA salida es un objeto JSON. No incluyas texto adicional, explicaciones, ni markdown.

ANÁLISIS A REALIZAR:
1. ESTRÉS HÍDRICO: T_hoja=${params.sensor.leafTemp}°C, T_amb=${params.sensor.ambientTemp}°C, delta T=${params.sensor.deltaT > 0 ? "+" : ""}${params.sensor.deltaT.toFixed(1)}°C, θ_suelo=${params.sensor.soilHumidity}%.
   - Si deltaT > +2 y suelo < 35%: HIGH
   - Si deltaT > +1 o suelo 30-45%: MED
   - Resto: LOW

2. RIESGO HONGOS: HR=${params.sensor.ambientHumidity}%, T_hoja=${params.sensor.leafTemp}°C, lluvia prevista.
   - HR > 80% Y T_hoja 15-25°C Y lluvia > 50%: HIGH
   - HR > 70% o T_hoja 20-28°C: MED
   - Resto: LOW

3. RIESGO HELADA: T_amb=${params.sensor.ambientTemp}°C, mínimas previstas.
   - T_amb < 3°C o mínima < 0°C: HIGH
   - T_amb 3-7°C o mínima < 3°C: MED
   - Resto: LOW

4. DECISIÓN RIEGO: suelo=${params.sensor.soilHumidity}%, lluvia próxima.
   - Suelo < 30% Y lluvia < 40%: IRRIGATE_NOW
   - Suelo 30-45% Y lluvia > 60%: DELAY
   - Suelo > 50% o condiciones adecuadas: NO_IRRIGATION

PARCELA: ${params.parcelName} — ${params.cropType}
PRONÓSTICO:
${params.forecastSummary}

RESPONDE ÚNICAMENTE con este JSON (sin bloques de código, sin backticks):
{
  "waterStress": "LOW|MED|HIGH",
  "diseaseRisk": "LOW|MED|HIGH",
  "frostRisk": "LOW|MED|HIGH",
  "irrigationDecision": "IRRIGATE_NOW|DELAY|NO_IRRIGATION",
  "actionableAdvice": "Máximo 2 frases con la recomendación principal.",
  "soilStatus": "1 frase describiendo el estado hídrico del suelo.",
  "deltaTAssessment": "1 frase sobre el delta T y su significado fisiológico."
}`;
}

function parseJsonFromResponse(raw: string): DiagnosisReport | null {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  }
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);
    return diagnosisSchema.parse(parsed);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return diagnosisSchema.parse(parsed);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function generateDashboardReport(): Promise<DashboardReportResult> {
  const parcel = await getDefaultParcel();
  if (!parcel) {
    return { ok: false, report: null, rawResponse: null, error: "No hay parcelas registradas.", tokensUsed: null };
  }

  const [sensor, forecast] = await Promise.all([
    getLatestSensorData(parcel.id),
    getWeeklyForecast(parcel.id),
  ]);

  if (!sensor) {
    return { ok: false, report: null, rawResponse: null, error: "No hay datos de sensor disponibles.", tokensUsed: null };
  }

  const deltaT = sensor.leafTemp - sensor.ambientTemp;

  const forecastSummary = forecast
    .slice(0, 3)
    .map((f) => {
      const d = f.forecastDate.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
      return `${d}: ${f.minTemp}–${f.maxTemp}°C | Lluvia: ${f.precipitationProb}% | ET₀: ${f.et0}mm`;
    })
    .join("\n");

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey === "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") {
    const fallbackReport: DiagnosisReport = {
      waterStress: deltaT > 2 && sensor.soilHumidity < 35 ? "HIGH" : deltaT > 1 || sensor.soilHumidity < 45 ? "MED" : "LOW",
      diseaseRisk: sensor.ambientHumidity > 80 && sensor.leafTemp > 15 && sensor.leafTemp < 25 ? "HIGH" : sensor.ambientHumidity > 70 ? "MED" : "LOW",
      frostRisk: sensor.ambientTemp < 3 ? "HIGH" : sensor.ambientTemp < 7 ? "MED" : "LOW",
      irrigationDecision: sensor.soilHumidity < 30 ? "IRRIGATE_NOW" : sensor.soilHumidity < 45 ? "DELAY" : "NO_IRRIGATION",
      actionableAdvice: "API de DeepSeek no configurada. Este es un diagnóstico basado en reglas locales. Configura DEEPSEEK_API_KEY para análisis con IA.",
      soilStatus: `Humedad del suelo al ${sensor.soilHumidity}%. ${sensor.soilHumidity < 35 ? "Niveles bajos, considerar riego." : "Dentro del rango aceptable."}`,
      deltaTAssessment: `Delta T de ${deltaT > 0 ? "+" : ""}${deltaT.toFixed(1)}°C. ${deltaT > 2 ? "Posible cierre estomático y estrés hídrico." : deltaT > 0 ? "Ligera reducción de transpiración." : "Transpiración normal."}`,
    };
    return { ok: true, report: fallbackReport, rawResponse: null, error: null, tokensUsed: 0 };
  }

  const systemPrompt = buildDiagnosisSystemPrompt({
    parcelName: parcel.name,
    cropType: parcel.cropType,
    sensor: {
      ambientTemp: sensor.ambientTemp,
      ambientHumidity: sensor.ambientHumidity,
      leafTemp: sensor.leafTemp,
      soilHumidity: sensor.soilHumidity,
      atmosphericPressure: sensor.atmosphericPressure,
      deltaT,
    },
    forecastSummary,
  });

  let response: Response;
  try {
    response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Genera el diagnóstico completo de esta parcela ahora." },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });
  } catch (err) {
    return {
      ok: false,
      report: null,
      rawResponse: null,
      error: `Error de conexión con DeepSeek: ${err instanceof Error ? err.message : String(err)}`,
      tokensUsed: null,
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "sin detalle");
    return { ok: false, report: null, rawResponse: null, error: `DeepSeek ${response.status}: ${body}`, tokensUsed: null };
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };

  const rawContent = json.choices?.[0]?.message?.content?.trim() ?? "";
  const tokensUsed = json.usage?.total_tokens ?? null;

  const report = parseJsonFromResponse(rawContent);

  if (report) {
    await prisma.aiInteractionLog.create({
      data: {
        parcelId: parcel.id,
        timestamp: new Date(),
        triggerSource: "DASHBOARD_MANUAL",
        injectedContext: {
          type: "structured_diagnosis",
          deltaT,
          soilHumidity: sensor.soilHumidity,
          ambientHumidity: sensor.ambientHumidity,
        },
        prompt: "[Auto] Generar Diagnóstico de Parcela",
        llmResponse: rawContent,
        tokensUsed,
      },
    });
  }

  return {
    ok: !!report,
    report,
    rawResponse: rawContent,
    error: report ? null : "No se pudo parsear la respuesta estructurada de DeepSeek.",
    tokensUsed,
  };
}
