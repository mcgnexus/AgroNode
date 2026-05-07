import { NextRequest, NextResponse } from "next/server";
import { readingsQuerySchema } from "@/lib/validations/iot";
import { getNodeByCode, getNodeReadings } from "@/lib/iot-db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const node_code = searchParams.get("node_code");
  const limitParam = searchParams.get("limit");

  const parsed = readingsQuerySchema.safeParse({
    node_code,
    limit: limitParam ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid parameters",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const { node_code: validatedNodeCode, limit } = parsed.data;

  const node = await getNodeByCode(validatedNodeCode);

  if (!node) {
    return NextResponse.json(
      { ok: false, error: "Node not found" },
      { status: 404 }
    );
  }

  const readings = await getNodeReadings(validatedNodeCode, limit);

  const data = readings.map((r) => ({
    id: r.id,
    node_id: r.node_id,
    node_code: validatedNodeCode,
    measured_at: r.measured_at.toISOString(),
    air_temp_c: r.air_temp_c?.toString() ?? null,
    air_humidity_pct: r.air_humidity_pct?.toString() ?? null,
    pressure_hpa: r.pressure_hpa?.toString() ?? null,
    leaf_temp_c: r.leaf_temp_c?.toString() ?? null,
    soil_moisture_raw: r.soil_moisture_raw,
    soil_moisture_pct: r.soil_moisture_pct?.toString() ?? null,
    battery_v: r.battery_v?.toString() ?? null,
    rssi_dbm: r.rssi_dbm,
    created_at: r.measured_at.toISOString(),
  }));

  return NextResponse.json({
    ok: true,
    data,
    count: data.length,
  });
}