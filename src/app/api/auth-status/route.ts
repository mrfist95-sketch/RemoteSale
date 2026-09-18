import { NextRequest, NextResponse } from "next/server";

// Публичный (без секретов) статус лимита входа по email.
// Используется клиентомLoginForm для обратного отсчёта блокировки.
export async function POST(req: NextRequest) {
  let email = "";
  try {
    const body = (await req.json()) as { email?: string };
    email = String(body.email ?? "").toLowerCase().trim();
  } catch {
    return NextResponse.json({ blocked: false, attemptsLeft: 3 });
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ blocked: false, attemptsLeft: null });
  }
  const { checkRateLimit } = await import("@/lib/rate-limit");
  const s = checkRateLimit(email);
  return NextResponse.json({
    blocked: s.blocked,
    retryAfterSec: s.blocked ? Math.ceil(s.retryAfterMs / 1000) : 0,
    attemptsLeft: s.attemptsLeft,
  });
}