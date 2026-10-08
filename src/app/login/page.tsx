import LoginForm from "./LoginForm";
import InstallPrompt from "@/components/InstallPrompt";

export default function LoginPage() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-900 text-base font-bold text-white">OS</div>
        <h1 className="mb-1 text-2xl font-semibold leading-tight text-brand-900">OnSale</h1>
        <p className="mb-6 text-sm text-zinc-500">Вход в личный кабинет</p>
        <LoginForm />
        <InstallPrompt />
        <div className="mt-6 text-center text-[11px] text-zinc-400">© Галеро-РМ 2026</div>
      </div>
    </div>
  );
}