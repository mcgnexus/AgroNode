import { TriggerSource } from "@prisma/client";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const REQUEST_TIMEOUT_MS = 45_000;
const MODEL = "deepseek-chat";

export interface SensorCurrentData {
  timestamp: Date;
  ambientTemp: number;
  ambientHumidity: number;
  atmosphericPressure: number;
  leafTemp: number;
  soilHumidity: number;
  batteryLevel: number | null;
  rssi: number | null;
}

export interface ForecastDay {
  forecastDate: Date;
  maxTemp: number;
  minTemp: number;
  precipitationProb: number;
  et0: number;
}

export interface AgronomicPromptParams {
  parcelId: string;
  parcelName: string;
  cropType: string;
  latitude: number;
  longitude: number;
  sensorData: SensorCurrentData;
  forecast: ForecastDay[];
  userMessage: string;
}

export interface DeepSeekResponse {
  content: string;
  tokensUsed: number | null;
  model: string;
  finishReason: string | null;
}

export interface AgronomicAdviceResult {
  response: string;
  tokensUsed: number | null;
  raw: DeepSeekResponse;
}

function buildAgronomicSystemPrompt(params: AgronomicPromptParams): string {
  const { parcelName, cropType, latitude, longitude, sensorData, forecast } = params;

  const sensorTs = sensorData.timestamp.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const deltaTemp = sensorData.leafTemp - sensorData.ambientTemp;

  const forecastLines = forecast
    .map((f) => {
      const date = f.forecastDate.toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
      });
      return `${date}: ${f.minTemp}°C – ${f.maxTemp}°C | Lluvia: ${f.precipitationProb}% | ET₀: ${f.et0} mm`;
    })
    .join("\n");

  return `Eres un Ingeniero Agrónomo senior especializado en fruticultura, viticultura y cultivos extensivos. Trabajas para la plataforma AgroNode, un sistema de monitoreo agrícola IoT en tiempo real.

═══════════════════════════════════════════
IDENTIDAD Y RESTRICCIONES
═══════════════════════════════════════════
- Nombre: Asesor AgroNode.
- Respondes SIEMPRE en español.
- Tus respuestas van a leerse en un teléfono (WhatsApp/Telegram). Máximo 800 caracteres por respuesta. Sé conciso y directo.
- NO uses formatos complejos (tablas, markdown pesado). Usa viñetas simples (-) y saltos de línea.
- NUNCA respondas temas no agrícolas. Si te preguntan algo fuera de tema, responde: "Solo puedo ayudarte con temas agrícolas. ¿Tienes alguna consulta sobre tu cultivo?"
- Si los datos del sensor son insuficientes o contradictorios, indícalo explícitamente.

═══════════════════════════════════════════
DATOS DE LA PARCELA
═══════════════════════════════════════════
- Nombre: ${parcelName}
- Cultivo: ${cropType}
- Coordenadas: ${latitude}°N, ${Math.abs(longitude)}°O

═══════════════════════════════════════════
DATOS ACTUALES DEL SENSOR (${sensorTs})
═══════════════════════════════════════════
- Temperatura ambiente (T_amb): ${sensorData.ambientTemp}°C
- Humedad relativa ambiente (HR): ${sensorData.ambientHumidity}%
- Temperatura foliar (T_hoja): ${sensorData.leafTemp}°C
- Humedad del suelo (θ_suelo): ${sensorData.soilHumidity}%
- Presión atmosférica: ${sensorData.atmosphericPressure} hPa
- Delta T (T_hoja - T_amb): ${deltaTemp > 0 ? "+" : ""}${deltaTemp.toFixed(1)}°C
${sensorData.batteryLevel != null ? `- Batería del nodo: ${sensorData.batteryLevel}%` : ""}
${sensorData.rssi != null ? `- Cobertura WiFi (RSSI): ${sensorData.rssi} dBm` : ""}

═══════════════════════════════════════════
PRONÓSTICO METEOROLÓGICO (3 días)
═══════════════════════════════════════════
${forecastLines}

═══════════════════════════════════════════
PROTOCOLO DE RAZONAMIENTO OBLIGATORIO
═══════════════════════════════════════════
Antes de responder, analiza SIEMPRE estos cruces en orden:

1. ESTRÉS HÍDRICO POR CIERRE ESTOMÁTICO:
   - Si T_hoja > T_amb (delta T > 0), la planta está transpirando menos de lo esperado. Esto indica cierre estomático, posible estrés hídrico.
   - Si delta T > +2°C y θ_suelo < 35%: estrés hídrico CONFIRMADO. Recomienda riego inmediato.
   - Si delta T > +1°C pero θ_suelo > 50%: posible estrés por calor extremo, no por falta de agua. Sugerir sombreado o nebulización.

2. DECISIÓN DE RIEGO:
   - Cruza θ_suelo actual con la probabilidad de precipitación de los próximos 2 días.
   - Si θ_suelo < 30% Y precipitación < 40% en las próximas 48h: riego URGENTE.
   - Si θ_suelo 30-45% Y precipitación > 60% en 24h: POSPONER riego y monitorear.
   - Si θ_suelo > 50%: NO regar. Evaluar drenaje si hay lluvia prevista.
   - Calcula lámina de riego estimada usando ET₀ del pronóstico.

3. RIESGO DE ENFERMEDADES FÚNGICAS:
   - Si HR > 80% Y T_hoja entre 15-25°C Y precipitación > 50%: riesgo ALTO de hongos (mildiu, botrytis, roya).
   - Si HR > 70% y T_hoja > 25°C: riesgo MODERADO. Recomendar monitoreo.
   - Si se detecta riesgo, sugerir tratamiento preventivo según el cultivo.

4. RIESGO DE HELADA:
   - Si T_amb < 5°C o mínima prevista < 2°C: alerta de helada.
   - Recomendar medidas de protección activa/pasiva.

5. ESTADO GENERAL DEL CULTIVO:
   - Resume en 1 frase el estado fitosanitario basado en todos los datos.
   - Si algún sensor muestra valores fuera de rango (batería baja, RSSI débil), menciónalo.

═══════════════════════════════════════════
FORMATO DE RESPUESTA
═══════════════════════════════════════════
Estructura tu respuesta así:
- 1 frase de estado general.
- Alertas activas (si las hay, sino omitir).
- Recomendación principal (riego, tratamiento, etc.).
- Próxima acción a monitorear.

Si el usuario hace una pregunta específica, responde a ella directamente usando los datos disponibles, pero aplicando siempre el protocolo de razonamiento.`;
}

export async function generateAgronomicAdvice(
  params: AgronomicPromptParams
): Promise<AgronomicAdviceResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey === "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") {
    return {
      response:
        "⚠️ El asistente AI no está configurado. Configura DEEPSEEK_API_KEY en .env para habilitar recomendaciones agronómicas.",
      tokensUsed: 0,
      raw: {
        content: "",
        tokensUsed: 0,
        model: MODEL,
        finishReason: null,
      },
    };
  }

  const systemPrompt = buildAgronomicSystemPrompt(params);

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
          { role: "user", content: params.userMessage },
        ],
        temperature: 0.6,
        max_tokens: 900,
        top_p: 0.9,
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`DeepSeek: error de conexión/timeout — ${msg}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "sin detalle");
    throw new Error(`DeepSeek API ${response.status}: ${body}`);
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { total_tokens?: number };
    model?: string;
  };

  const choice = json.choices?.[0];
  const content = choice?.message?.content?.trim() ?? "Sin respuesta del modelo.";

  const raw: DeepSeekResponse = {
    content,
    tokensUsed: json.usage?.total_tokens ?? null,
    model: json.model ?? MODEL,
    finishReason: choice?.finish_reason ?? null,
  };

  return {
    response: content,
    tokensUsed: raw.tokensUsed,
    raw,
  };
}

export function mapTriggerSource(platform: "telegram" | "whatsapp"): TriggerSource {
  return platform === "telegram" ? TriggerSource.TELEGRAM : TriggerSource.WHATSAPP;
}
