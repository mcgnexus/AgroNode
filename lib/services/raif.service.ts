import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

const RAIF_URL =
  "https://www.juntadeandalucia.es/agriculturapescaaguaydesarrollorural/raif/";
const RAIF_CACHE_TTL_HOURS = Number(process.env.RAIF_CACHE_TTL_HOURS ?? 2);
const REQUEST_TIMEOUT_MS = 15_000;

export interface RaifAlert {
  fecha: string;
  alerta: string;
  url?: string;
  fuente: "Actualidad Fitosanitaria" | "Noticias" | "Desconocida";
}

export interface RaifQueryResult {
  ok: boolean;
  alertas: RaifAlert[];
  error?: string;
  totalEncontradas: number;
  totalFiltradas: number;
  fromCache: boolean;
  cachedAt?: string;
}

function normalize(text?: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeFilter(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatDateEs(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function matchesFilter(alert: RaifAlert, province?: string, crop?: string): boolean {
  const text = normalize(alert.alerta);
  const p = normalize(province);
  const c = normalize(crop);
  return (!p || text.includes(p)) && (!c || text.includes(c));
}

function extractDate($: cheerio.CheerioAPI, el: AnyNode): string {
  const parent = $(el).closest("article, .post, .entry, li, div");

  const time = parent.find("time").first();
  if (time.length > 0) {
    const dt = time.attr("datetime");
    if (dt) {
      const parsed = new Date(dt);
      if (!Number.isNaN(parsed.getTime())) return formatDateEs(parsed);
    }
    const text = time.text().trim();
    if (text) return text;
  }

  const altDate = parent
    .find(".fecha, .date, .entry-date, .post-date, .published")
    .first()
    .text()
    .trim();
  if (altDate) return altDate;

  return formatDateEs(new Date());
}

async function scrapeRaif(province?: string, crop?: string): Promise<RaifQueryResult> {
  try {
    const response = await fetch(RAIF_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AgroNode-RAIF/1.0)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`RAIF HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const alerts: RaifAlert[] = [];

    $("h3 a").each((_, element) => {
      const title = $(element).text().trim();
      const href = $(element).attr("href")?.trim() ?? "";
      if (!title || title.length < 10) return;
      if (alerts.some((a) => a.alerta === title)) return;
      const url = href ? new URL(href, RAIF_URL).toString() : undefined;
      alerts.push({
        fecha: extractDate($, element),
        alerta: title,
        url,
        fuente: "Actualidad Fitosanitaria",
      });
    });

    $("h3").each((_, element) => {
      const title = $(element).text().trim();
      if (!title || title.length < 10) return;
      if (alerts.some((a) => a.alerta === title)) return;

      const parentText = $(element).closest("article, section, div").text().toLowerCase();
      const source = parentText.includes("noticias") ? "Noticias" : "Actualidad Fitosanitaria";
      alerts.push({
        fecha: extractDate($, element),
        alerta: title,
        fuente: source,
      });
    });

    if (alerts.length === 0) {
      $(".entry-title, .post-title, .news-title, article h2").each((_, element) => {
        const title = $(element).text().trim();
        if (!title || title.length < 10) return;
        alerts.push({
          fecha: formatDateEs(new Date()),
          alerta: title,
          fuente: "Desconocida",
        });
      });
    }

    const filtered = (province || crop)
      ? alerts.filter((alert) => matchesFilter(alert, province, crop))
      : alerts;

    if (filtered.length === 0 && (province || crop)) {
      return {
        ok: true,
        alertas: alerts.slice(0, 10),
        totalEncontradas: alerts.length,
        totalFiltradas: 0,
        error: `No se encontraron alertas específicas para "${province ?? ""}${crop ? ` / ${crop}` : ""}". Se muestran alertas generales.`,
        fromCache: false,
      };
    }

    return {
      ok: true,
      alertas: filtered.slice(0, 20),
      totalEncontradas: alerts.length,
      totalFiltradas: filtered.length,
      fromCache: false,
    };
  } catch (error) {
    return {
      ok: false,
      alertas: [],
      totalEncontradas: 0,
      totalFiltradas: 0,
      error: error instanceof Error ? error.message : "Error desconocido consultando RAIF",
      fromCache: false,
    };
  }
}

async function getFromCache(province?: string, crop?: string): Promise<RaifQueryResult | null> {
  const rows = await prisma.$queryRaw<Array<{
    title: string;
    url: string | null;
    source: string;
    "alertDate": string;
    province: string | null;
    crop: string | null;
    "scrapedAt": Date;
  }>>`
    SELECT "title", "url", "source", "alertDate", "province", "crop", "scrapedAt"
    FROM "RaifAlertCache"
    WHERE "expiresAt" > NOW()
    ORDER BY "scrapedAt" DESC
    LIMIT 80
  `;

  if (rows.length === 0) return null;

  const normProvince = normalizeFilter(province);
  const normCrop = normalizeFilter(crop);
  const mapped: RaifAlert[] = rows.map((row) => ({
    fecha: row.alertDate,
    alerta: row.title,
    url: row.url ?? undefined,
    fuente: row.source as RaifAlert["fuente"],
  }));

  const filtered = mapped.filter((alert, i) => {
    const row = rows[i];
    const dbScopeOk =
      (row.province === null && row.crop === null) ||
      ((normProvince === null || row.province === normProvince) &&
        (normCrop === null || row.crop === normCrop));
    if (!dbScopeOk) return false;
    return (province || crop) ? matchesFilter(alert, province, crop) : true;
  });

  if (filtered.length === 0) return null;

  return {
    ok: true,
    alertas: filtered.slice(0, 20),
    totalEncontradas: rows.length,
    totalFiltradas: filtered.length,
    fromCache: true,
    cachedAt: formatDateEs(rows[0].scrapedAt),
  };
}

async function saveToCache(alerts: RaifAlert[], province?: string, crop?: string): Promise<void> {
  if (alerts.length === 0) return;

  const expiresAt = new Date(Date.now() + RAIF_CACHE_TTL_HOURS * 60 * 60 * 1000);
  const normProvince = normalizeFilter(province);
  const normCrop = normalizeFilter(crop);

  for (const alert of alerts) {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "RaifAlertCache"
        ("id", "title", "url", "source", "alertDate", "province", "crop", "scrapedAt", "expiresAt", "createdAt")
      VALUES
        (${id}, ${alert.alerta}, ${alert.url ?? null}, ${alert.fuente}, ${alert.fecha}, ${normProvince}, ${normCrop}, NOW(), ${expiresAt}, NOW())
      ON CONFLICT DO NOTHING
    `;
  }

  await prisma.$executeRaw`
    DELETE FROM "RaifAlertCache"
    WHERE "expiresAt" < NOW()
  `;
}

export async function consultarAlertasRaif(province?: string, crop?: string): Promise<RaifQueryResult> {
  try {
    const fromCache = await getFromCache(province, crop);
    if (fromCache) return fromCache;
  } catch (error) {
    console.warn("RAIF cache read failed, fallback a scraping:", error);
  }

  const scraped = await scrapeRaif(province, crop);
  if (scraped.ok && scraped.alertas.length > 0) {
    try {
      await saveToCache(scraped.alertas, province, crop);
    } catch (error) {
      console.warn("RAIF cache write failed:", error);
    }
  }

  return scraped;
}
