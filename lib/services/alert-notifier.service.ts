import type { WeatherAlert } from "@/lib/services/weather-alerts.service";
import { buildAlertSignature, formatAlertDate, type ParcelWeatherAlertEvaluation } from "@/lib/services/parcel-weather-alerts.service";

type Channel = "telegram" | "whatsapp";

export interface NotificationAttempt {
  channel: Channel;
  target: string;
  ok: boolean;
  error?: string;
}

export interface NotificationResult {
  notified: boolean;
  reason?: string;
  attempts: NotificationAttempt[];
  cooldownHours: number;
}

type NotificationState = {
  sentByKey: Map<string, number>;
};

const GLOBAL_STATE_KEY = "__agronode_alert_notification_state__";

function getState(): NotificationState {
  const globalObj = globalThis as typeof globalThis & {
    [GLOBAL_STATE_KEY]?: NotificationState;
  };

  if (!globalObj[GLOBAL_STATE_KEY]) {
    globalObj[GLOBAL_STATE_KEY] = { sentByKey: new Map<string, number>() };
  }

  return globalObj[GLOBAL_STATE_KEY];
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeWhatsAppTo(raw: string): string {
  if (raw.startsWith("whatsapp:")) return raw;
  if (raw.startsWith("+")) return `whatsapp:${raw}`;
  return `whatsapp:+${raw}`;
}

function getCooldownHours(): number {
  const parsed = Number.parseInt(process.env.ALERT_NOTIFY_COOLDOWN_HOURS ?? "12", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 12;
  return parsed;
}

function buildHighAlertMessage(input: ParcelWeatherAlertEvaluation): string {
  const lines: string[] = [];
  lines.push("ALERTA METEOROLÓGICA ALTA");
  lines.push(`Parcela: ${input.parcelName}`);
  lines.push(`Cultivo: ${input.cropName}`);
  lines.push(`Zona: ${input.zoneLabel}`);
  lines.push(`Fecha: ${formatAlertDate()}`);
  lines.push("");
  lines.push("Alertas:");

  for (const alert of input.highAlerts) {
    const trigger = alert.triggerValue ? ` (${alert.triggerValue})` : "";
    lines.push(`- ${alert.title}${trigger}`);
    lines.push(`  ${alert.recommendation}`);
  }

  return lines.join("\n");
}

async function sendTelegramMessage(chatId: string, text: string): Promise<NotificationAttempt> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { channel: "telegram", target: chatId, ok: false, error: "TELEGRAM_BOT_TOKEN no configurado" };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });

    if (!response.ok) {
      return {
        channel: "telegram",
        target: chatId,
        ok: false,
        error: `Telegram ${response.status}: ${(await response.text()).substring(0, 200)}`,
      };
    }

    return { channel: "telegram", target: chatId, ok: true };
  } catch (error) {
    return {
      channel: "telegram",
      target: chatId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function sendWhatsAppMessage(to: string, text: string): Promise<NotificationAttempt> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    return { channel: "whatsapp", target: to, ok: false, error: "Credenciales de Twilio no configuradas" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        To: normalizeWhatsAppTo(to),
        From: `whatsapp:${fromNumber}`,
        Body: text,
      }).toString(),
    });

    if (!response.ok) {
      return {
        channel: "whatsapp",
        target: to,
        ok: false,
        error: `Twilio ${response.status}: ${(await response.text()).substring(0, 200)}`,
      };
    }

    return { channel: "whatsapp", target: to, ok: true };
  } catch (error) {
    return {
      channel: "whatsapp",
      target: to,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function notifyHighAlerts(input: ParcelWeatherAlertEvaluation): Promise<NotificationResult> {
  const cooldownHours = getCooldownHours();

  if (input.highAlerts.length === 0) {
    return { notified: false, reason: "Sin alertas high", attempts: [], cooldownHours };
  }

  const telegramTargets = parseCsv(process.env.ALERTS_TELEGRAM_CHAT_IDS);
  const whatsappTargets = parseCsv(process.env.ALERTS_WHATSAPP_TO);
  if (telegramTargets.length === 0 && whatsappTargets.length === 0) {
    return { notified: false, reason: "Sin destinatarios configurados", attempts: [], cooldownHours };
  }

  const signature = buildAlertSignature(input.highAlerts);
  const dedupeKey = `${input.parcelId}:${signature}`;
  const now = Date.now();
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const lastSentAt = getState().sentByKey.get(dedupeKey) ?? 0;
  if (now - lastSentAt < cooldownMs) {
    return { notified: false, reason: "En cooldown", attempts: [], cooldownHours };
  }

  const message = buildHighAlertMessage(input);
  const attempts = await Promise.all([
    ...telegramTargets.map((target) => sendTelegramMessage(target, message)),
    ...whatsappTargets.map((target) => sendWhatsAppMessage(target, message)),
  ]);

  const hasSuccess = attempts.some((a) => a.ok);
  if (hasSuccess) {
    getState().sentByKey.set(dedupeKey, now);
  }

  return {
    notified: hasSuccess,
    reason: hasSuccess ? undefined : "Error de envío",
    attempts,
    cooldownHours,
  };
}

export function summarizeHighAlerts(alerts: WeatherAlert[]): string {
  return alerts.map((a) => `${a.type}:${a.title}`).join("; ");
}
