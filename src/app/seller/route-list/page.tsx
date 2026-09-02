import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatRub } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import PrintButton from "@/components/PrintButton";

export default async function RouteListPage() {
  await requireRole("SELLER");
  const orders = await prisma.order.findMany({
    where: { deleted: false, status: { in: ["ASSEMBLED", "SHIPPED"] } },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      buyer: { select: { name: true, email: true, address: true, phone: true, comment: true } },
    },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <PageHeader title="Маршрутный лист" subtitle="Что передаётся курьеру" />
        <PrintButton />
      </div>

      <div className="hidden print:block">
        <h1 className="text-lg font-bold">Маршрутный лист — {new Date().toLocaleDateString("ru-RU")}</h1>
      </div>

      {orders.length === 0 && <p className="text-sm text-zinc-400">Нет заказов к передаче</p>}
      <div className="space-y-4">
        {orders.map((o) => (
          <div key={o.id} className="break-inside-avoid rounded-lg border border-zinc-300 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-zinc-300 pb-2">
              <div className="text-sm">
                <span className="font-bold">Заказ №{o.number}</span>
                <span className="ml-2 text-zinc-600">
                  {o.buyer.name ?? o.buyer.email}
                </span>
              </div>
              <div className="text-sm font-semibold">{formatRub(o.total)}</div>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
              <div>
                <span className="text-zinc-500">Адрес: </span>
                {o.buyer.address ?? "—"}
              </div>
              <div>
                <span className="text-zinc-500">Телефон: </span>
                {o.buyer.phone ?? "—"}
              </div>
              {o.buyer.comment && (
                <div className="sm:col-span-2">
                  <span className="text-zinc-500">Комментарий: </span>
                  {o.buyer.comment}
                </div>
              )}
            </div>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="py-1">Товар</th>
                  <th className="py-1 text-right">Кол-во</th>
                  <th className="py-1 text-right">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.id} className="border-t border-zinc-100">
                    <td className="py-1">{i.name}</td>
                    <td className="py-1 text-right">{i.qty}</td>
                    <td className="py-1 text-right">{formatRub(i.qty * i.price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  <td className="pt-1 text-right text-zinc-500">Итого</td>
                  <td className="pt-1 text-right font-bold">{formatRub(o.total)}</td>
                </tr>
              </tfoot>
            </table>
            <div className="mt-2 border-t border-dashed border-zinc-300 pt-2 text-xs text-zinc-400">
              Подпись получателя: ____________________
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
