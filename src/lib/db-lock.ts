// Очередь пишущих транзакций. SQLite допускает одного писателя; при параллельных
// интерактивных транзакциях Prisma они ждут друг друга до таймаута («Socket timeout»).
// Приложение работает одним процессом, поэтому выстраиваем транзакции в очередь
// внутри процесса: двойной клик или два продавца одновременно — обрабатываются по очереди.
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const g = globalThis as unknown as { __dbWriteQueue?: Promise<unknown> };

export function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__dbWriteQueue ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  g.__dbWriteQueue = run.catch(() => undefined);
  return run;
}

/** Интерактивная транзакция в общей очереди записи */
export function writeTx<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  opts: { maxWait?: number; timeout?: number } = {},
): Promise<T> {
  return withWriteLock(() => prisma.$transaction(fn, { maxWait: 10_000, timeout: 20_000, ...opts }));
}
