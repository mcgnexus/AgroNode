import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const parcel = await prisma.parcel.findUnique({ where: { id } });
  if (!parcel) {
    return NextResponse.json({ error: "Parcela no encontrada" }, { status: 404 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const forecasts = await prisma.weatherForecast.findMany({
    where: { parcelId: id, forecastDate: { gte: today } },
    orderBy: [{ forecastDate: "asc" }, { source: "asc" }],
  });

  const bySource = new Map<string, typeof forecasts>();
  for (const f of forecasts) {
    if (!bySource.has(f.source)) bySource.set(f.source, []);
    bySource.get(f.source)!.push(f);
  }

  const sources: Record<string, typeof forecasts> = {};
  for (const [source, items] of bySource) {
    sources[source] = items;
  }

  return NextResponse.json({
    all: forecasts,
    sources,
  });
}
