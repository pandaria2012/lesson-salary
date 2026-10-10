export function fmtMoney(n: number): string {
  return n.toFixed(2)
}

export function fmtHours(n: number): string {
  return String(Math.round(n * 100) / 100)
}
