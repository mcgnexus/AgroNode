import { NextRequest, NextResponse } from "next/server";
import { ingestReadingSchema } from "@/lib/validations/iot";
import { getNodeByCode, createReading } from "@/lib/iot-db";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const parsed = ingestReadingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid data",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const { node_code, token, air_temp_c, air_humidity_pct, pressure_hpa, leaf_temp_c, soil_moisture_raw, soil_moisture_pct, battery_v, rssi_dbm, measured_at } = parsed.data;

  const node = await getNodeByCode(node_code);

  if (!node || !node.active || node.api_token !== token) {
    return NextResponse.json(
      { ok: false, error: "Node not found, inactive, or invalid token" },
      { status: 401 }
    );
  }

  try {
    const reading = await createReading({
      node_id: node.id,
      measured_at: measured_at ? new Date(measured_at) : new Date(),
      air_temp_c,
      air_humidity_pct,
      pressure_hpa,
      leaf_temp_c,
      soil_moisture_raw,
      soil_moisture_pct,
      battery_v,
      rssi_dbm,
    });

    // Duplicar lectura en SensorData (DB principal) si el nodo está vinculado a una parcela
    const parcel = await prisma.parcel.findUnique({
      where: { nodeCode: node_code },
    });

    if (parcel) {
      try {
        await prisma.sensorData.create({
          data: {
            parcelId: parcel.id,
            timestamp: reading.measured_at,
            ambientTemp: air_temp_c ?? 0,
            ambientHumidity: air_humidity_pct ?? 0,
            atmosphericPressure: pressure_hpa ?? 0,
            leafTemp: leaf_temp_c ?? 0,
            soilHumidity: soil_moisture_pct ?? 0,
            batteryLevel: battery_v ?? null,
            rssi: rssi_dbm ?? null,
          },
        });
      } catch (syncError) {
        console.error("Error duplicando lectura en SensorData:", syncError);
        // No fallar la ingesta principal por error de duplicado
      }
    }

    return NextResponse.json(
      {
        ok: true,
        reading_id: reading.id,
        measured_at: reading.measured_at.toISOString(),
        received_at: reading.created_at.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating reading:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}