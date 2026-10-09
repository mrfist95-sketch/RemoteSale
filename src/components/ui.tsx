import Link from "next/link";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-brand-900">{title}</h1>
      {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-900/5">
      <span aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-brand-500" />
      <div className="pl-2 text-[13px] font-medium text-slate-500">{label}</div>
      <div className="mt-1 pl-2 text-2xl font-semibold tracking-tight text-brand-900">{value}</div>
      {hint && <div className="mt-0.5 pl-2 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Card({
  title,
  children,
  action,
  className,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-900/5 md:p-5 ${className ?? ""}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="font-semibold tracking-tight text-brand-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 py-10 text-center text-sm text-slate-500">{children}</p>;
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-sm text-slate-500 transition-colors hover:text-brand-700">
      ← {label}
    </Link>
  );
}
