import AppShell from "@/components/AppShell";
import { requireRole } from "@/lib/rbac";

export default async function CourierLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("COURIER");
  return <AppShell user={user}>{children}</AppShell>;
}
