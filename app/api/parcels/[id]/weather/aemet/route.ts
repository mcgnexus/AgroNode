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

  const hourlyData = await prisma.aemetHourlyForecast.findMany({
    where: { parcelId: id, forecastDate: { gte: today } },
    orderBy: [{ forecastDate: "asc" }, { hour: "asc" }],
  });

  if (hourlyData.length === 0) {
    return NextResponse.json({ hourly: [], municipio: null });
  }

  const municipioNombre = hourlyData[0].municipioNombre;
  const municipioId = hourlyData[0].municipioId;

  const grouped = new Map<string, typeof hourlyData>();
  for (const h of hourlyData) {
    const key = h.forecastDate.toISOString();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(h);
  }

  const days = Array.from(grouped.entries()).map(([date, hours]) => ({
    date,
    hours: hours.map(h => ({
      hour: h.hour,
      temperature: h.temperature,
      precipitationProb: h.precipitationProb,
      humidity: h.humidity,
      windSpeed: h.windSpeed,
      windDirection: h.windDirection,
      skyState: h.skyState,
    })),
  }));

  return NextResponse.json({
    hourly: days,
    municipio: { id: municipioId, nombre: municipioNombre },
  });
}
