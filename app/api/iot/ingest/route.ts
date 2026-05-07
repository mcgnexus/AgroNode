import { NextRequest, NextResponse } from "next/server";
import { ingestReadingSchema } from "@/lib/validations/iot";
import { getNodeByCode, createReading } from "@/lib/iot-db";

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