// Деньги хранятся в рублях (Float) — все операции округляем до копеек,
// а сравнения делаем с допуском в полкопейки.
export const MONEY_EPS = 0.005;

export function roundMoney(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function moneyGte(a: number, b: number): boolean {
  return a > b - MONEY_EPS;
}

export function moneyGt(a: number, b: number): boolean {
  return a > b + MONEY_EPS;
}

export function fmtMoney(v: number): string {
  return `${roundMoney(v).toFixed(2)} ₽`;
}
