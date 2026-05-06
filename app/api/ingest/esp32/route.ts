import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sensorDataSchema } from "@/lib/validations/sensor";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-esp32-secret")
    ?? request.headers.get("authorization")?.replace("Bearer ", "");

  if (!secret || secret !== process.env.API_SECRET_ESP32) {
    return NextResponse.json(
      { error: "Unauthorized: credenciales ESP32 inválidas" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request: JSON inválido" },
      { status: 400 }
    );
  }

  const parsed = sensorDataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Bad Request: validación fallida",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const parcel = await prisma.parcel.findUnique({
    where: { id: data.parcelId },
  });

  if (!parcel) {
    return NextResponse.json(
      { error: "Not Found: parcela no encontrada" },
      { status: 404 }
    );
  }

  const record = await prisma.sensorData.create({
    data: {
      parcelId: data.parcelId,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      ambientTemp: data.ambientTemp,
      ambientHumidity: data.ambientHumidity,
      atmosphericPressure: data.atmosphericPressure,
      leafTemp: data.leafTemp,
      soilHumidity: data.soilHumidity,
      batteryLevel: data.batteryLevel,
      rssi: data.rssi,
    },
  });

  return NextResponse.json(
    {
      id: record.id,
      timestamp: record.timestamp,
      message: "Datos de sensor registrados correctamente",
    },
    { status: 201 }
  );
}
