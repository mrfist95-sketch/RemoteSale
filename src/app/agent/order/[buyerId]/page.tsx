import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import CreateOrderForm from "@/components/CreateOrderForm";
import { createOrder } from "@/app/actions";

export default async function AgentOrderForClient({
  params,
}: {
  params: Promise<{ buyerId: string }>;
}) {
  const user = await requireRole("AGENT");
  const { buyerId } = await params;
  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (!buyer || buyer.agentId !== user.id) notFound();

  const products = await prisma.product.findMany({
    where: { deleted: false },
    orderBy: { article: "asc" },
    select: {
      id: true,
      name: true,
      price: true,
      unit: true,
      stock: true,
      manufacturer: true,
      category: { select: { name: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title={`Заказ для ${buyer.name ?? buyer.email}`}
        subtitle="Черновик: после оформления передайте в работу в разделе «Заказы клиентов»"
      />
      <Card>
        <CreateOrderForm
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            unit: p.unit,
            stock: p.stock,
            categoryName: p.category?.name ?? null,
            manufacturer: p.manufacturer,
          }))}
          buyerId={buyerId}
          action={createOrder}
        />
      </Card>
    </div>
  );
}
