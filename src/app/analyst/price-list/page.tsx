import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import CatalogTable from "@/components/CatalogTable";

export default async function AnalystPriceListPage() {
  await requireRole("ANALYST");
  const products = await prisma.product.findMany({
    where: { deleted: false },
    orderBy: { article: "asc" },
    select: {
      id: true,
      article: true,
      name: true,
      unit: true,
      price: true,
      stock: true,
      manufacturer: true,
      category: { select: { name: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Прайс-лист"
        subtitle="Актуальные цены, которые видят торговые представители при оформлении заказов"
      />
      <Card>
        <CatalogTable
          products={products.map((p) => ({
            id: p.id,
            article: p.article,
            name: p.name,
            unit: p.unit,
            price: p.price,
            stock: p.stock,
            categoryName: p.category?.name ?? null,
            manufacturer: p.manufacturer,
          }))}
        />
      </Card>
    </div>
  );
}