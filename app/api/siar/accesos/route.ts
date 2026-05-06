import { NextResponse } from "next/server";
import { getAccesos } from "@/lib/siar-client";

export async function GET() {
  try {
    const datos = await getAccesos();
    return NextResponse.json({ datos });
  } catch (error) {
    console.error("SIAR Accesos Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

