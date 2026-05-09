import { Debt } from "@/lib/types"

/**
 * Convert an APR (annual percentage rate, e.g. 5 for 5%) into the equivalent
 * monthly periodic interest rate (as a decimal). Uses the simple convention
 * APR / 12, which is what most retail mortgage and loan repayment schedules
 * effectively use for monthly compounding/repayment.
 */
export function monthlyInterestRate(aprPercent: number): number {
    return aprPercent / 100 / 12
}

/**
 * Apply one month of interest accrual followed by a fixed repayment to a debt
 * balance. Returns the new balance (clamped at 0), the interest accrued and
 * the actual amount repaid (which may be less than `monthlyRepayment` if the
 * debt is paid off this month).
 */
export function stepDebtMonth(
    balance: number,
    aprPercent: number,
    monthlyRepayment: number
): { balance: number; interest: number; paid: number } {
    if (balance <= 0) return { balance: 0, interest: 0, paid: 0 }
    const r = monthlyInterestRate(aprPercent)
    const interest = balance * r
    const withInterest = balance + interest
    const paid = Math.min(monthlyRepayment, withInterest)
    const newBalance = Math.max(0, withInterest - paid)
    return { balance: newBalance, interest, paid }
}

/**
 * Advance a single debt by `months` months. Returns the new balance, total
 * interest accrued and total repaid over the period.
 */
export function advanceDebt(
    balance: number,
    aprPercent: number,
    monthlyRepayment: number,
    months: number
): { balance: number; interest: number; paid: number } {
    let b = balance
    let interest = 0
    let paid = 0
    for (let i = 0; i < months; i++) {
        const step = stepDebtMonth(b, aprPercent, monthlyRepayment)
        b = step.balance
        interest += step.interest
        paid += step.paid
        if (b <= 0) break
    }
    return { balance: b, interest, paid }
}

/**
 * Compute the number of whole months required to fully repay a debt at the
 * given fixed monthly repayment. Returns `Infinity` if the repayment does not
 * cover the monthly interest (debt grows forever). A safety cap of 1200
 * months (100 years) is applied.
 */
export function monthsToRepay(balance: number, aprPercent: number, monthlyRepayment: number): number {
    if (balance <= 0) return 0
    if (monthlyRepayment <= 0) return Infinity
    const r = monthlyInterestRate(aprPercent)
    // If repayment doesn't cover interest, debt never repays.
    if (monthlyRepayment <= balance * r) return Infinity
    let b = balance
    let n = 0
    const cap = 1200
    while (b > 0 && n < cap) {
        const interest = b * r
        b = b + interest - monthlyRepayment
        n++
        if (b <= 0) return n
    }
    return n >= cap ? Infinity : n
}

/**
 * Compute the projected payoff date for a debt as a Date object (last day of
 * the payoff month). Returns null when the debt is unrepayable at the current
 * monthly repayment.
 */
export function payoffDate(balance: number, aprPercent: number, monthlyRepayment: number, from: Date = new Date()): Date | null {
    const m = monthsToRepay(balance, aprPercent, monthlyRepayment)
    if (!isFinite(m)) return null
    const d = new Date(from.getFullYear(), from.getMonth() + m, 1)
    return d
}

/** Total outstanding balance across all enabled debts. */
export function totalDebtBalance(debts: Debt[] | undefined): number {
    if (!debts) return 0
    return debts.reduce((sum, d) => sum + (d.enabled === false ? 0 : d.balance || 0), 0)
}
