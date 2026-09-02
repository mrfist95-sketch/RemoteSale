import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/rbac";
import { PageHeader, Card } from "@/components/ui";
import CreateUserForm from "@/components/CreateUserForm";
import UserRow from "@/components/UserRow";
import RoleFilter from "@/components/RoleFilter";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  await requireRole("ADMIN");
  const { role } = await searchParams;
  const users = await prisma.user.findMany({
    where: role ? { role } : undefined,
    orderBy: { role: "asc" },
  });
  const agents = await prisma.user.findMany({
    where: { role: "AGENT" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return (
    <div>
      <PageHeader title="Пользователи и роли" />
      <Card title="Создать пользователя">
        <CreateUserForm agents={agents} />
      </Card>

      <Card title="Список пользователей" className="mt-4">
        <div className="mb-3">
          <RoleFilter current={role ?? "ALL"} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-2">Пользователь</th>
                <th className="py-2">Роль</th>
                <th className="py-2">Агент</th>
                <th className="py-2">Покупатель</th>
                <th className="py-2">Пароль</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={{
                    id: u.id,
                    email: u.email,
                    name: u.name,
                    role: u.role,
                    agentId: u.agentId,
                    address: u.address,
                    phone: u.phone,
                    comment: u.comment,
                    deferral: u.deferral,
                  }}
                  agents={agents}
                />
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && <p className="mt-3 text-sm text-zinc-400">Нет пользователей</p>}
        <p className="mt-3 text-xs text-zinc-400">
          Роли: {Object.entries(ROLE_LABELS).map(([k, v]) => `${k}=${v}`).join(", ")}
        </p>
      </Card>
    </div>
  );
}
