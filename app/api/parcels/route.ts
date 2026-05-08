import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncForecastForParcel } from "@/lib/services/weather.service";
import { getNodeReadingCount, getNodeLatestReading } from "@/lib/iot-db";

export async function GET() {
  const parcels = await prisma.parcel.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      cropType: true,
      locationId: true,
      municipioId: true,
      municipioNombre: true,
      zone: true,
      microclimate: true,
      description: true,
      irrigationType: true,
      nodeCode: true,
      createdAt: true,
      _count: { select: { sensorData: true } },
    },
  });

  const parcelIds = parcels.map((p) => p.id);

  const lastReadings = await prisma.sensorData.findMany({
    where: { parcelId: { in: parcelIds } },
    orderBy: { timestamp: "desc" },
    distinct: ["parcelId"],
    select: {
      parcelId: true,
      id: true,
      timestamp: true,
      ambientTemp: true,
      ambientHumidity: true,
      soilHumidity: true,
    },
  });

  const readingsMap = new Map(lastReadings.map((r) => [r.parcelId, r]));

  // Fallback a IoT DB para parcelas con nodeCode y sin SensorData en Prisma
  const iotFallbackMap = new Map<
    string,
    { totalReadings: number; lastReading: { timestamp: Date; ambientTemp: number; ambientHumidity: number; soilHumidity: number } | null }
  >();

  await Promise.all(
    parcels.map(async (p) => {
      if (p.nodeCode && p._count.sensorData === 0) {
        const [count, latest] = await Promise.all([
          getNodeReadingCount(p.nodeCode),
          getNodeLatestReading(p.nodeCode),
        ]);
        iotFallbackMap.set(p.id, {
          totalReadings: count,
          lastReading: latest
            ? {
                timestamp: latest.measured_at,
                ambientTemp: latest.air_temp_c ?? 0,
                ambientHumidity: latest.air_humidity_pct ?? 0,
                soilHumidity: latest.soil_moisture_pct ?? 0,
              }
            : null,
        });
      }
    })
  );

  const result = parcels.map((p) => {
    const fallback = iotFallbackMap.get(p.id);
    return {
      id: p.id,
      name: p.name,
      latitude: p.latitude,
      longitude: p.longitude,
      cropType: p.cropType,
      locationId: p.locationId,
      municipioId: p.municipioId,
      municipioNombre: p.municipioNombre,
      zone: p.zone,
      microclimate: p.microclimate,
      description: p.description,
      irrigationType: p.irrigationType,
      nodeCode: p.nodeCode,
      createdAt: p.createdAt,
      totalReadings: fallback?.totalReadings ?? p._count.sensorData,
      lastReading: readingsMap.get(p.id) ?? fallback?.lastReading ?? null,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      latitude,
      longitude,
      cropType,
      locationId,
      municipioId,
      municipioNombre,
      zone,
      microclimate,
      description,
      irrigationType,
      nodeCode,
    } = body;

    if (!name || latitude === undefined || longitude === undefined || !cropType) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: name, latitude, longitude, cropType" },
        { status: 400 }
      );
    }

    const parcel = await prisma.parcel.create({
      data: {
        name,
        latitude,
        longitude,
        cropType,
        locationId: locationId ?? null,
        municipioId: municipioId ?? null,
        municipioNombre: municipioNombre ?? null,
        zone: zone ?? null,
        microclimate: microclimate ?? null,
        description: description ?? null,
        irrigationType: irrigationType ?? null,
        nodeCode: nodeCode ?? null,
      },
    });

    try {
      await syncForecastForParcel(parcel.id);
    } catch (error) {
      console.error("Error syncing forecast for new parcel:", error);
    }

    return NextResponse.json(parcel, { status: 201 });
  } catch (error) {
    console.error("Error creating parcel:", error);
    return NextResponse.json(
      { error: "Error al crear la parcela" },
      { status: 500 }
    );
  }
}
