import { describe, it, expect } from "vitest"
import { updateTaxPosition } from "@/lib/tax"
import type { TaxPosition } from "@/lib/types"

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
