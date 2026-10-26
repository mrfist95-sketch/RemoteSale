import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <div className="text-4xl font-bold text-brand-900">404</div>
      <p className="mt-2 text-sm text-slate-500">Страница не найдена или у вас нет к ней доступа.</p>
      <Link href="/" className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
        На главную
      </Link>
    </div>
  );
}
