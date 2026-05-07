import { NextRequest, NextResponse } from "next/server";
import { createNodeSchema } from "@/lib/validations/iot";
import { createNode, getNodeByCode } from "@/lib/iot-db";

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

  const parsed = createNodeSchema.safeParse(body);
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

  const { node_code, name, location_name, crop, wifi_ssid, wifi_password, api_token } = parsed.data;

  const existing = await getNodeByCode(node_code);

  if (existing) {
    return NextResponse.json(
      { ok: false, error: "Node code already exists" },
      { status: 409 }
    );
  }

  try {
    const node = await createNode({
      node_code,
      name,
      location_name,
      crop,
      wifi_ssid,
      wifi_password,
      api_token,
    });

    return NextResponse.json(
      { ok: true, node: { id: node.id, node_code: node.node_code } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating node:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}