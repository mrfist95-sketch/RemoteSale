import LoginForm from "./LoginForm";
import InstallPrompt from "@/components/InstallPrompt";

export default function LoginPage() {
  return (
    <div className="grid min-h-full md:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-ink-800 to-ink-900 p-12 text-white md:flex">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-700/40 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 font-bold">OS</span>
          <span className="text-lg font-semibold">OnSale</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-[1.15] tracking-tight">Оптовые заказы — от заявки до оплаты в одном окне</h2>
          <p className="mt-4 text-base text-slate-300">
            Покупатели и агенты собирают заказы, продавец ведёт их по статусам, курьер отмечает доставку.
          </p>
        </div>
        <div className="relative text-xs text-slate-400">© Галеро-РМ 2026</div>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-base font-bold text-white">OS</div>
          </div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-brand-900">Вход в кабинет</h1>
          <p className="mb-6 text-sm text-slate-500">Введите email и пароль, которые выдал администратор.</p>
          <LoginForm />
          <InstallPrompt />
        </div>
      </main>
    </div>
  );
}
