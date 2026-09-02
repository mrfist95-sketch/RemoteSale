import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import PriceListUploader from "@/components/PriceListUploader";
import ProductEditor from "@/components/ProductEditor";

export default async function AdminPriceListPage() {
  await requireRole("ADMIN");
  const products = await prisma.product.findMany({
    orderBy: { article: "asc" },
    select: {
      id: true,
      article: true,
      name: true,
      unit: true,
      price: true,
      stock: true,
      manufacturer: true,
      deleted: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  });
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  const uploads = await prisma.priceList.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { uploadedBy: { select: { email: true } }, _count: { select: { products: true } } },
  });

  return (
    <div>
      <PageHeader title="Прайс-лист" subtitle="Загрузка и ручное редактирование" />
      <Card title="Загрузить прайс-лист (CSV / XLSX)">
        <PriceListUploader />
        <p className="mt-2 text-xs text-zinc-400">
          Колонки: article/артикул, name/наименование, unit/единица, price/цена, stock/остаток,
          category/категория, manufacturer/производитель. Существующие артикулы обновляются.
        </p>
      </Card>

      <Card title={`Товары (${products.length})`} className="mt-4">
        <ProductEditor
          products={products.map((p) => ({
            id: p.id,
            article: p.article,
            name: p.name,
            unit: p.unit,
            price: p.price,
            stock: p.stock,
            categoryId: p.categoryId,
            categoryName: p.category?.name ?? null,
            manufacturer: p.manufacturer,
            deleted: p.deleted,
          }))}
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            _count: { products: c._count.products },
          }))}
        />
      </Card>

      <Card title="История загрузок" className="mt-4">
        <ul className="divide-y divide-zinc-100 text-sm">
          {uploads.map((u) => (
            <li key={u.id} className="flex justify-between py-2">
              <span>{u.fileName}</span>
              <span className="text-zinc-400">
                {u._count.products} поз. · {u.uploadedBy.email}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
