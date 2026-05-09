import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { advanceDebt, monthlyInterestRate, monthsToRepay, payoffDate, stepDebtMonth, totalDebtBalance } from "@/lib/debt"
import { calculateProjection } from "@/lib/calculations"
import { AssetType, RetirementData } from "@/lib/types"
import { householdYearly } from "@/lib/yearlyView"

describe("debt helpers", () => {
    it("monthlyInterestRate divides APR/100 by 12", () => {
        expect(monthlyInterestRate(0)).toBe(0)
        expect(monthlyInterestRate(12)).toBeCloseTo(0.01, 10)
        expect(monthlyInterestRate(6)).toBeCloseTo(0.005, 10)
    })

    it("stepDebtMonth applies interest then repayment", () => {
        const r = stepDebtMonth(1000, 12, 100) // 1% interest, 100 repaid
        expect(r.interest).toBeCloseTo(10, 6)
        expect(r.paid).toBeCloseTo(100, 6)
        expect(r.balance).toBeCloseTo(910, 6)
    })

    it("stepDebtMonth caps repayment at remaining balance", () => {
        const r = stepDebtMonth(50, 12, 100)
        expect(r.balance).toBe(0)
        expect(r.paid).toBeCloseTo(50.5, 6)
    })

    it("monthsToRepay returns infinity when repayment doesn't cover interest", () => {
        expect(monthsToRepay(10000, 12, 50)).toBe(Infinity) // monthly interest = 100
        expect(monthsToRepay(10000, 0, 0)).toBe(Infinity)
    })

    it("monthsToRepay matches a known mortgage-style amortisation", () => {
        // £100k @ 0% APR with £1000/month → 100 months
        expect(monthsToRepay(100_000, 0, 1000)).toBe(100)
    })

    it("advanceDebt over the full term clears the balance", () => {
        const months = monthsToRepay(50_000, 5, 500)
        const result = advanceDebt(50_000, 5, 500, months + 1)
        expect(result.balance).toBeCloseTo(0, 4)
    })

    it("payoffDate is null for unrepayable debts", () => {
        expect(payoffDate(10_000, 12, 50)).toBeNull()
    })

    it("totalDebtBalance sums enabled debts only", () => {
        expect(
            totalDebtBalance([
                { id: "a", name: "A", balance: 100, aprPercent: 0, monthlyRepayment: 0 },
                { id: "b", name: "B", balance: 200, aprPercent: 0, monthlyRepayment: 0, enabled: false },
                { id: "c", name: "C", balance: 50, aprPercent: 0, monthlyRepayment: 0, enabled: true }
            ])
        ).toBe(150)
    })
})

describe("calculateProjection — debts", () => {
    const fixedNow = new Date("2025-01-01T00:00:00Z")

    beforeAll(() => {
        vi.useFakeTimers()
        vi.setSystemTime(fixedNow)
        vi.spyOn(console, "clear").mockImplementation(() => {})
    })
    afterAll(() => {
        vi.useRealTimers()
    })

    function baseData(): RetirementData {
        const currentYear = 2025
        return {
            personal: { dateOfBirth: `${currentYear - 60}-01-01`, spouseDateOfBirth: "", retirementAge: 60 },
            assets: [{ id: "c", name: "Cash", value: 200_000, category: AssetType.Cash }],
            incomeNeeds: [{ id: "n", description: "spend", annualAmount: 0, startingAge: 60 }],
            incomeStreams: [],
            assumptions: { inflationRate: 0, categoryGrowthRates: { Cash: 0 } },
            incomeTax: { personalAllowance: 12570, higherRateThreshold: 50270 },
            shocks: [],
            oneOffs: [],
            debts: []
        }
    }

    it("records debt repayments and reduces cash via the strategy", () => {
        const data = baseData()
        data.debts = [{ id: "m", name: "Mortgage", balance: 12_000, aprPercent: 0, monthlyRepayment: 1000 }]
        const result = calculateProjection(data, 1, "balanced")
        const yd = result.yearlyData[0]
        expect(yd.debt).toBeDefined()
        expect(yd.debt!.startBalance).toBeCloseTo(12_000, 4)
        expect(yd.debt!.repayments).toBeCloseTo(12_000, 4)
        expect(yd.debt!.endBalance).toBeCloseTo(0, 4)
        // Cash withdrawal funds the £12k repayment.
        const hh = householdYearly(yd)
        expect(hh.assetWithdrawals).toBeGreaterThan(0)
    })

    it("interest is compounded monthly at APR/12", () => {
        const data = baseData()
        data.debts = [{ id: "m", name: "Mortgage", balance: 100_000, aprPercent: 12, monthlyRepayment: 0 }]
        const result = calculateProjection(data, 1, "balanced")
        const yd = result.yearlyData[0]
        // 12 months at 1% per month with no repayment → balance grows by (1.01)^12 ≈ 1.1268
        expect(yd.debt!.endBalance).toBeCloseTo(100_000 * Math.pow(1.01, 12), 0)
    })
})
