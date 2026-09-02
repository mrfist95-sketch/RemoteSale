import AppShell from "@/components/AppShell";
import { requireRole } from "@/lib/rbac";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("SELLER");
  return <AppShell user={user}>{children}</AppShell>;
}
