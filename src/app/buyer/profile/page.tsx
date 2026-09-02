import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import BuyerProfileForm from "@/components/BuyerProfileForm";

export default async function BuyerProfilePage() {
  const user = await requireRole("BUYER");
  const db = await prisma.user.findUnique({
    where: { id: user.id },
    select: { address: true, phone: true, comment: true, deferral: true },
  });
  return (
    <div>
      <PageHeader
        title="Мои данные"
        subtitle={`Адрес и телефон · отсрочка оплаты: ${db?.deferral ?? 0} дн. (устанавливается админом)`}
      />
      <Card title="Профиль">
        <BuyerProfileForm
          initial={{
            address: db?.address ?? null,
            phone: db?.phone ?? null,
            comment: db?.comment ?? null,
          }}
        />
      </Card>
    </div>
  );
}
