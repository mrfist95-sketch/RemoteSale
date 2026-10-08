// Результат server action. Ожидаемые ошибки (валидация, права, бизнес-правила)
// возвращаются значением: в production Next.js скрывает текст брошенных
// исключений, и пользователь видел бы только «An error occurred».
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Ошибка, текст которой можно показать пользователю */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

/** На клиенте: вернуть данные или бросить Error с понятным текстом */
export function unwrap<T extends object>(res: ActionResult<T>): { ok: true } & T {
  if (!res || res.ok !== true) {
    throw new Error((res as { error?: string })?.error || "Не удалось выполнить операцию");
  }
  return res;
}
