import { mapCropType, CROPS } from "@/lib/services/irrigation.service";
import { prisma } from "@/lib/prisma";
import { consultarAlertasRaif, type RaifAlert } from "@/lib/services/raif.service";
import { randomUUID } from "node:crypto";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

export type RaifSeverity = "low" | "medium" | "high";

export interface RaifParcelAlert {
  title: string;
  date: string;
  url?: string;
  source: string;
  severity: RaifSeverity;
  reason: string;
  recommendation: string;
  matchedTerms: string[];
  signature: string;
}

export interface RaifParcelAlertEvaluation {
  parcelId: string;
  parcelName: string;
  cropName: string;
  province?: string;
  fromCache: boolean;
  totalCandidates: number;
  highAlerts: RaifParcelAlert[];
  alerts: RaifParcelAlert[];
}

const CROP_TERMS: Record<string, string[]> = {
  olive: ["olivar", "olivo", "aceituna", "repilo", "verticilosis", "mosca del olivo"],
  almond: ["almendro", "almendra", "anarsia", "monilia"],
  avocado: ["aguacate", "palto", "phytophthora", "tristeza"],
  citrus: ["citricos", "naranjo", "limonero", "cotonet", "trips", "mosca blanca"],
  vegetable: ["horticola", "hortaliza", "tomate", "pimiento", "pepino", "mildiu", "botritis"],
  cereal: ["cereal", "trigo", "cebada", "fusarium", "roya"],
  pistachio: ["pistacho", "alternaria", "botrytis"],
  vineyard: ["vid", "vinedo", "uva", "mildiu", "oidio", "botritis"],
};

const PROVINCES = ["Almería", "Cádiz", "Córdoba", "Granada", "Huelva", "Jaén", "Málaga", "Sevilla"];

const HIGH_KEYWORDS = [
  "alerta",
  "brote",
  "foco",
  "xylella",
  "cuarentena",
  "emergencia",
  "obligatorio",
  "virus",
  "mildiu",
  "botritis",
  "mosca",
  "trips",
];

function normalize(text?: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectProvince(text: string): string | undefined {
  const norm = normalize(text);
  for (const province of PROVINCES) {
    if (norm.includes(normalize(province))) return province;
  }
  return undefined;
}

function detectParcelProvince(parcel: {
  municipioNombre: string | null;
  zone: string | null;
  microclimate: string | null;
  name: string;
}): string | undefined {
  const joined = [parcel.municipioNombre, parcel.zone, parcel.microclimate, parcel.name]
    .filter(Boolean)
    .join(" ");
  return detectProvince(joined);
}

function signatureForAlert(alert: Pick<RaifAlert, "alerta" | "fecha" | "fuente">): string {
  return normalize(`${alert.alerta}|${alert.fecha}|${alert.fuente}`);
}

function heuristicSeverity(title: string): RaifSeverity {
  const norm = normalize(title);
  const matches = HIGH_KEYWORDS.filter((k) => norm.includes(normalize(k))).length;
  if (matches >= 2) return "high";
  if (matches >= 1) return "medium";
  return "low";
}

function extractJsonObject(raw: string): string | null {
  const codeFence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = codeFence ? codeFence[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

async function classifyWithDeepseek(
  parcelName: string,
  cropName: string,
  province: string | undefined,
  alerts: { title: string; matchedTerms: string[] }[]
): Promise<Record<string, { severity: RaifSeverity; reason: string; recommendation: string }>> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return {};

  const payload = {
    model: DEEPSEEK_MODEL,
    temperature: 0.1,
    max_tokens: 1200,
    messages: [
      {
        role: "system",
        content:
          "Eres un asesor fitosanitario para Andalucía. Devuelve SOLO JSON válido sin texto adicional.",
      },
      {
        role: "user",
        content: [
          `Parcela: ${parcelName}`,
          `Cultivo: ${cropName}`,
          `Provincia: ${province ?? "Andalucía"}`,
          "Clasifica estas alertas RAIF por severidad para este cultivo y ubicación.",
          "Responde estrictamente con JSON con forma:",
          '{"items":[{"title":"...","severity":"low|medium|high","reason":"...","recommendation":"..."}]}',
          `Alertas: ${JSON.stringify(alerts)}`,
        ].join("\n"),
      },
    ],
  };

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek ${response.status}: ${(await response.text()).substring(0, 160)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  const jsonText = extractJsonObject(content);
  if (!jsonText) return {};

  const parsed = JSON.parse(jsonText) as {
    items?: Array<{
      title?: string;
      severity?: RaifSeverity;
      reason?: string;
      recommendation?: string;
    }>;
  };

  const mapped: Record<string, { severity: RaifSeverity; reason: string; recommendation: string }> = {};
  for (const item of parsed.items ?? []) {
    if (!item.title) continue;
    const sev = item.severity === "high" || item.severity === "medium" || item.severity === "low"
      ? item.severity
      : "medium";
    mapped[normalize(item.title)] = {
      severity: sev,
      reason: item.reason?.trim() || "Clasificación IA",
      recommendation: item.recommendation?.trim() || "Revisar boletín RAIF y plan fitosanitario.",
    };
  }
  return mapped;
}

function getDefaultRecommendation(cropName: string): string {
  return `Revisar foco en ${cropName}, confirmar síntomas en campo y ajustar tratamiento según RAIF/asesor técnico.`;
}

export async function evaluateRaifAlertsForParcel(parcelId: string): Promise<RaifParcelAlertEvaluation | null> {
  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    select: {
      id: true,
      name: true,
      cropType: true,
      municipioNombre: true,
      zone: true,
      microclimate: true,
    },
  });

  if (!parcel) return null;

  const cropId = mapCropType(parcel.cropType);
  const crop = CROPS[cropId] ?? CROPS.olive;
  const province = detectParcelProvince(parcel);
  const cropTerms = CROP_TERMS[cropId] ?? [crop.nameEs.toLowerCase()];

  const raif = await consultarAlertasRaif(province);
  if (!raif.ok || raif.alertas.length === 0) {
    return {
      parcelId: parcel.id,
      parcelName: parcel.name,
      cropName: crop.nameEs,
      province,
      fromCache: raif.fromCache,
      totalCandidates: 0,
      highAlerts: [],
      alerts: [],
    };
  }

  const municipioTerm = normalize(parcel.municipioNombre ?? "");
  const provinceTerm = normalize(province);

  const candidates = raif.alertas
    .map((alert) => {
      const text = normalize(alert.alerta);
      const matchedTerms = cropTerms.filter((term) => text.includes(normalize(term)));
      const byLocation = Boolean(
        (provinceTerm && text.includes(provinceTerm)) || (municipioTerm && text.includes(municipioTerm))
      );
      return { alert, matchedTerms, byLocation };
    })
    .filter((x) => x.matchedTerms.length > 0 || x.byLocation)
    .slice(0, 12);

  if (candidates.length === 0) {
    return {
      parcelId: parcel.id,
      parcelName: parcel.name,
      cropName: crop.nameEs,
      province,
      fromCache: raif.fromCache,
      totalCandidates: 0,
      highAlerts: [],
      alerts: [],
    };
  }

  let deepseekClassification: Record<string, { severity: RaifSeverity; reason: string; recommendation: string }> = {};
  try {
    deepseekClassification = await classifyWithDeepseek(
      parcel.name,
      crop.nameEs,
      province,
      candidates.map((c) => ({ title: c.alert.alerta, matchedTerms: c.matchedTerms }))
    );
  } catch (error) {
    console.warn("RAIF DeepSeek classification fallback to heuristics:", error);
  }

  const alerts: RaifParcelAlert[] = candidates.map(({ alert, matchedTerms }) => {
    const key = normalize(alert.alerta);
    const ai = deepseekClassification[key];
    const sev = ai?.severity ?? heuristicSeverity(alert.alerta);
    return {
      title: alert.alerta,
      date: alert.fecha,
      url: alert.url,
      source: alert.fuente,
      severity: sev,
      reason: ai?.reason ?? "Coincidencia con cultivo/zona y patrón de riesgo fitosanitario.",
      recommendation: ai?.recommendation ?? getDefaultRecommendation(crop.nameEs),
      matchedTerms,
      signature: signatureForAlert(alert),
    };
  });

  const rank: Record<RaifSeverity, number> = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return {
    parcelId: parcel.id,
    parcelName: parcel.name,
    cropName: crop.nameEs,
    province,
    fromCache: raif.fromCache,
    totalCandidates: alerts.length,
    highAlerts: alerts.filter((a) => a.severity === "high"),
    alerts,
  };
}

export async function wasRaifAlertRecentlyNotified(
  parcelId: string,
  signature: string,
  cooldownHours: number
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM "RaifNotificationLog"
      WHERE "parcelId" = ${parcelId}
        AND "signature" = ${signature}
        AND "sentAt" >= ${since}
    `;
    return Number(rows[0]?.count ?? 0) > 0;
  } catch (error) {
    console.warn("RaifNotificationLog no disponible para consulta:", error);
    return false;
  }
}

export async function recordRaifNotification(
  parcelId: string,
  alert: Pick<RaifParcelAlert, "signature" | "title">,
  channelsSent: number
): Promise<void> {
  const id = randomUUID();
  const sentDay = new Date().toISOString().split("T")[0];
  try {
    await prisma.$executeRaw`
      INSERT INTO "RaifNotificationLog"
        ("id", "parcelId", "signature", "alertTitle", "sentDay", "channelsSent", "sentAt", "createdAt")
      VALUES
        (${id}, ${parcelId}, ${alert.signature}, ${alert.title}, ${sentDay}, ${channelsSent}, NOW(), NOW())
      ON CONFLICT ("parcelId", "signature", "sentDay") DO NOTHING
    `;
  } catch (error) {
    console.warn("No se pudo registrar notificación RAIF:", error);
  }
}
