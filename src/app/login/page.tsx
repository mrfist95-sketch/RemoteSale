import LoginForm from "./LoginForm";
import InstallPrompt from "@/components/InstallPrompt";

const DEMO_ACCOUNTS = [
  { role: "Администратор", email: "admin@demo.onsale" },
  { role: "Продавец", email: "seller@demo.onsale" },
  { role: "Торговый агент", email: "agent@demo.onsale" },
  { role: "Покупатель", email: "buyer@demo.onsale" },
  { role: "Курьер", email: "courier@demo.onsale" },
  { role: "Аналитик", email: "analyst@demo.onsale" },
];

export default function LoginPage() {
  const isDemo = process.env.NEXT_PUBLIC_DEMO === "true";
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-slate-100 p-4 md:flex-row md:items-center md:gap-16 md:p-8">
      <div className="max-w-md text-center md:text-left">
        <div className="flex items-center justify-center gap-3 md:justify-start">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-xl font-extrabold text-white">OS</span>
          <span className="text-5xl font-bold tracking-tight text-brand-600">OnSale</span>
        </div>
        <p className="mt-4 text-2xl leading-snug text-slate-900">
          Оптовые заказы — от заявки до оплаты в одном окне.
        </p>
      </div>

      <div className="w-full max-w-[26rem]">
        <div className="rounded-xl bg-white p-5 shadow-[0_2px_4px_rgb(0_0_0/0.1),0_8px_16px_rgb(0_0_0/0.1)]">
          <h1 className="mb-1 text-lg font-bold text-slate-900">Вход в кабинет</h1>
          <p className="mb-4 text-sm text-slate-500">Email и пароль выдаёт администратор.</p>
          <LoginForm />
          <InstallPrompt />
        </div>
        {isDemo && (
          <div className="mt-4 rounded-xl bg-white p-4 text-xs text-slate-700 shadow-soft">
            <p className="mb-1.5 text-sm font-bold text-slate-900">Демо-режим · пароль для всех: demo1234</p>
            <ul className="space-y-0.5">
              {DEMO_ACCOUNTS.map((d) => (
                <li key={d.email}>
                  {d.role}: <span className="font-mono">{d.email}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-slate-500">
              Это демонстрационная копия. Данные периодически сбрасываются — не вносите реальные данные.
            </p>
          </div>
        )}
        <p className="mt-4 text-center text-xs text-slate-500">© Галеро-РМ 2026</p>
      </div>
    </main>
  );
}
