import { prisma } from "@/lib/prisma";
import { TriggerSource } from "@prisma/client";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const REQUEST_TIMEOUT_MS = 30_000;
const MODEL = "deepseek-chat";

interface SensorSnapshot {
  timestamp: string;
  ambientTemp: number;
  ambientHumidity: number;
  soilHumidity: number;
  leafTemp: number;
  atmosphericPressure: number;
}

interface ForecastSnapshot {
  forecastDate: string;
  maxTemp: number;
  minTemp: number;
  precipitationProb: number;
  et0: number;
}

async function buildContext(parcelId: string) {
  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
  });

  if (!parcel) {
    throw new Error(`Parcela no encontrada: ${parcelId}`);
  }

  const last24h = new Date();
  last24h.setHours(last24h.getHours() - 24);

  const recentSensors = await prisma.sensorData.findMany({
    where: { parcelId, timestamp: { gte: last24h } },
    orderBy: { timestamp: "desc" },
    take: 10,
  });

  const latest = recentSensors[0];
  const sensorSnapshots: SensorSnapshot[] = recentSensors
    .slice(0, 5)
    .reverse()
    .map((s) => ({
      timestamp: s.timestamp.toISOString(),
      ambientTemp: s.ambientTemp,
      ambientHumidity: s.ambientHumidity,
      soilHumidity: s.soilHumidity,
      leafTemp: s.leafTemp,
      atmosphericPressure: s.atmosphericPressure,
    }));

  const forecasts = await prisma.weatherForecast.findMany({
    where: { parcelId },
    orderBy: { forecastDate: "asc" },
    take: 7,
  });

  const forecastSnapshots: ForecastSnapshot[] = forecasts.map((f) => ({
    forecastDate: f.forecastDate.toISOString(),
    maxTemp: f.maxTemp,
    minTemp: f.minTemp,
    precipitationProb: f.precipitationProb,
    et0: f.et0,
  }));

  const systemPrompt = `Eres un asistente agrícola experto para la plataforma AgroNode. Respondes en español de forma clara y concisa.

DATOS DE LA PARCELA:
- Nombre: ${parcel.name}
- Cultivo: ${parcel.cropType}
- Ubicación: ${parcel.latitude}°N, ${Math.abs(parcel.longitude)}°O

DATOS ACTUALES DEL SENSOR (última lectura${latest ? `: ${latest.timestamp.toISOString()}` : ""}):
${latest ? `- Temperatura ambiente: ${latest.ambientTemp}°C
- Humedad ambiente: ${latest.ambientHumidity}%
- Temperatura de hoja: ${latest.leafTemp}°C
- Humedad del suelo: ${latest.soilHumidity}%
- Presión atmosférica: ${latest.atmosphericPressure} hPa
${latest.batteryLevel != null ? `- Batería: ${latest.batteryLevel}%` : ""}
${latest.rssi != null ? `- RSSI: ${latest.rssi} dBm` : ""}` : "- No hay datos de sensor disponibles"}

LECTURAS RECIENTES (últimas 5):
${JSON.stringify(sensorSnapshots, null, 2)}

PRONÓSTICO METEOROLÓGICO (7 días):
${JSON.stringify(forecastSnapshots, null, 2)}

INSTRUCCIONES:
- Basa tus respuestas en los datos reales proporcionados.
- Da recomendaciones prácticas y específicas para el cultivo.
- Si detectas valores fuera de rango o anomalías, señálalo.
- Sugiere acciones concretas (riego, tratamientos, monitoreo).
- Si el usuario pregunta algo no relacionado con agricultura, redirige amablemente.`;

  return { systemPrompt, parcel };
}

export async function chatWithAi(
  parcelId: string,
  userMessage: string,
  triggerSource: TriggerSource = TriggerSource.DASHBOARD_MANUAL
) {
  const { systemPrompt, parcel } = await buildContext(parcelId);

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey === "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") {
    const fallback = await prisma.aiInteractionLog.create({
      data: {
        parcelId,
        timestamp: new Date(),
        triggerSource,
        injectedContext: { note: "API key no configurada" },
        prompt: userMessage,
        llmResponse: "El asistente AI no está configurado. Configura DEEPSEEK_API_KEY en el archivo .env para habilitar esta funcionalidad.",
        tokensUsed: 0,
      },
    });

    return {
      response: fallback.llmResponse,
      logId: fallback.id,
      tokensUsed: 0,
    };
  }

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
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });
  } catch (err) {
    throw new Error(
      `Error de conexión con DeepSeek: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `DeepSeek API error (${response.status}): ${errorBody}`
    );
  }

  const json = await response.json() as {
    choices: { message: { content: string } }[];
    usage?: { total_tokens: number };
  };

  const aiResponse = json.choices?.[0]?.message?.content ?? "Sin respuesta del modelo.";
  const tokensUsed = json.usage?.total_tokens ?? null;

  const log = await prisma.aiInteractionLog.create({
    data: {
      parcelId,
      timestamp: new Date(),
      triggerSource,
      injectedContext: {
        parcel: parcel.name,
        cropType: parcel.cropType,
      },
      prompt: userMessage,
      llmResponse: aiResponse,
      tokensUsed,
    },
  });

  return {
    response: aiResponse,
    logId: log.id,
    tokensUsed,
  };
}
