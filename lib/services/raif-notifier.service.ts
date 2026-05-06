import {
  recordRaifNotification,
  wasRaifAlertRecentlyNotified,
  type RaifParcelAlertEvaluation,
} from "@/lib/services/raif-alert-agent.service";

type Channel = "telegram" | "whatsapp";

export interface RaifNotificationAttempt {
  channel: Channel;
  target: string;
  ok: boolean;
  error?: string;
}

export interface RaifNotificationResult {
  notified: boolean;
  reason?: string;
  cooldownHours: number;
  alertsNotified: number;
  attempts: RaifNotificationAttempt[];
}

function parseCsv(value?: string): string[] {
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
  const parsed = Number.parseInt(
    process.env.RAIF_ALERT_NOTIFY_COOLDOWN_HOURS ?? process.env.ALERT_NOTIFY_COOLDOWN_HOURS ?? "12",
    10
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
}

function buildMessage(input: RaifParcelAlertEvaluation): string {
  const lines: string[] = [];
  lines.push("ALERTA RAIF (SEVERIDAD ALTA)");
  lines.push(`Parcela: ${input.parcelName}`);
  lines.push(`Cultivo: ${input.cropName}`);
  if (input.province) lines.push(`Provincia: ${input.province}`);
  lines.push("");
  lines.push("Coincidencias:");
  for (const alert of input.highAlerts) {
    lines.push(`- ${alert.title}`);
    lines.push(`  Fecha: ${alert.date} · Fuente: ${alert.source}`);
    lines.push(`  Acción: ${alert.recommendation}`);
    if (alert.url) lines.push(`  URL: ${alert.url}`);
  }
  return lines.join("\n");
}

async function sendTelegramMessage(chatId: string, text: string): Promise<RaifNotificationAttempt> {
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
      body: JSON.stringify({ chat_id: chatId, text }),
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

async function sendWhatsAppMessage(to: string, text: string): Promise<RaifNotificationAttempt> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    return { channel: "whatsapp", target: to, ok: false, error: "Credenciales Twilio no configuradas" };
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

export async function notifyRaifHighAlerts(input: RaifParcelAlertEvaluation): Promise<RaifNotificationResult> {
  const cooldownHours = getCooldownHours();
  if (input.highAlerts.length === 0) {
    return { notified: false, reason: "Sin alertas high", cooldownHours, alertsNotified: 0, attempts: [] };
  }

  const telegramTargets = parseCsv(process.env.ALERTS_TELEGRAM_CHAT_IDS);
  const whatsappTargets = parseCsv(process.env.ALERTS_WHATSAPP_TO);
  if (telegramTargets.length === 0 && whatsappTargets.length === 0) {
    return { notified: false, reason: "Sin destinatarios configurados", cooldownHours, alertsNotified: 0, attempts: [] };
  }

  const pendingAlerts = [];
  for (const alert of input.highAlerts) {
    const recentlySent = await wasRaifAlertRecentlyNotified(input.parcelId, alert.signature, cooldownHours);
    if (!recentlySent) pendingAlerts.push(alert);
  }

  if (pendingAlerts.length === 0) {
    return { notified: false, reason: "En cooldown", cooldownHours, alertsNotified: 0, attempts: [] };
  }

  const message = buildMessage({
    ...input,
    highAlerts: pendingAlerts,
  });

  const attempts = await Promise.all([
    ...telegramTargets.map((target) => sendTelegramMessage(target, message)),
    ...whatsappTargets.map((target) => sendWhatsAppMessage(target, message)),
  ]);

  const sentCount = attempts.filter((x) => x.ok).length;
  if (sentCount > 0) {
    for (const alert of pendingAlerts) {
      await recordRaifNotification(input.parcelId, alert, sentCount);
    }
  }

  return {
    notified: sentCount > 0,
    reason: sentCount > 0 ? undefined : "Error de envío",
    cooldownHours,
    alertsNotified: pendingAlerts.length,
    attempts,
  };
}
