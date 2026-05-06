import { NextResponse } from "next/server";
import { getRiaApiStatus } from "@/lib/services/ria.service";

export async function GET() {
  try {
    const datos = await getRiaApiStatus();
    return NextResponse.json({ datos });
  } catch (error) {
    console.error("RIA accesos Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

