import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Живость приложения И доступность базы: watchdog и Docker healthcheck
// перезапускают контейнер, если что-то из этого сломалось.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "ok", ts: Date.now() });
  } catch (e) {
    console.error("[health] db check failed", e);
    return NextResponse.json({ ok: false, db: "error", ts: Date.now() }, { status: 503 });
  }
}
