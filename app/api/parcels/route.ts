import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncForecastForParcel } from "@/lib/services/weather.service";

export async function GET() {
  const parcels = await prisma.parcel.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { sensorData: true } },
      sensorData: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  const result = parcels.map((p) => ({
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
    createdAt: p.createdAt,
    totalReadings: p._count.sensorData,
    lastReading: p.sensorData[0] ?? null,
  }));

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
