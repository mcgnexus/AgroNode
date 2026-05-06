import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateAgronomicAdvice,
  mapTriggerSource,
  type SensorCurrentData,
  type ForecastDay,
} from "@/lib/services/deepseek.service";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? process.env.API_SECRET_ESP32;

interface NormalizedMessage {
  platform: "telegram" | "whatsapp";
  senderId: string;
  messageText: string;
  raw: Record<string, unknown>;
}

interface TelegramPayload {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
  };
}

interface TwilioPayload {
  AccountSid?: string;
  From?: string;
  To?: string;
  Body?: string;
  MessageSid?: string;
  SmsMessageSid?: string;
  NumMedia?: string;
  [key: string]: string | undefined;
}

function normalizeIncomingMessage(body: unknown): NormalizedMessage | null {
  if (!body || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;

  if ("update_id" in obj) {
    const payload = body as TelegramPayload;
    const text = payload.message?.text?.trim();
    if (!text) return null;

    return {
      platform: "telegram",
      senderId: payload.message?.from?.id?.toString() ?? payload.message?.chat?.id?.toString() ?? "unknown",
      messageText: text,
      raw: obj,
    };
  }

  if ("AccountSid" in obj || "MessageSid" in obj || "SmsMessageSid" in obj) {
    const payload = body as TwilioPayload;
    const text = payload.Body?.trim();
    if (!text) return null;

    return {
      platform: "whatsapp",
      senderId: payload.From ?? "unknown",
      messageText: text,
      raw: obj as Record<string, unknown>,
    };
  }

  return null;
}

async function resolveDefaultParcelId(): Promise<string | null> {
  const parcel = await prisma.parcel.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return parcel?.id ?? null;
}

async function fetchLatestSensorData(parcelId: string): Promise<SensorCurrentData | null> {
  const record = await prisma.sensorData.findFirst({
    where: { parcelId },
    orderBy: { timestamp: "desc" },
  });

  if (!record) return null;

  return {
    timestamp: record.timestamp,
    ambientTemp: record.ambientTemp,
    ambientHumidity: record.ambientHumidity,
    atmosphericPressure: record.atmosphericPressure,
    leafTemp: record.leafTemp,
    soilHumidity: record.soilHumidity,
    batteryLevel: record.batteryLevel,
    rssi: record.rssi,
  };
}

async function fetch3DayForecast(parcelId: string): Promise<ForecastDay[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const forecasts = await prisma.weatherForecast.findMany({
    where: {
      parcelId,
      forecastDate: { gte: today },
    },
    orderBy: { forecastDate: "asc" },
    take: 3,
  });

  return forecasts.map((f) => ({
    forecastDate: f.forecastDate,
    maxTemp: f.maxTemp,
    minTemp: f.minTemp,
    precipitationProb: f.precipitationProb,
    et0: f.et0,
  }));
}

// ─── Placeholder: envío Telegram ───────────────────────────────
// Para producción, implementa la llamada a:
// POST https://api.telegram.org/bot{TOKEN}/sendMessage
// con { chat_id, text, parse_mode: "Markdown" }
async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn(`[Telegram Placeholder] chatId=${chatId} — TELEGRAM_BOT_TOKEN no configurado`);
    console.info(`[Telegram Placeholder] Respuesta que se enviaría:\n${text}`);
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
    if (!res.ok) {
      console.error(`[Telegram] Error ${res.status}: ${await res.text()}`);
    } else {
      console.info(`[Telegram] Mensaje enviado a ${chatId}`);
    }
  } catch (err) {
    console.error(`[Telegram] Fallo de envío: ${err instanceof Error ? err.message : err}`);
  }
}

// ─── Placeholder: envío WhatsApp (Twilio) ─────────────────────
// Para producción, implementa la llamada a:
// POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
// con { To, From: "whatsapp:+NNNN", Body }
// Usando auth basic con TWILIO_ACCOUNT_SID:TWILIO_AUTH_TOKEN
async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn(`[WhatsApp Placeholder] to=${to} — Variables Twilio no configuradas`);
    console.info(`[WhatsApp Placeholder] Respuesta que se enviaría:\n${text}`);
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        To: to,
        From: `whatsapp:${fromNumber}`,
        Body: text,
      }).toString(),
    });
    if (!res.ok) {
      console.error(`[WhatsApp] Error ${res.status}: ${await res.text()}`);
    } else {
      console.info(`[WhatsApp] Mensaje enviado a ${to}`);
    }
  } catch (err) {
    console.error(`[WhatsApp] Fallo de envío: ${err instanceof Error ? err.message : err}`);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  if (WEBHOOK_SECRET) {
    const provided = request.headers.get("x-webhook-secret")
      ?? request.nextUrl.searchParams.get("hub.verify_token");
    if (provided && provided !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    } else {
      body = await request.json();
    }
  } catch {
    return NextResponse.json({ error: "Bad Request: payload inválido" }, { status: 400 });
  }

  const normalized = normalizeIncomingMessage(body);
  if (!normalized) {
    console.warn("[Webhook] Payload no reconocido:", JSON.stringify(body).slice(0, 200));
    return NextResponse.json({ error: "Bad Request: payload no reconocido" }, { status: 400 });
  }

  console.info(
    `[Webhook] ${normalized.platform} | from=${normalized.senderId} | msg="${normalized.messageText.slice(0, 80)}"`
  );

  const parcelId = await resolveDefaultParcelId();
  if (!parcelId) {
    const errReply = "⚠️ No hay parcelas registradas en el sistema. Contacta al administrador.";
    if (normalized.platform === "telegram") {
      await sendTelegramMessage(normalized.senderId, errReply);
    } else {
      await sendWhatsAppMessage(normalized.senderId, errReply);
    }
    return NextResponse.json({ status: "no_parcels" }, { status: 200 });
  }

  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    select: { id: true, name: true, cropType: true, latitude: true, longitude: true },
  });
  if (!parcel) {
    return NextResponse.json({ error: "Parcela no encontrada" }, { status: 500 });
  }

  const [sensorData, forecast] = await Promise.all([
    fetchLatestSensorData(parcelId),
    fetch3DayForecast(parcelId),
  ]);

  if (!sensorData) {
    const errReply = "⚠️ No hay datos de sensor disponibles para tu parcela. Verifica que el nodo IoT esté enviando datos.";
    if (normalized.platform === "telegram") {
      await sendTelegramMessage(normalized.senderId, errReply);
    } else {
      await sendWhatsAppMessage(normalized.senderId, errReply);
    }
    return NextResponse.json({ status: "no_sensor_data" }, { status: 200 });
  }

  let aiResponse: string;
  let tokensUsed: number | null = null;

  try {
    const result = await generateAgronomicAdvice({
      parcelId: parcel.id,
      parcelName: parcel.name,
      cropType: parcel.cropType,
      latitude: parcel.latitude,
      longitude: parcel.longitude,
      sensorData,
      forecast,
      userMessage: normalized.messageText,
    });

    aiResponse = result.response;
    tokensUsed = result.tokensUsed;
  } catch (err) {
    console.error("[Webhook] Error DeepSeek:", err);
    aiResponse = "❌ Error al consultar el asistente agrícola. Intenta de nuevo en unos minutos.";
  }

  const triggerSource = mapTriggerSource(normalized.platform);

  await prisma.aiInteractionLog.create({
    data: {
      parcelId: parcel.id,
      timestamp: new Date(),
      triggerSource,
      injectedContext: {
        platform: normalized.platform,
        senderId: normalized.senderId,
        sensor: {
          ambientTemp: sensorData.ambientTemp,
          ambientHumidity: sensorData.ambientHumidity,
          leafTemp: sensorData.leafTemp,
          soilHumidity: sensorData.soilHumidity,
          atmosphericPressure: sensorData.atmosphericPressure,
          deltaT: +(sensorData.leafTemp - sensorData.ambientTemp).toFixed(1),
        },
        forecastDays: forecast.length,
      },
      prompt: normalized.messageText,
      llmResponse: aiResponse,
      tokensUsed,
    },
  });

  if (normalized.platform === "telegram") {
    await sendTelegramMessage(normalized.senderId, aiResponse);
  } else {
    await sendWhatsAppMessage(normalized.senderId, aiResponse);
  }

  const elapsed = Date.now() - startTime;
  console.info(
    `[Webhook] Completado | ${normalized.platform} | ${elapsed}ms | tokens=${tokensUsed ?? "n/a"}`
  );

  return NextResponse.json(
    {
      status: "ok",
      platform: normalized.platform,
      elapsedMs: elapsed,
      tokensUsed,
    },
    { status: 200 }
  );
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && WEBHOOK_SECRET && token === WEBHOOK_SECRET) {
    console.info("[Webhook] Verificación de webhook exitosa");
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json(
    {
      status: "ready",
      endpoints: {
        telegram: "POST with Telegram Update payload",
        whatsapp: "POST with Twilio webhook payload (form-urlencoded)",
      },
    },
    { status: 200 }
  );
}
