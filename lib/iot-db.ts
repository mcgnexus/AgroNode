import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL_IOT!, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

export interface IoTNode {
  id: string;
  node_code: string;
  name: string | null;
  location_name: string | null;
  crop: string | null;
  active: boolean;
}

export interface IoTReading {
  id: string;
  node_id: string;
  measured_at: Date;
  air_temp_c: number | null;
  air_humidity_pct: number | null;
  pressure_hpa: number | null;
  leaf_temp_c: number | null;
  soil_moisture_raw: number | null;
  soil_moisture_pct: number | null;
  battery_v: number | null;
  rssi_dbm: number | null;
}

export async function getNodesWithLatestReading(): Promise<(IoTNode & { sensor_readings: IoTReading[] })[]> {
  const result = await sql`
    SELECT 
      n.id::text as id,
      n.node_code::text as node_code,
      n.name,
      n.location_name,
      n.crop,
      n.active,
      sr.id::text as reading_id,
      sr.node_id::text as reading_node_id,
      sr.measured_at,
      sr.air_temp_c::float,
      sr.air_humidity_pct::float,
      sr.pressure_hpa::float,
      sr.leaf_temp_c::float,
      sr.soil_moisture_raw,
      sr.soil_moisture_pct::float,
      sr.battery_v::float,
      sr.rssi_dbm
    FROM nodes n
    LEFT JOIN LATERAL (
      SELECT id, node_id, measured_at, air_temp_c, air_humidity_pct, 
             pressure_hpa, leaf_temp_c, soil_moisture_raw, soil_moisture_pct, 
             battery_v, rssi_dbm
      FROM sensor_readings
      WHERE node_id = n.id
      ORDER BY measured_at DESC
      LIMIT 1
    ) sr ON true
    ORDER BY n.created_at DESC
  `;

  const nodesMap = new Map<string, IoTNode & { sensor_readings: IoTReading[] }>();

  for (const row of result) {
    if (!nodesMap.has(row.id)) {
      nodesMap.set(row.id, {
        id: row.id,
        node_code: row.node_code,
        name: row.name,
        location_name: row.location_name,
        crop: row.crop,
        active: Boolean(row.active),
        sensor_readings: [],
      });
    }
    
    if (row.reading_id) {
      nodesMap.get(row.id)!.sensor_readings.push({
        id: row.reading_id,
        node_id: row.reading_node_id,
        measured_at: new Date(row.measured_at),
        air_temp_c: row.air_temp_c,
        air_humidity_pct: row.air_humidity_pct,
        pressure_hpa: row.pressure_hpa,
        leaf_temp_c: row.leaf_temp_c,
        soil_moisture_raw: row.soil_moisture_raw,
        soil_moisture_pct: row.soil_moisture_pct,
        battery_v: row.battery_v,
        rssi_dbm: row.rssi_dbm,
      });
    }
  }

  return Array.from(nodesMap.values());
}

export async function getNodeReadings(nodeCode: string, limit: number = 100): Promise<IoTReading[]> {
  const readings = await sql`
    SELECT 
      sr.id::text,
      sr.node_id::text,
      sr.measured_at,
      sr.air_temp_c::float,
      sr.air_humidity_pct::float,
      sr.pressure_hpa::float,
      sr.leaf_temp_c::float,
      sr.soil_moisture_raw,
      sr.soil_moisture_pct::float,
      sr.battery_v::float,
      sr.rssi_dbm
    FROM sensor_readings sr
    INNER JOIN nodes n ON n.id = sr.node_id
    WHERE n.node_code = ${nodeCode}
    ORDER BY sr.measured_at DESC
    LIMIT ${limit}
  `;

  return readings.map(r => ({
    ...r,
    measured_at: new Date(r.measured_at),
  })) as IoTReading[];
}

export async function createNode(data: {
  node_code: string;
  name?: string;
  location_name?: string;
  crop?: string;
  wifi_ssid?: string;
  wifi_password?: string;
  api_token: string;
}): Promise<IoTNode> {
  const [node] = await sql`
    INSERT INTO nodes (node_code, name, location_name, crop, wifi_ssid, wifi_password, api_token)
    VALUES (
      ${data.node_code},
      ${data.name ?? null},
      ${data.location_name ?? null},
      ${data.crop ?? null},
      ${data.wifi_ssid ?? null},
      ${data.wifi_password ?? null},
      ${data.api_token}
    )
    RETURNING id, node_code, name, location_name, crop, active
  `;
  return node as IoTNode;
}

export async function getNodeByCode(code: string): Promise<(IoTNode & { api_token: string }) | null> {
  const [node] = await sql`
    SELECT id, node_code, name, location_name, crop, active, api_token
    FROM nodes
    WHERE node_code = ${code}
  `;
  return node ? (node as IoTNode & { api_token: string }) : null;
}

export async function getNodeReadingCount(nodeCode: string): Promise<number> {
  const result = await sql`
    SELECT COUNT(*)::int as count
    FROM sensor_readings sr
    INNER JOIN nodes n ON n.id = sr.node_id
    WHERE n.node_code = ${nodeCode}
  `;
  return result[0]?.count ?? 0;
}

export async function getNodeLatestReading(nodeCode: string): Promise<IoTReading | null> {
  const readings = await sql`
    SELECT 
      sr.id::text,
      sr.node_id::text,
      sr.measured_at,
      sr.air_temp_c::float,
      sr.air_humidity_pct::float,
      sr.pressure_hpa::float,
      sr.leaf_temp_c::float,
      sr.soil_moisture_raw,
      sr.soil_moisture_pct::float,
      sr.battery_v::float,
      sr.rssi_dbm
    FROM sensor_readings sr
    INNER JOIN nodes n ON n.id = sr.node_id
    WHERE n.node_code = ${nodeCode}
    ORDER BY sr.measured_at DESC
    LIMIT 1
  `;
  if (readings.length === 0) return null;
  const r = readings[0];
  return {
    id: r.id as string,
    node_id: r.node_id as string,
    measured_at: new Date(r.measured_at as Date),
    air_temp_c: r.air_temp_c as number | null,
    air_humidity_pct: r.air_humidity_pct as number | null,
    pressure_hpa: r.pressure_hpa as number | null,
    leaf_temp_c: r.leaf_temp_c as number | null,
    soil_moisture_raw: r.soil_moisture_raw as number | null,
    soil_moisture_pct: r.soil_moisture_pct as number | null,
    battery_v: r.battery_v as number | null,
    rssi_dbm: r.rssi_dbm as number | null,
  };
}

export async function createReading(data: {
  node_id: string;
  measured_at?: Date;
  air_temp_c?: number;
  air_humidity_pct?: number;
  pressure_hpa?: number;
  leaf_temp_c?: number;
  soil_moisture_raw?: number;
  soil_moisture_pct?: number;
  battery_v?: number;
  rssi_dbm?: number;
}): Promise<{ id: string; measured_at: Date; created_at: Date }> {
  const [reading] = await sql`
    INSERT INTO sensor_readings (
      node_id, measured_at, air_temp_c, air_humidity_pct,
      pressure_hpa, leaf_temp_c, soil_moisture_raw, soil_moisture_pct,
      battery_v, rssi_dbm
    ) VALUES (
      ${data.node_id},
      ${data.measured_at ?? new Date()},
      ${data.air_temp_c ?? null},
      ${data.air_humidity_pct ?? null},
      ${data.pressure_hpa ?? null},
      ${data.leaf_temp_c ?? null},
      ${data.soil_moisture_raw ?? null},
      ${data.soil_moisture_pct ?? null},
      ${data.battery_v ?? null},
      ${data.rssi_dbm ?? null}
    )
    RETURNING id::text, measured_at, created_at
  `;
  return {
    id: reading.id as string,
    measured_at: new Date(reading.measured_at as Date),
    created_at: new Date(reading.created_at as Date),
  };
}

export { sql };