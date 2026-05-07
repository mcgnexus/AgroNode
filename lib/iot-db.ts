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
  const nodes = await sql`
    SELECT 
      id,
      node_code,
      name,
      location_name,
      crop,
      active
    FROM nodes
    ORDER BY created_at DESC
  `;

  const result: (IoTNode & { sensor_readings: IoTReading[] })[] = [];

  for (const node of nodes) {
    const readings = await sql`
      SELECT 
        id::text,
        node_id::text,
        measured_at,
        air_temp_c::float,
        air_humidity_pct::float,
        pressure_hpa::float,
        leaf_temp_c::float,
        soil_moisture_raw,
        soil_moisture_pct::float,
        battery_v::float,
        rssi_dbm
      FROM sensor_readings
      WHERE node_id = ${node.id}
      ORDER BY measured_at DESC
      LIMIT 1
    `;

    const nodeResult: IoTNode = {
      id: node.id as string,
      node_code: node.node_code as string,
      name: node.name as string | null,
      location_name: node.location_name as string | null,
      crop: node.crop as string | null,
      active: Boolean(node.active),
    };

    result.push({
      ...nodeResult,
      sensor_readings: readings.map(r => ({
        ...r,
        measured_at: new Date(r.measured_at),
      })) as IoTReading[],
    });
  }

  return result;
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