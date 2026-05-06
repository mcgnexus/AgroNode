import { NextRequest, NextResponse } from "next/server";
import { evaluateRaifAlertsForParcel } from "@/lib/services/raif-alert-agent.service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = await evaluateRaifAlertsForParcel(id);
    if (!result) {
      return NextResponse.json({ error: "Parcela no encontrada" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error evaluando alertas RAIF" },
      { status: 500 }
    );
  }
}
