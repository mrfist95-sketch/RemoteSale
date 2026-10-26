// Работа с IP из заголовков прокси: выбор реального адреса клиента
// и сохранение полной цепочки X-Forwarded-For (виден «внутренний» адрес за NAT).

export function isPrivateIp(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "unknown" || lower === "") return true;
  // IPv4-mapped IPv6 (::ffff:192.168.0.1)
  const mapped = lower.startsWith("::ffff:") ? lower.slice(7) : lower;
  const v4 = mapped.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 127 || a === 10 || a === 0) return true; // loopback, private, this-network
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 169 && b === 254) return true; // link-local
    return false;
  }
  // IPv6: уникальные локальные (fc00::/7) и link-local (fe80::/10)
  if (/^f[cd]/.test(lower) || lower.startsWith("fe80")) return true;
  return false;
}

export function headerStr(
  headers: Record<string, unknown> | undefined,
  name: string,
): string | null {
  const v = headers?.[name];
  return typeof v === "string" && v ? v : null;
}

export function forwardedChain(headers: Record<string, unknown> | undefined): string | null {
  const fwd = headerStr(headers, "x-forwarded-for");
  if (!fwd) return null;
  const list = fwd
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list.join(", ") : null;
}

/**
 * Основной IP клиента.
 * X-Forwarded-For строится добавлением адресов в конец: последний элемент
 * поставлен нашим доверенным nginx ($remote_addr) — это самый надёжный адрес.
 * Берём последний публичный элемент цепочки (спуфер не может его подделать),
 * при отсутствии — x-real-ip, затем первый элемент цепочки.
 * Приватные адреса пропускаем, но если публичных нет — возвращаем первый.
 */
export function pickClientIp(headers: Record<string, unknown> | undefined): string {
  const fwd = headerStr(headers, "x-forwarded-for");
  if (fwd) {
    const list = fwd
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const publicList = list.filter((ip) => !isPrivateIp(ip));
    if (publicList.length > 0) return publicList[publicList.length - 1];
    if (list.length > 0) return list[0];
  }
  const real = headerStr(headers, "x-real-ip");
  if (real) return real.trim();
  return "unknown";
}