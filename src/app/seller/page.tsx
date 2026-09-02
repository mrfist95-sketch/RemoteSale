import { Suspense } from "react";
import { requireRole } from "@/lib/rbac";
import { ORDER_STATUSES } from "@/lib/rbac-core";
import { prisma } from "@/lib/prisma";
import { getOrdersDebtInfo } from "@/lib/stats";
import { PageHeader } from "@/components/ui";
import SellerOrderBoard from "@/components/SellerOrderBoard";
import SellerOrderFilters from "@/components/SellerOrderFilters";
import Link from "next/link";

const PAGE_SIZE = 20;

export default async function SellerHome({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; from?: string; to?: string }>;
}) {
  await requireRole("SELLER");
  const sp = await searchParams;

  const page = Math.max(1, Number(sp.page) || 1);
  const status =
    sp.status && (ORDER_STATUSES as readonly string[]).includes(sp.status) ? sp.status : undefined;
  const fromDate = sp.from && !Number.isNaN(new Date(sp.from).getTime()) ? new Date(sp.from + "T00:00:00") : undefined;
  const toDate = sp.to && !Number.isNaN(new Date(sp.to).getTime()) ? new Date(sp.to + "T23:59:59.999") : undefined;

  const where = {
    deleted: false,
    ...(status ? { status } : {}),
    ...(fromDate || toDate
      ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
      : {}),
  };

  const [total, open, filteredTotal, orders, editReasons] = await Promise.all([
    prisma.order.count({ where: { deleted: false } }),
    prisma.order.count({ where: { deleted: false, status: { notIn: ["PAID", "CANCELLED"] } } }),
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        items: true,
        buyer: {
          select: { id: true, name: true, email: true, address: true, phone: true, deferral: true },
        },
        agent: { select: { name: true } },
        statusLogs: {
          orderBy: { changedAt: "asc" },
          include: { changedBy: { select: { name: true, email: true } } },
        },
        payments: {
          orderBy: { date: "desc" },
          include: { createdBy: { select: { name: true, email: true } } },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { user: { select: { name: true, email: true } } },
        },
      },
    }),
    prisma.orderEditReason.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  // Расчёт просрочки только по выгруженным 20 заказам, не по всей базе
  const debtInfo = await getOrdersDebtInfo(orders.map((o) => o.id));

  const serialized = orders.map((o) => ({
    id: o.id,
    buyerId: o.buyerId,
    number: o.number,
    status: o.status,
    total: o.total,
    paid: debtInfo.get(o.id)?.paid ?? 0,
    createdAt: o.createdAt.toISOString(),
    buyer: {
      name: o.buyer.name,
      email: o.buyer.email,
      address: o.buyer.address,
      phone: o.buyer.phone,
      deferral: o.buyer.deferral,
    },
    agent: o.agent ? { name: o.agent.name } : null,
    items: o.items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })),
    statusLogs: o.statusLogs.map((l) => ({
      status: l.status,
      changedAt: l.changedAt.toISOString(),
      changedBy: l.changedBy,
    })),
    payments: o.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      note: p.note,
      date: p.date.toISOString(),
      createdBy: p.createdBy,
    })),
    audit: o.auditLogs.map((a) => ({
      id: a.id,
      action: a.action,
      details: a.details,
      amount: a.amount,
      createdAt: a.createdAt.toISOString(),
      user: a.user,
    })),
    overdueDays: debtInfo.get(o.id)?.overdueDays ?? 0,
    overdue: debtInfo.get(o.id)?.overdue ?? false,
  }));

  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (sp.from) q.set("from", sp.from);
    if (sp.to) q.set("to", sp.to);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/seller?${s}` : "/seller";
  };

  return (
    <div>
      <PageHeader title="Заявки и заказы" subtitle={`В работе: ${open} из ${total}`} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Suspense fallback={null}>
          <SellerOrderFilters />
        </Suspense>
        <Link
          href="/seller/route-list"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Маршрутный лист →
        </Link>
      </div>

      <SellerOrderBoard orders={serialized} open={open} total={total} editReasons={editReasons.map((r) => r.name)} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-zinc-500">
          Найдено по фильтру: {filteredTotal} · показаны {orders.length} · страница {page} из {totalPages}
        </span>
        <div className="flex items-center gap-2">
          {page > 1 && (
            <Link
              href={pageHref(page - 1)}
              className="rounded border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50"
            >
              ← Назад
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={pageHref(page + 1)}
              className="rounded border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50"
            >
              Вперёд →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}