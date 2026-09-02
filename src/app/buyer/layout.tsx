import AppShell from "@/components/AppShell";
import { requireRole } from "@/lib/rbac";

export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("BUYER");
  return <AppShell user={user}>{children}</AppShell>;
}
