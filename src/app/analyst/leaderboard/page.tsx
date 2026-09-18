import { Suspense } from "react";
import { requireRole } from "@/lib/rbac";
import { getLeaderboard } from "@/lib/stats";
import { formatRub } from "@/lib/format";
import { PageHeader, Card } from "@/components/ui";
import PeriodFilter from "@/components/PeriodFilter";
import {
  AgentLeaderboardRow,
  ProductLeaderboardRow,
  MEDALS,
} from "@/components/LeaderboardRows";

function Podium({ items }: { items: { name: string; sum: number }[] }) {
  // Пьедестал: 2-1-3
  const order = [1, 0, 2];
  const heights = ["h-20", "h-28", "h-16"];
  const labels = ["II", "I", "III"];
  return (
    <div className="flex items-end justify-center gap-2 py-4">
      {order.map((idx) => {
        const item = items[idx];
        if (!item) return null;
        return (
          <div key={idx} className="flex w-28 flex-col items-center">
            <div className="mb-1 text-2xl">{MEDALS[idx]}</div>
            <div className="max-w-28 truncate text-center text-xs font-medium" title={item.name}>
              {item.name}
            </div>
            <div className="text-xs text-zinc-500">{formatRub(item.sum)}</div>
            <div
              className={`mt-2 w-full ${heights[idx]} rounded-t-lg bg-gradient-to-b ${
                idx === 0
                  ? "from-slate-300 to-slate-400"
                  : idx === 1
                    ? "from-amber-300 to-amber-500"
                    : "from-orange-300 to-orange-400"
              } flex items-start justify-center pt-2 text-sm font-bold text-white`}
            >
              {labels[idx]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function AnalystLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole("ANALYST");
  const sp = await searchParams;
  const board = await getLeaderboard(sp.from, sp.to);

  const hasAgents = board.agents.length > 0;
  const hasProducts = board.products.length > 0;

  return (
    <div>
      <PageHeader
        title="Лидерборд по продажам"
        subtitle="Топ торговых представителей и товаров за период (без черновиков и отменённых заказов)"
      />
      <div className="mb-4">
        <Suspense fallback={null}>
          <PeriodFilter />
        </Suspense>
      </div>

      <Card title="Пьедестал: торговые представители" className="mb-4">
        {hasAgents ? (
          <Podium
            items={board.agents.slice(0, 3).map((a) => ({ name: a.agentName, sum: a.totalSum }))}
          />
        ) : (
          <p className="text-sm text-zinc-400">Нет продаж за период</p>
        )}
      </Card>

      <Card title="Пьедестал: товары" className="mb-4">
        {hasProducts ? (
          <Podium
            items={board.products
              .slice(0, 3)
              .map((p) => ({ name: p.productName, sum: p.orderedSum }))}
          />
        ) : (
          <p className="text-sm text-zinc-400">Нет продаж за период</p>
        )}
      </Card>

      <Card title="Торговые представители (по сумме продаж)" className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-2 w-10 text-center">Место</th>
                <th className="py-2">Представитель</th>
                <th className="py-2">Клиентов</th>
                <th className="py-2">Заказов</th>
                <th className="py-2">Сумма продаж</th>
              </tr>
            </thead>
            <tbody>
              {board.agents.map((a, i) => (
                <AgentLeaderboardRow key={a.agentId} row={a} index={i} />
              ))}
              {board.agents.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-zinc-400">Нет продаж за период</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Товары (по сумме продаж)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-2 w-10 text-center">Место</th>
                <th className="py-2">Товар</th>
                <th className="py-2">Заказов</th>
                <th className="py-2">Клиентов</th>
                <th className="py-2">Кол-во</th>
                <th className="py-2">Сумма продаж</th>
              </tr>
            </thead>
            <tbody>
              {board.products.map((p, i) => (
                <ProductLeaderboardRow key={p.productId} row={p} index={i} />
              ))}
              {board.products.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-zinc-400">Нет продаж за период</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}