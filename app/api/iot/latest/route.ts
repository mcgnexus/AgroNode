import { NextRequest, NextResponse } from "next/server";
import { nodeCodeQuerySchema } from "@/lib/validations/iot";
import { getNodeByCode, getNodeReadings } from "@/lib/iot-db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const node_code = searchParams.get("node_code");

  const parsed = nodeCodeQuerySchema.safeParse({ node_code });
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid node_code",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const node = await getNodeByCode(parsed.data.node_code);

  if (!node) {
    return NextResponse.json(
      { ok: false, error: "Node not found" },
      { status: 404 }
    );
  }

  const readings = await getNodeReadings(parsed.data.node_code, 1);

  if (readings.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No readings found for this node" },
      { status: 404 }
    );
  }

  const reading = readings[0];

  return NextResponse.json({
    ok: true,
    data: {
      id: reading.id,
      node_id: reading.node_id,
      node_code: parsed.data.node_code,
      measured_at: reading.measured_at.toISOString(),
      air_temp_c: reading.air_temp_c?.toString() ?? null,
      air_humidity_pct: reading.air_humidity_pct?.toString() ?? null,
      pressure_hpa: reading.pressure_hpa?.toString() ?? null,
      leaf_temp_c: reading.leaf_temp_c?.toString() ?? null,
      soil_moisture_raw: reading.soil_moisture_raw,
      soil_moisture_pct: reading.soil_moisture_pct?.toString() ?? null,
      battery_v: reading.battery_v?.toString() ?? null,
      rssi_dbm: reading.rssi_dbm,
      created_at: reading.measured_at.toISOString(),
    },
  });
}