import { prisma } from "@/lib/prisma";
import { DEBT_STATUSES, REPORT_STATUSES, computeOrderDebtInfo, type OrderDebtInfo } from "@/lib/rbac-core";

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
  buyerAddress: string | null;
  orderSum: number;
  orderCount: number;
  debt: number;
  paid: number;
}

export async function getAgentClients(agentId: string) {
  return prisma.user.findMany({
    where: { agentId, role: "BUYER" },
    select: { id: true, name: true, email: true, address: true },
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
      buyerAddress: c.address,
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
    where: {
      createdAt: { gte: f, lte: t },
      deleted: false,
      status: { in: REPORT_STATUSES },
    },
    select: { id: true, total: true, status: true, createdAt: true },
  });
  const payments = await prisma.payment.findMany({
    where: {
      date: { gte: f, lte: t },
      orderId: { not: null },
      order: { deleted: false, status: { in: REPORT_STATUSES } },
    },
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
  // Только оплаты, привязанные к действующим (не удалённым, не отменённым) заказам
  const payments = await prisma.payment.findMany({
    where: {
      buyerId,
      orderId: { not: null },
      date: { gte: from, lte: to },
      order: { deleted: false, status: { not: "CANCELLED" } },
    },
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

export interface AnalystClientOrder {
  orderId: string;
  number: number;
  createdAt: string; // ISO
  status: string;
  total: number;
  statusHistory: { status: string; changedAt: string; changedByName: string | null }[];
}

export interface AnalystClientStat {
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  buyerAddress: string | null;
  orderCount: number;
  orderSum: number;
  paid: number;
  debt: number;
  overdue: number;
  orders: AnalystClientOrder[];
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

// Один клиент: заказы с историей статусов
async function getBuyerOrdersWithHistory(buyerId: string, f?: Date, t?: Date): Promise<{
  orders: AnalystClientOrder[];
  orderSum: number;
}> {
  const orders = await prisma.order.findMany({
    where: {
      buyerId,
      createdAt: { gte: f, lte: t },
      deleted: false,
      status: { in: REPORT_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      createdAt: true,
      status: true,
      total: true,
      statusLogs: {
        orderBy: { changedAt: "asc" },
        include: { changedBy: { select: { name: true, email: true } } },
      },
    },
  });
  return {
    orders: orders.map((o) => ({
      orderId: o.id,
      number: o.number,
      createdAt: o.createdAt.toISOString(),
      status: o.status,
      total: o.total,
      statusHistory: o.statusLogs.map((l) => ({
        status: l.status,
        changedAt: l.changedAt.toISOString(),
        changedByName: l.changedBy?.name ?? l.changedBy?.email ?? null,
      })),
    })),
    orderSum: orders.reduce((s, o) => s + o.total, 0),
  };
}

export async function getAgentsReport(
  from?: string,
  to?: string,
  agentFilterId?: string,
): Promise<AgentsReport> {
  const { from: f, to: t } = startOfPeriod(from, to);
  const agents = await prisma.user.findMany({
    where: { role: "AGENT", ...(agentFilterId ? { id: agentFilterId } : {}) },
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
      select: { id: true, name: true, email: true, address: true },
    });
    const clientStats: AnalystClientStat[] = [];
    let sum = 0;
    let paid = 0;
    let debt = 0;
    for (const c of clients) {
      const { orders: clientOrders, orderSum } = await getBuyerOrdersWithHistory(c.id, f, t);
      const orderIds = clientOrders.map((o) => o.orderId);
      const paidAmt = await getBuyerPaidInPeriod(c.id, f, t);
      const debtAmt = await getBuyerDebtInPeriod(c.id, f, t);
      clientOrderIds.push({ buyerId: c.id, orderIds });
      allOrderIds.push(...orderIds);
      clientStats.push({
        buyerId: c.id,
        buyerName: c.name ?? c.email,
        buyerEmail: c.email,
        buyerAddress: c.address,
        orderCount: clientOrders.length,
        orderSum,
        paid: paidAmt,
        debt: debtAmt,
        overdue: 0,
        orders: clientOrders,
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
    select: { id: true, name: true, email: true, address: true },
  });
  const unassigned: AnalystClientStat[] = [];
  for (const c of unassignedClients) {
    const { orders: clientOrders, orderSum } = await getBuyerOrdersWithHistory(c.id, f, t);
    const orderIds = clientOrders.map((o) => o.orderId);
    const paidAmt = await getBuyerPaidInPeriod(c.id, f, t);
    const debtAmt = await getBuyerDebtInPeriod(c.id, f, t);
    clientOrderIds.push({ buyerId: c.id, orderIds });
    allOrderIds.push(...orderIds);
    unassigned.push({
      buyerId: c.id,
      buyerName: c.name ?? c.email,
      buyerEmail: c.email,
      buyerAddress: c.address,
      orderCount: clientOrders.length,
      orderSum,
      paid: paidAmt,
      debt: debtAmt,
      overdue: 0,
      orders: clientOrders,
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

export interface ProductReportBuyerDetail {
  buyerId: string;
  buyerName: string;
  agentName: string; // "—" если клиент без представителя
  orderCount: number;
  orderedQty: number;
  orderedSum: number;
}

export interface ProductReportRow {
  productId: string;
  name: string;
  unit: string | null;
  manufacturer: string | null;
  categoryName: string | null;
  orderedQty: number;
  orderedSum: number;
  orderCount: number;
  buyerCount: number;
  paidSum: number;
  unpaidSum: number;
  overdueSum: number;
  // Детализация: кто (ТП) и кому (клиент) продавал этот товар
  details: ProductReportBuyerDetail[];
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

export interface ProductsReportFilter {
  from?: string;
  to?: string;
  status?: string;
  categoryId?: string;
  manufacturer?: string;
  agentId?: string;
}

export async function getProductsReport(filter: ProductsReportFilter = {}): Promise<ProductsReport> {
  const { from, to, status, categoryId, manufacturer, agentId } = filter;
  const { from: f, to: t } = startOfPeriod(from, to);

  // Товары, попадающие под фильтры категории/производителя
  const productWhere: { categoryId?: string; manufacturer?: string } = {};
  if (categoryId) productWhere.categoryId = categoryId;
  if (manufacturer) productWhere.manufacturer = manufacturer;

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: f, lte: t },
      deleted: false,
      status: status ? status : { in: REPORT_STATUSES },
      // Фильтр по торговому представителю: через закреплённого за ним покупателя
      ...(agentId ? { buyer: { agentId } } : {}),
      ...(Object.keys(productWhere).length > 0
        ? { items: { some: { product: productWhere } } }
        : {}),
    },
    select: {
      id: true,
      buyerId: true,
      total: true,
      buyer: { select: { id: true, name: true, email: true, agent: { select: { name: true, email: true } } } },
      items: { select: { productId: true, name: true, qty: true, price: true } },
    },
  });

  const prodMap = new Map<string, ProductReportRow>();
  const prodOrders = new Map<string, Set<string>>();
  const prodBuyers = new Map<string, Set<string>>();
  // Сумма товара в конкретном заказе — для пропорционального распределения оплат и просрочки
  const prodOrderSum = new Map<string, Map<string, number>>();
  // Детализация: товар -> (клиент -> статистика продаж через ТП)
  const prodDetails = new Map<string, Map<string, ProductReportBuyerDetail>>();
  const orderTotals = new Map<string, number>();
  const orderIds: string[] = [];
  const payByOrder = new Map<string, number>();

  // id товаров, попадающих под фильтр категории/производителя
  const productIds: Set<string> | null =
    Object.keys(productWhere).length > 0
      ? new Set(
          (
            await prisma.product.findMany({
              where: productWhere,
              select: { id: true },
            })
          ).map((p) => p.id),
        )
      : null;

  for (const o of orders) {
    orderIds.push(o.id);
    orderTotals.set(o.id, o.total);
    for (const it of o.items) {
      if (productIds && !productIds.has(it.productId)) continue;
      if (!prodMap.has(it.productId)) {
        prodMap.set(it.productId, {
          productId: it.productId,
          name: it.name,
          unit: null,
          manufacturer: null,
          categoryName: null,
          orderedQty: 0,
          orderedSum: 0,
          orderCount: 0,
          buyerCount: 0,
          paidSum: 0,
          unpaidSum: 0,
          overdueSum: 0,
          details: [],
        });
      }
      const row = prodMap.get(it.productId)!;
      row.orderedQty += it.qty;
      row.orderedSum += it.qty * it.price;
      if (!prodOrders.has(it.productId)) prodOrders.set(it.productId, new Set());
      prodOrders.get(it.productId)!.add(o.id);
      if (!prodOrderSum.has(it.productId)) prodOrderSum.set(it.productId, new Map());
      const perOrder = prodOrderSum.get(it.productId)!;
      perOrder.set(o.id, (perOrder.get(o.id) ?? 0) + it.qty * it.price);
      if (!prodBuyers.has(it.productId)) prodBuyers.set(it.productId, new Set());
      prodBuyers.get(it.productId)!.add(o.buyerId);

      // Детализация товар -> клиент (с ТП)
      if (!prodDetails.has(it.productId)) prodDetails.set(it.productId, new Map());
      const byBuyer = prodDetails.get(it.productId)!;
      if (!byBuyer.has(o.buyerId)) {
        byBuyer.set(o.buyerId, {
          buyerId: o.buyerId,
          buyerName: o.buyer.name ?? o.buyer.email,
          agentName: o.buyer.agent?.name ?? o.buyer.agent?.email ?? "—",
          orderCount: 0,
          orderedQty: 0,
          orderedSum: 0,
        });
      }
      const det = byBuyer.get(o.buyerId)!;
      det.orderCount += 1;
      det.orderedQty += it.qty;
      det.orderedSum += it.qty * it.price;
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

  const prods = await prisma.product.findMany({
    select: { id: true, unit: true, manufacturer: true, category: { select: { name: true } } },
  });
  const prodInfo = new Map(prods.map((u) => [u.id, u]));

  const debtInfo = await getOrdersDebtInfo(orderIds);

  const products: ProductReportRow[] = [];
  let tQty = 0;
  let tSum = 0;
  let tPaid = 0;
  let tOverdue = 0;
  for (const [pid, row] of prodMap) {
    const info = prodInfo.get(pid);
    row.unit = info?.unit ?? null;
    row.manufacturer = info?.manufacturer ?? null;
    row.categoryName = info?.category?.name ?? null;
    row.orderCount = prodOrders.get(pid)?.size ?? 0;
    row.buyerCount = prodBuyers.get(pid)?.size ?? 0;
    const oids = prodOrders.get(pid);
    const perOrder = prodOrderSum.get(pid);
    let paid = 0;
    let overdue = 0;
    if (oids)
      for (const oid of oids) {
        // Доля товара в заказе: сумма позиций товара / итог заказа.
        // Оплата и просрочка распределяются пропорционально, а не полным заказом на каждый товар
        const share = perOrder?.get(oid) && orderTotals.get(oid)
          ? (perOrder.get(oid) as number) / (orderTotals.get(oid) as number)
          : 0;
        paid += (payByOrder.get(oid) ?? 0) * share;
        const d = debtInfo.get(oid);
        if (d?.overdue) overdue += d.unpaid * share;
      }
    row.paidSum = Number(paid.toFixed(2));
    row.unpaidSum = Number(Math.max(0, row.orderedSum - paid).toFixed(2));
    row.overdueSum = Number(overdue.toFixed(2));
    row.details = Array.from(prodDetails.get(pid)?.values() ?? []).sort(
      (a, b) => b.orderedSum - a.orderedSum,
    );
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

// Опции для фильтров отчёта товаров: производители и категории
export async function getProductFilterOptions(): Promise<{
  manufacturers: string[];
  categories: { id: string; name: string }[];
}> {
  const [manufacturers, categories] = await Promise.all([
    prisma.product.findMany({
      where: { manufacturer: { not: null } },
      select: { manufacturer: true },
      distinct: ["manufacturer"],
      orderBy: { manufacturer: "asc" },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return {
    manufacturers: manufacturers
      .map((m) => m.manufacturer)
      .filter((m): m is string => Boolean(m)),
    categories,
  };
}

// Список торговых представителей для фильтров отчётов
export async function getAgentOptions(): Promise<{ id: string; name: string }[]> {
  const agents = await prisma.user.findMany({
    where: { role: "AGENT" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  return agents.map((a) => ({ id: a.id, name: a.name ?? a.email }));
}

// ---------- Лидерборд по продажам ----------

export interface LeaderboardProductDetail {
  productId: string;
  productName: string;
  orderCount: number;
  orderedQty: number;
  orderedSum: number;
}

export interface LeaderboardAgentRow {
  agentId: string;
  agentName: string;
  clientCount: number;
  orderCount: number;
  totalSum: number;
  products: LeaderboardProductDetail[];
}

export interface LeaderboardProductRow {
  productId: string;
  productName: string;
  unit: string | null;
  orderCount: number;
  buyerCount: number;
  orderedQty: number;
  orderedSum: number;
  agents: {
    agentId: string;
    agentName: string;
    orderCount: number;
    orderedQty: number;
    orderedSum: number;
  }[];
}

export interface Leaderboard {
  agents: LeaderboardAgentRow[];
  products: LeaderboardProductRow[];
}

export async function getLeaderboard(from?: string, to?: string): Promise<Leaderboard> {
  const { from: f, to: t } = startOfPeriod(from, to);
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: f, lte: t },
      deleted: false,
      status: { in: REPORT_STATUSES },
    },
    select: {
      id: true,
      buyerId: true,
      buyer: { select: { agent: { select: { id: true, name: true, email: true } } } },
      items: { select: { productId: true, name: true, qty: true, price: true } },
    },
  });

  // --- По торговым представителям ---
  const agentMap = new Map<
    string,
    {
      agentId: string;
      agentName: string;
      clients: Set<string>;
      orders: Set<string>;
      products: Map<string, LeaderboardProductDetail>;
    }
  >();

  // --- По товарам ---
  const productMap = new Map<
    string,
    {
      productId: string;
      productName: string;
      buyers: Set<string>;
      orders: Set<string>;
      qty: number;
      sum: number;
      agents: Map<string, { agentId: string; agentName: string; orderCount: number; qty: number; sum: number }>;
    }
  >();

  for (const o of orders) {
    const agent = o.buyer.agent;
    const agentId = agent?.id ?? null;
    const agentName = agent?.name ?? agent?.email ?? "Без представителя";

    if (agentId && !agentMap.has(agentId)) {
      agentMap.set(agentId, {
        agentId,
        agentName,
        clients: new Set(),
        orders: new Set(),
        products: new Map(),
      });
    }
    const aRow = agentId ? agentMap.get(agentId)! : null;
    if (aRow) {
      aRow.clients.add(o.buyerId);
      aRow.orders.add(o.id);
    }

    for (const it of o.items) {
      const itemSum = it.qty * it.price;
      if (aRow) {
        if (!aRow.products.has(it.productId)) {
          aRow.products.set(it.productId, {
            productId: it.productId,
            productName: it.name,
            orderCount: 0,
            orderedQty: 0,
            orderedSum: 0,
          });
        }
        const pd = aRow.products.get(it.productId)!;
        pd.orderCount += 1;
        pd.orderedQty += it.qty;
        pd.orderedSum += itemSum;
      }

      if (!productMap.has(it.productId)) {
        productMap.set(it.productId, {
          productId: it.productId,
          productName: it.name,
          buyers: new Set(),
          orders: new Set(),
          qty: 0,
          sum: 0,
          agents: new Map(),
        });
      }
      const pRow = productMap.get(it.productId)!;
      pRow.buyers.add(o.buyerId);
      pRow.orders.add(o.id);
      pRow.qty += it.qty;
      pRow.sum += itemSum;

      if (agentId) {
        if (!pRow.agents.has(agentId)) {
          pRow.agents.set(agentId, {
            agentId,
            agentName,
            orderCount: 0,
            qty: 0,
            sum: 0,
          });
        }
        const ag = pRow.agents.get(agentId)!;
        ag.orderCount += 1;
        ag.qty += it.qty;
        ag.sum += itemSum;
      }
    }
  }

  const agents: LeaderboardAgentRow[] = Array.from(agentMap.values())
    .map((a) => ({
      agentId: a.agentId,
      agentName: a.agentName,
      clientCount: a.clients.size,
      orderCount: a.orders.size,
      totalSum: Array.from(a.products.values()).reduce((s, p) => s + p.orderedSum, 0),
      products: Array.from(a.products.values()).sort((x, y) => y.orderedSum - x.orderedSum),
    }))
    .sort((a, b) => b.totalSum - a.totalSum);

  const products: LeaderboardProductRow[] = Array.from(productMap.values())
    .map((p) => ({
      productId: p.productId,
      productName: p.productName,
      unit: null,
      orderCount: p.orders.size,
      buyerCount: p.buyers.size,
      orderedQty: p.qty,
      orderedSum: p.sum,
      agents: Array.from(p.agents.values())
        .map((ag) => ({
          agentId: ag.agentId,
          agentName: ag.agentName,
          orderCount: ag.orderCount,
          orderedQty: ag.qty,
          orderedSum: ag.sum,
        }))
        .sort((x, y) => y.orderedSum - x.orderedSum),
    }))
    .sort((a, b) => b.orderedSum - a.orderedSum);

  return { agents, products };
}
