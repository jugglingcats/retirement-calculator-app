import { describe, it, expect } from "vitest"
import { calculateCGT, updateTaxPosition } from "@/lib/tax"
import type { Assumptions, TaxPosition } from "@/lib/types"

function pos(personalAllowanceRemaining: number, basicRateRemaining: number, tax: number = 0): TaxPosition {
  return { personalAllowanceRemaining, basicRateRemaining, tax }
}

describe("updateTaxPosition", () => {
  it("returns unchanged tax and reduces personal allowance when income is below remaining allowance", () => {
    const start = pos(12_570, 37_700, 0)
    const result = updateTaxPosition(5_000, start)

    expect(result.personalAllowanceRemaining).toBe(12_570 - 5_000)
    expect(result.basicRateRemaining).toBe(37_700)
    expect(result.tax).toBe(0)

    // original object must not be mutated
    expect(start.personalAllowanceRemaining).toBe(12_570)
    expect(start.basicRateRemaining).toBe(37_700)
    expect(start.tax).toBe(0)
  })

  it("moves into basic rate after exhausting allowance (partial basic rate)", () => {
    const start = pos(12_570, 37_700, 0)
    const result = updateTaxPosition(13_000, start)

    // 13,000 - 12,570 = 430 taxable at 20%
    expect(result.personalAllowanceRemaining).toBe(0)
    expect(result.basicRateRemaining).toBe(37_700 - 430)
    expect(result.tax).toBeCloseTo(430 * 0.2, 6)
  })

  it("exactly fills the basic rate band after allowance", () => {
    const start = pos(1_000, 2_000, 0)
    const result = updateTaxPosition(3_000, start)

    // 3,000 - 1,000 = 2,000 taxed at 20%
    expect(result.personalAllowanceRemaining).toBe(0)
    expect(result.basicRateRemaining).toBe(0)
    expect(result.tax).toBeCloseTo(2_000 * 0.2, 6)
  })

  it("taxes higher-rate portion once basic band is exceeded", () => {
    const start = pos(1_000, 2_000, 0)
    const result = updateTaxPosition(4_000, start)

    // Remainder after allowance = 3,000
    // 2,000 at 20% and 1,000 at 40%
    expect(result.personalAllowanceRemaining).toBe(0)
    expect(result.basicRateRemaining).toBe(0)
    expect(result.tax).toBeCloseTo(2_000 * 0.2 + 1_000 * 0.4, 6)
  })

  it("accumulates tax on top of prior tax already recorded", () => {
    const start = pos(500, 2_000, 150)
    const result = updateTaxPosition(2_000, start)

    // 2,000 - 500 = 1,500 at 20% = 300, plus prior 150
    expect(result.tax).toBeCloseTo(150 + 1_500 * 0.2, 6)
    expect(result.personalAllowanceRemaining).toBe(0)
    expect(result.basicRateRemaining).toBe(2_000 - 1_500)
  })

  it("handles zero income as a no-op (immutably adjusting nothing)", () => {
    const start = pos(800, 1_000, 10)
    const result = updateTaxPosition(0, start)
    expect(result).not.toBe(start)
    expect(result.personalAllowanceRemaining).toBe(800)
    expect(result.basicRateRemaining).toBe(1_000)
    expect(result.tax).toBe(10)
  })
})

function baseAssumptions(overrides: Partial<Assumptions> = {}): Assumptions {
  return {
    inflationRate: 0,
    categoryGrowthRates: {},
    ...overrides
  }
}

describe("calculateCGT", () => {
  it("returns zero CGT when there are no withdrawals", () => {
    const result = calculateCGT([], baseAssumptions())
    expect(result.totalGain).toBe(0)
    expect(result.taxableGain).toBe(0)
    expect(result.cgtPayable).toBe(0)
  })

  it("returns zero CGT when gains are within allowance (default £3000)", () => {
    const withdrawals = [
      { withdrawal: 10000, baseCostRatio: 0.8 } // 20% gain = £2000 gain
    ]
    const result = calculateCGT(withdrawals, baseAssumptions())
    expect(result.totalGain).toBeCloseTo(2000, 6)
    expect(result.taxableGain).toBe(0)
    expect(result.cgtPayable).toBe(0)
  })

  it("calculates CGT at default 18% on gains above allowance", () => {
    const withdrawals = [
      { withdrawal: 20000, baseCostRatio: 0.5 } // 50% gain = £10000 gain
    ]
    const result = calculateCGT(withdrawals, baseAssumptions())
    // £10000 gain - £3000 allowance = £7000 taxable
    // £7000 * 18% = £1260
    expect(result.totalGain).toBe(10000)
    expect(result.taxableGain).toBe(7000)
    expect(result.cgtPayable).toBe(1260)
  })

  it("uses custom CGT allowance when specified", () => {
    const withdrawals = [
      { withdrawal: 10000, baseCostRatio: 0.5 } // 50% gain = £5000 gain
    ]
    const result = calculateCGT(withdrawals, baseAssumptions({ cgtAllowance: 1000 }))
    // £5000 gain - £1000 allowance = £4000 taxable
    // £4000 * 18% = £720
    expect(result.totalGain).toBe(5000)
    expect(result.taxableGain).toBe(4000)
    expect(result.cgtPayable).toBe(720)
  })

  it("uses custom CGT rate when specified", () => {
    const withdrawals = [
      { withdrawal: 10000, baseCostRatio: 0.5 } // 50% gain = £5000 gain
    ]
    const result = calculateCGT(withdrawals, baseAssumptions({ cgtAllowance: 0, cgtRate: 20 }))
    // £5000 gain - £0 allowance = £5000 taxable
    // £5000 * 20% = £1000
    expect(result.totalGain).toBe(5000)
    expect(result.taxableGain).toBe(5000)
    expect(result.cgtPayable).toBe(1000)
  })

  it("aggregates gains from multiple withdrawals", () => {
    const withdrawals = [
      { withdrawal: 10000, baseCostRatio: 0.8 }, // 20% gain = £2000 gain
      { withdrawal: 5000, baseCostRatio: 0.6 }   // 40% gain = £2000 gain
    ]
    const result = calculateCGT(withdrawals, baseAssumptions({ cgtAllowance: 0, cgtRate: 10 }))
    // Total gain = £4000
    // £4000 * 10% = £400
    expect(result.totalGain).toBeCloseTo(4000, 6)
    expect(result.taxableGain).toBeCloseTo(4000, 6)
    expect(result.cgtPayable).toBeCloseTo(400, 6)
  })

  it("handles baseCostRatio of 1 (no gain)", () => {
    const withdrawals = [
      { withdrawal: 10000, baseCostRatio: 1 } // 0% gain
    ]
    const result = calculateCGT(withdrawals, baseAssumptions({ cgtAllowance: 0 }))
    expect(result.totalGain).toBe(0)
    expect(result.taxableGain).toBe(0)
    expect(result.cgtPayable).toBe(0)
  })

  it("handles baseCostRatio of 0 (100% gain)", () => {
    const withdrawals = [
      { withdrawal: 10000, baseCostRatio: 0 } // 100% gain = £10000
    ]
    const result = calculateCGT(withdrawals, baseAssumptions({ cgtAllowance: 0, cgtRate: 18 }))
    expect(result.totalGain).toBe(10000)
    expect(result.taxableGain).toBe(10000)
    expect(result.cgtPayable).toBe(1800)
  })

  it("applies inflation multiplier to allowance", () => {
    const withdrawals = [
      { withdrawal: 10000, baseCostRatio: 0.5 } // 50% gain = £5000 gain
    ]
    // With 2x inflation multiplier, allowance becomes £6000
    const result = calculateCGT(withdrawals, baseAssumptions({ cgtAllowance: 3000 }), 2)
    // £5000 gain - £6000 allowance = £0 taxable (allowance covers all)
    expect(result.totalGain).toBe(5000)
    expect(result.taxableGain).toBe(0)
    expect(result.cgtPayable).toBe(0)
  })
})
