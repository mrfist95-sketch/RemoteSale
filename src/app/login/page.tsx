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
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold leading-tight">OnSale</h1>
        <p className="mb-6 text-sm text-zinc-500">Вход в личный кабинет</p>
        <LoginForm />
        {isDemo && (
          <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="mb-1 font-semibold">ДЕМО-РЕЖИМ (пароль для всех: demo1234)</p>
            <ul className="space-y-0.5">
              {DEMO_ACCOUNTS.map((d) => (
                <li key={d.email}>
                  {d.role}: <span className="font-mono">{d.email}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-amber-700">
              Это демонстрационная копия. Данные периодически сбрасываются — не вносите реальные данные.
            </p>
          </div>
        )}
        <InstallPrompt />
        <div className="mt-6 text-center text-[11px] text-zinc-400">© Галеро-РМ 2026</div>
      </div>
    </div>
  );
}