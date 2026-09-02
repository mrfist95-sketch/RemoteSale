import { prisma } from "@/lib/prisma";
import { DEBT_STATUSES, computeOrderDebtInfo, type OrderDebtInfo } from "@/lib/rbac-core";

function startOfPeriod(from?: string, to?: string) {
  return {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  };
}

// Долг/просрочка по конкретным заказам с учётом отсрочки покупателя
export type { OrderDebtInfo } from "@/lib/rbac-core";

export async function getOrdersDebtInfo(
  orderIds: string[],
  now: Date = new Date(),
): Promise<Map<string, OrderDebtInfo>> {
  const map = new Map<string, OrderDebtInfo>();
  if (orderIds.length === 0) return map;
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, deleted: false },
    select: {
      id: true,
      total: true,
      status: true,
      createdAt: true,
      buyer: { select: { deferral: true } },
    },
  });
  const payments = await prisma.payment.findMany({
    where: { orderId: { in: orderIds } },
    select: { orderId: true, amount: true },
  });
  const paidByOrder = new Map<string, number>();
  for (const p of payments) {
    if (!p.orderId) continue;
    paidByOrder.set(p.orderId, (paidByOrder.get(p.orderId) ?? 0) + p.amount);
  }
  for (const o of orders) {
    map.set(
      o.id,
      computeOrderDebtInfo(
        {
          total: o.total,
          status: o.status,
          createdAt: o.createdAt,
          deferral: o.buyer.deferral ?? 0,
          paid: paidByOrder.get(o.id) ?? 0,
        },
        now,
      ),
    );
  }
  return map;
}

export async function getBuyerDebt(buyerId: string): Promise<number> {
  const orders = await prisma.order.findMany({
    where: { buyerId, status: { in: DEBT_STATUSES }, deleted: false },
    select: { total: true },
  });
  const receivable = orders.reduce((s, o) => s + o.total, 0);

  const payments = await prisma.payment.findMany({
    where: { buyerId },
    select: { amount: true },
  });
  const paid = payments.reduce((s, p) => s + p.amount, 0);

  return Math.max(0, receivable - paid);
}

export async function getBuyerPaid(buyerId: string): Promise<number> {
  const payments = await prisma.payment.findMany({
    where: { buyerId },
    select: { amount: true },
  });
  return payments.reduce((s, p) => s + p.amount, 0);
}

export async function getBuyerOverdue(
  buyerId: string,
): Promise<{ overdue: number; overdueDaysMax: number }> {
  const orders = await prisma.order.findMany({
    where: { buyerId, deleted: false },
    select: { id: true },
  });
  const debtInfo = await getOrdersDebtInfo(orders.map((o) => o.id));
  let overdue = 0;
  let overdueDaysMax = 0;
  for (const d of debtInfo.values()) {
    if (d.overdue) overdue += d.unpaid;
    if (d.overdueDays > overdueDaysMax) overdueDaysMax = d.overdueDays;
  }
  return { overdue, overdueDaysMax };
}

export interface BuyerStats {
  orderCount: number;
  orderSum: number;
  paid: number;
  debt: number;
  byMonth: { month: string; sum: number }[];
}

export async function getBuyerStats(
  buyerId: string,
  from?: string,
  to?: string,
): Promise<BuyerStats> {
  const { from: f, to: t } = startOfPeriod(from, to);
  const orders = await prisma.order.findMany({
    where: { buyerId, createdAt: { gte: f, lte: t }, deleted: false },
    select: { total: true, createdAt: true },
  });
  const paid = await getBuyerPaid(buyerId);
  const debt = await getBuyerDebt(buyerId);
  const byMonth = aggregateByMonth(orders.map((o) => ({ date: o.createdAt, sum: o.total })));
  return {
    orderCount: orders.length,
    orderSum: orders.reduce((s, o) => s + o.total, 0),
    paid,
    debt,
    byMonth,
  };
}

export interface AgentClientStat {
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  orderSum: number;
  orderCount: number;
  debt: number;
  paid: number;
}

export async function getAgentClients(agentId: string) {
  return prisma.user.findMany({
    where: { agentId, role: "BUYER" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

export async function getAgentStats(agentId: string): Promise<{
  clients: AgentClientStat[];
  totalSum: number;
  totalDebt: number;
}> {
  const clients = await getAgentClients(agentId);
  const stats: AgentClientStat[] = [];
  let totalSum = 0;
  let totalDebt = 0;
  for (const c of clients) {
    const orders = await prisma.order.findMany({
      where: { buyerId: c.id, deleted: false },
      select: { total: true },
    });
    const sum = orders.reduce((s, o) => s + o.total, 0);
    const debt = await getBuyerDebt(c.id);
    const paid = await getBuyerPaid(c.id);
    stats.push({
      buyerId: c.id,
      buyerName: c.name ?? c.email,
      buyerEmail: c.email,
      orderSum: sum,
      orderCount: orders.length,
      debt,
      paid,
    });
    totalSum += sum;
    totalDebt += debt;
  }
  return { clients: stats, totalSum, totalDebt };
}

export interface GlobalStats {
  orderCount: number;
  orderSum: number;
  paid: number;
  debt: number;
  overdue: number;
  byMonth: { month: string; sum: number; paid: number }[];
  byStatus: { status: string; count: number }[];
}

export async function getGlobalStats(from?: string, to?: string): Promise<GlobalStats> {
  const { from: f, to: t } = startOfPeriod(from, to);
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: f, lte: t }, deleted: false },
    select: { id: true, total: true, status: true, createdAt: true },
  });
  const payments = await prisma.payment.findMany({
    where: { date: { gte: f, lte: t } },
    select: { amount: true, date: true },
  });
  const debt = await getGlobalDebt();
  const debtInfo = await getOrdersDebtInfo(orders.map((o) => o.id));
  const overdue = Array.from(debtInfo.values())
    .filter((d) => d.overdue)
    .reduce((s, d) => s + d.unpaid, 0);
  const byMonth = aggregateByMonth(
    orders.map((o) => ({ date: o.createdAt, sum: o.total })),
    payments.map((p) => ({ date: p.date, sum: p.amount })),
  );
  const byStatusMap = new Map<string, number>();
  for (const o of orders) byStatusMap.set(o.status, (byStatusMap.get(o.status) ?? 0) + 1);
  return {
    orderCount: orders.length,
    orderSum: orders.reduce((s, o) => s + o.total, 0),
    paid: payments.reduce((s, p) => s + p.amount, 0),
    debt,
    overdue,
    byMonth,
    byStatus: Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count })),
  };
}

export async function getGlobalDebt(): Promise<number> {
  const orders = await prisma.order.findMany({
    where: { status: { in: DEBT_STATUSES }, deleted: false },
    select: { total: true, buyerId: true },
  });
  const buyers = new Set(orders.map((o) => o.buyerId));
  let paid = 0;
  for (const b of buyers) paid += await getBuyerPaid(b);
  const receivable = orders.reduce((s, o) => s + o.total, 0);
  return Math.max(0, receivable - paid);
}

function aggregateByMonth(
  orders: { date: Date; sum: number }[],
  payments?: { date: Date; sum: number }[],
) {
  const map = new Map<string, { sum: number; paid: number }>();
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  for (const o of orders) {
    const k = key(o.date);
    const cur = map.get(k) ?? { sum: 0, paid: 0 };
    cur.sum += o.sum;
    map.set(k, cur);
  }
  if (payments) {
    for (const p of payments) {
      const k = key(p.date);
      const cur = map.get(k) ?? { sum: 0, paid: 0 };
      cur.paid += p.sum;
      map.set(k, cur);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, sum: v.sum, paid: v.paid }));
}

// ---------- Отчёт по торговым представителям и клиентам ----------

async function getBuyerPaidInPeriod(
  buyerId: string,
  from?: Date,
  to?: Date,
): Promise<number> {
  const payments = await prisma.payment.findMany({
    where: { buyerId, date: { gte: from, lte: to } },
    select: { amount: true },
  });
  return payments.reduce((s, p) => s + p.amount, 0);
}

async function getBuyerDebtInPeriod(
  buyerId: string,
  from?: Date,
  to?: Date,
): Promise<number> {
  const orders = await prisma.order.findMany({
    where: { buyerId, status: { in: DEBT_STATUSES }, createdAt: { gte: from, lte: to }, deleted: false },
    select: { total: true },
  });
  const receivable = orders.reduce((s, o) => s + o.total, 0);
  const paid = await getBuyerPaidInPeriod(buyerId, from, to);
  return Math.max(0, receivable - paid);
}

export interface AnalystClientStat {
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  orderCount: number;
  orderSum: number;
  paid: number;
  debt: number;
  overdue: number;
}

export interface AgentReportRow {
  agentId: string;
  agentName: string;
  clients: AnalystClientStat[];
  clientCount: number;
  totalSum: number;
  totalPaid: number;
  totalDebt: number;
  totalOverdue: number;
}

export interface AgentsReport {
  agents: AgentReportRow[];
  unassigned: AnalystClientStat[];
  totals: {
    agents: number;
    clients: number;
    orderSum: number;
    paid: number;
    debt: number;
    overdue: number;
  };
}

export async function getAgentsReport(from?: string, to?: string): Promise<AgentsReport> {
  const { from: f, to: t } = startOfPeriod(from, to);
  const agents = await prisma.user.findMany({
    where: { role: "AGENT" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  const agentRows: AgentReportRow[] = [];
  const allOrderIds: string[] = [];
  const clientOrderIds: { buyerId: string; orderIds: string[] }[] = [];
  let grandSum = 0;
  let grandPaid = 0;
  let grandDebt = 0;
  let grandClients = 0;

  for (const a of agents) {
    const clients = await prisma.user.findMany({
      where: { agentId: a.id, role: "BUYER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });
    const clientStats: AnalystClientStat[] = [];
    let sum = 0;
    let paid = 0;
    let debt = 0;
    for (const c of clients) {
      const orders = await prisma.order.findMany({
        where: { buyerId: c.id, createdAt: { gte: f, lte: t }, deleted: false },
        select: { id: true, total: true },
      });
      const orderIds = orders.map((o) => o.id);
      const orderSum = orders.reduce((s, o) => s + o.total, 0);
      const paidAmt = await getBuyerPaidInPeriod(c.id, f, t);
      const debtAmt = await getBuyerDebtInPeriod(c.id, f, t);
      clientOrderIds.push({ buyerId: c.id, orderIds });
      allOrderIds.push(...orderIds);
      clientStats.push({
        buyerId: c.id,
        buyerName: c.name ?? c.email,
        buyerEmail: c.email,
        orderCount: orders.length,
        orderSum,
        paid: paidAmt,
        debt: debtAmt,
        overdue: 0,
      });
      sum += orderSum;
      paid += paidAmt;
      debt += debtAmt;
    }
    agentRows.push({
      agentId: a.id,
      agentName: a.name ?? a.email,
      clients: clientStats,
      clientCount: clients.length,
      totalSum: sum,
      totalPaid: paid,
      totalDebt: debt,
      totalOverdue: 0,
    });
    grandSum += sum;
    grandPaid += paid;
    grandDebt += debt;
    grandClients += clients.length;
  }

  const unassignedClients = await prisma.user.findMany({
    where: { agentId: null, role: "BUYER" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  const unassigned: AnalystClientStat[] = [];
  for (const c of unassignedClients) {
    const orders = await prisma.order.findMany({
      where: { buyerId: c.id, createdAt: { gte: f, lte: t }, deleted: false },
      select: { id: true, total: true },
    });
    const orderIds = orders.map((o) => o.id);
    const orderSum = orders.reduce((s, o) => s + o.total, 0);
    const paidAmt = await getBuyerPaidInPeriod(c.id, f, t);
    const debtAmt = await getBuyerDebtInPeriod(c.id, f, t);
    clientOrderIds.push({ buyerId: c.id, orderIds });
    allOrderIds.push(...orderIds);
    unassigned.push({
      buyerId: c.id,
      buyerName: c.name ?? c.email,
      buyerEmail: c.email,
      orderCount: orders.length,
      orderSum,
      paid: paidAmt,
      debt: debtAmt,
      overdue: 0,
    });
    grandSum += orderSum;
    grandPaid += paidAmt;
    grandDebt += debtAmt;
    grandClients += 1;
  }

  const debtInfo = await getOrdersDebtInfo(allOrderIds);
  const overdueByClient = new Map<string, number>();
  for (const { buyerId, orderIds } of clientOrderIds) {
    let ov = 0;
    for (const oid of orderIds) {
      const d = debtInfo.get(oid);
      if (d?.overdue) ov += d.unpaid;
    }
    overdueByClient.set(buyerId, ov);
  }

  let grandOverdue = 0;
  for (const row of agentRows) {
    let agentOverdue = 0;
    for (const cs of row.clients) {
      const ov = overdueByClient.get(cs.buyerId) ?? 0;
      cs.overdue = ov;
      agentOverdue += ov;
    }
    row.totalOverdue = agentOverdue;
    grandOverdue += agentOverdue;
  }
  for (const cs of unassigned) cs.overdue = overdueByClient.get(cs.buyerId) ?? 0;
  grandOverdue += unassigned.reduce((s, cs) => s + cs.overdue, 0);

  return {
    agents: agentRows,
    unassigned,
    totals: {
      agents: agents.length,
      clients: grandClients,
      orderSum: grandSum,
      paid: grandPaid,
      debt: grandDebt,
      overdue: grandOverdue,
    },
  };
}

// ---------- Отчёт в разрезе товаров ----------

export interface ProductReportRow {
  productId: string;
  name: string;
  unit: string | null;
  orderedQty: number;
  orderedSum: number;
  orderCount: number;
  buyerCount: number;
  paidSum: number;
  unpaidSum: number;
  overdueSum: number;
}

export interface ProductsReport {
  products: ProductReportRow[];
  totals: {
    orderedQty: number;
    orderedSum: number;
    paidSum: number;
    unpaidSum: number;
    overdueSum: number;
  };
}

export async function getProductsReport(from?: string, to?: string): Promise<ProductsReport> {
  const { from: f, to: t } = startOfPeriod(from, to);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: f, lte: t }, deleted: false },
    select: {
      id: true,
      buyerId: true,
      items: { select: { productId: true, name: true, qty: true, price: true } },
    },
  });

  const prodMap = new Map<string, ProductReportRow>();
  const prodOrders = new Map<string, Set<string>>();
  const prodBuyers = new Map<string, Set<string>>();
  const orderIds: string[] = [];
  const payByOrder = new Map<string, number>();

  for (const o of orders) {
    orderIds.push(o.id);
    for (const it of o.items) {
      if (!prodMap.has(it.productId)) {
        prodMap.set(it.productId, {
          productId: it.productId,
          name: it.name,
          unit: null,
          orderedQty: 0,
          orderedSum: 0,
          orderCount: 0,
          buyerCount: 0,
          paidSum: 0,
          unpaidSum: 0,
          overdueSum: 0,
        });
      }
      const row = prodMap.get(it.productId)!;
      row.orderedQty += it.qty;
      row.orderedSum += it.qty * it.price;
      if (!prodOrders.has(it.productId)) prodOrders.set(it.productId, new Set());
      prodOrders.get(it.productId)!.add(o.id);
      if (!prodBuyers.has(it.productId)) prodBuyers.set(it.productId, new Set());
      prodBuyers.get(it.productId)!.add(o.buyerId);
    }
  }

  if (orderIds.length > 0) {
    const payments = await prisma.payment.findMany({
      where: { orderId: { in: orderIds }, date: { gte: f, lte: t } },
      select: { orderId: true, amount: true },
    });
    for (const p of payments) {
      if (!p.orderId) continue;
      payByOrder.set(p.orderId, (payByOrder.get(p.orderId) ?? 0) + p.amount);
    }
  }

  const units = await prisma.product.findMany({ select: { id: true, unit: true } });
  const unitMap = new Map(units.map((u) => [u.id, u.unit]));

  const debtInfo = await getOrdersDebtInfo(orderIds);

  const products: ProductReportRow[] = [];
  let tQty = 0;
  let tSum = 0;
  let tPaid = 0;
  let tOverdue = 0;
  for (const [pid, row] of prodMap) {
    row.unit = unitMap.get(pid) ?? null;
    row.orderCount = prodOrders.get(pid)?.size ?? 0;
    row.buyerCount = prodBuyers.get(pid)?.size ?? 0;
    const oids = prodOrders.get(pid);
    let paid = 0;
    let overdue = 0;
    if (oids)
      for (const oid of oids) {
        paid += payByOrder.get(oid) ?? 0;
        const d = debtInfo.get(oid);
        if (d?.overdue) overdue += d.unpaid;
      }
    row.paidSum = paid;
    row.unpaidSum = Math.max(0, row.orderedSum - paid);
    row.overdueSum = overdue;
    products.push(row);
    tQty += row.orderedQty;
    tSum += row.orderedSum;
    tPaid += row.paidSum;
    tOverdue += row.overdueSum;
  }

  products.sort((a, b) => b.orderedSum - a.orderedSum);

  return {
    products,
    totals: {
      orderedQty: tQty,
      orderedSum: tSum,
      paidSum: tPaid,
      unpaidSum: Math.max(0, tSum - tPaid),
      overdueSum: tOverdue,
    },
  };
}
