import { NextRequest, NextResponse } from "next/server";
import { aiChatSchema } from "@/lib/validations/ai";
import { chatWithAi } from "@/lib/services/ai.service";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request: JSON inválido" },
      { status: 400 }
    );
  }

  const parsed = aiChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Bad Request: validación fallida", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await chatWithAi(parsed.data.parcelId, parsed.data.message);
    return NextResponse.json(result);
  } catch (err) {
    console.error("AI chat error:", err);
    return NextResponse.json(
      { error: "Error interno del asistente AI" },
      { status: 500 }
    );
  }
}
