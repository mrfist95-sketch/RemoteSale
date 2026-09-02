import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import CatalogTable from "@/components/CatalogTable";
import Link from "next/link";

export default async function CatalogPage() {
  await requireRole("BUYER");
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
      <PageHeader title="Каталог товаров" subtitle="Актуальный прайс-лист" />
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
        <div className="mt-4">
          <Link
            href="/buyer/order/new"
            className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            Сформировать заказ
          </Link>
        </div>
      </Card>
    </div>
  );
}