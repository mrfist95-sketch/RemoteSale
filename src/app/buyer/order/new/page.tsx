import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import CreateOrderForm from "@/components/CreateOrderForm";
import { createOrder } from "@/app/actions";

export default async function NewOrderPage() {
  const user = await requireRole("BUYER");
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
        title="Новый заказ"
        subtitle="Черновик: можно вернуться и передать в работу в разделе «Мои заказы»"
      />
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
        buyerId={user.id}
        action={createOrder}
      />
    </div>
  );
}
