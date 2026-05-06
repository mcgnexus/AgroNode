import { NextResponse } from "next/server";
import { getRiaLatestData } from "@/lib/services/ria.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const { codigo } = await params;
    const datos = await getRiaLatestData(codigo);
    return NextResponse.json({ datos });
  } catch (error) {
    console.error("RIA Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

