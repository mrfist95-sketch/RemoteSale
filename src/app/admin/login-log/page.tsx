import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { PageHeader, Card, StatCard } from "@/components/ui";

const PAGE_SIZE = 50;

const DEVICE_LABELS: Record<string, string> = {
  desktop: "Компьютер",
  mobile: "Телефон",
  tablet: "Планшет",
};

export default async function AdminLoginLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; result?: string; ip?: string; page?: string }>;
}) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const q = sp.q?.trim().toLowerCase() ?? "";
  const result = sp.result === "ok" || sp.result === "fail" ? sp.result : "";
  const ip = sp.ip?.trim() ?? "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
    ...(q ? { email: { contains: q } } : {}),
    ...(result === "ok" ? { success: true } : result === "fail" ? { success: false } : {}),
    ...(ip ? { ip: { contains: ip } } : {}),
  };

  const [events, total, agg] = await Promise.all([
    prisma.loginEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { user: { select: { name: true, email: true, role: true } } },
    }),
    prisma.loginEvent.count({ where }),
    prisma.loginEvent.aggregate({
      _count: { id: true },
      where: {},
    }),
  ]);

  // Сводка по устройствам/адресам (за всё время)
  const [distinctIps, failedCount, lastByUser] = await Promise.all([
    prisma.loginEvent.findMany({
      where: { ip: { not: null } },
      select: { ip: true },
      distinct: ["ip"],
    }),
    prisma.loginEvent.count({ where: { success: false } }),
    prisma.user.findMany({
      where: { loginEvents: { some: { success: true } } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        loginEvents: {
          where: { success: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (result) params.set("result", result);
    if (ip) params.set("ip", ip);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/admin/login-log?${s}` : "/admin/login-log";
  };

  return (
    <div>
      <PageHeader
        title="Журнал входов"
        subtitle="Устройства, IP-адреса и браузеры, с которых выполнялись попытки входа"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Всего событий" value={String(agg._count.id)} />
        <StatCard label="Уникальных IP" value={String(distinctIps.length)} />
        <StatCard label="Неудачных попыток" value={String(failedCount)} />
        <StatCard
          label="Пользователей входили"
          value={String(lastByUser.length)}
        />
      </div>

      <Card title="Последние входы по пользователям" className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-2">Пользователь</th>
                <th className="py-2">Последний вход</th>
                <th className="py-2">IP</th>
                <th className="py-2">Браузер / ОС</th>
                <th className="py-2">Устройство</th>
                <th className="py-2">Экран</th>
                <th className="py-2">Часовой пояс</th>
              </tr>
            </thead>
            <tbody>
              {lastByUser.map((u) => {
                const last = u.loginEvents[0];
                if (!last) return null;
                return (
                  <tr key={u.id} className="border-t border-zinc-100">
                    <td className="py-2 font-medium">
                      {u.name ?? u.email}
                      <span className="ml-1 text-xs text-zinc-400">({u.role})</span>
                    </td>
                    <td className="py-2">{formatDateTime(last.createdAt)}</td>
                    <td className="py-2 font-mono text-xs">{last.ip ?? "—"}</td>
                    <td className="py-2">
                      {last.browser ?? "—"}
                      {last.browserVersion ? ` ${last.browserVersion}` : ""} · {last.os ?? "—"}
                    </td>
                    <td className="py-2">
                      {last.deviceType ? DEVICE_LABELS[last.deviceType] ?? last.deviceType : "—"}
                    </td>
                    <td className="py-2">{last.screen ?? "—"}</td>
                    <td className="py-2">{last.timezone ?? "—"}</td>
                  </tr>
                );
              })}
              {lastByUser.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-3 text-zinc-400">Пока никто не входил</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Все попытки входа">
        <form method="GET" action="/admin/login-log" className="mb-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-zinc-500">Email (введённый)</label>
            <input
              name="q"
              defaultValue={q}
              placeholder="поиск по email"
              className="rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500">Результат</label>
            <select
              name="result"
              defaultValue={result}
              className="rounded border border-zinc-300 px-2 py-1 text-sm"
            >
              <option value="">Все</option>
              <option value="ok">Успешные</option>
              <option value="fail">Неудачные</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500">IP-адрес</label>
            <input
              name="ip"
              defaultValue={ip}
              placeholder="например 192.168."
              className="rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </div>
          <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white">
            Фильтр
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-2">Время</th>
                <th className="py-2">Пользователь / email</th>
                <th className="py-2">Результат</th>
                <th className="py-2">IP</th>
                <th className="py-2">Браузер</th>
                <th className="py-2">ОС</th>
                <th className="py-2">Устройство</th>
                <th className="py-2">Экран</th>
                <th className="py-2">TZ</th>
                <th className="py-2">Платформа</th>
                <th className="py-2">Cookies</th>
                <th className="py-2">User-Agent</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className={`border-t border-zinc-100 ${e.success ? "" : "bg-red-50/40"}`}>
                  <td className="py-2 whitespace-nowrap">{formatDateTime(e.createdAt)}</td>
                  <td className="py-2">
                    {e.user ? (
                      <span>
                        <span className="font-medium">{e.user.name ?? e.user.email}</span>
                        <span className="ml-1 text-xs text-zinc-400">({e.user.role})</span>
                      </span>
                    ) : (
                      <span className="font-mono text-xs">{e.email}</span>
                    )}
                  </td>
                  <td className="py-2">
                    {e.success ? (
                      <span className="text-green-700">✓ успех</span>
                    ) : (
                      <span className="text-red-700">✗ {e.reason ?? "неудача"}</span>
                    )}
                  </td>
                  <td className="py-2 font-mono text-xs">{e.ip ?? "—"}</td>
                  <td className="py-2">
                    {e.browser ?? "—"}
                    {e.browserVersion ? ` ${e.browserVersion}` : ""}
                  </td>
                  <td className="py-2">{e.os ?? "—"}</td>
                  <td className="py-2">
                    {e.deviceType ? DEVICE_LABELS[e.deviceType] ?? e.deviceType : "—"}
                  </td>
                  <td className="py-2 text-xs">
                    {e.screen ?? "—"}
                    {e.viewport ? <span className="text-zinc-400"> ({e.viewport})</span> : null}
                  </td>
                  <td className="py-2 text-xs">{e.timezone ?? "—"}</td>
                  <td className="py-2 text-xs">
                    {e.platform ?? "—"}
                    {e.hardware ? <span className="text-zinc-400"> · {e.hardware}</span> : null}
                  </td>
                  <td className="py-2 text-xs">
                    {e.cookiesEnabled === null ? "—" : e.cookiesEnabled ? "вкл" : "выкл"}
                    {e.touch === null ? "" : e.touch ? " · touch" : ""}
                  </td>
                  <td className="py-2">
                    <span className="block max-w-48 truncate text-xs text-zinc-400" title={e.userAgent ?? ""}>
                      {e.userAgent ?? "—"}
                    </span>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-3 text-zinc-400">Событий не найдено</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
          <span>
            Найдено: {total} · страница {page} из {totalPages}
          </span>
          <span className="flex items-center gap-2">
            {page > 1 && (
              <a href={pageHref(page - 1)} className="rounded border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50">
                ← Назад
              </a>
            )}
            {page < totalPages && (
              <a href={pageHref(page + 1)} className="rounded border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50">
                Вперёд →
              </a>
            )}
          </span>
        </div>
      </Card>
    </div>
  );
}