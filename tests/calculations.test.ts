import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { calculateProjection } from "@/lib/calculations"
import { AssetType, RetirementData } from "@/types"

function baseData(overrides: Partial<RetirementData> = {}): RetirementData {
    const current = new Date()
    const currentYear = current.getFullYear()

    const data: RetirementData = {
        personal: {
            dateOfBirth: `${currentYear - 60}-01-01`,
            spouseDateOfBirth: "",
            retirementAge: 60
        },
        assets: [
            { id: "c", name: "Cash", value: 0, category: AssetType.Cash },
            { id: "i", name: "ISA", value: 0, category: AssetType.ISA },
            { id: "p", name: "Pension", value: 0, category: AssetType.Pension },
            { id: "pr", name: "Property", value: 0, category: AssetType.Property }
        ],
        incomeNeeds: [{ id: "need", description: "Base need", annualAmount: 0, startingAge: 60 }],
        retirementIncome: [],
        assumptions: {
            inflationRate: 0,
            categoryGrowthRates: {
                Cash: 0,
                "Stocks & Shares": 0,
                Pensions: 0,
                Property: 0
            }
        },
        incomeTax: {
            personalAllowance: 12570,
            higherRateThreshold: 50270
        },
        shocks: [],
        oneOffs: []
    }

    // Deep merge minimal (shallow is enough for these tests)
    return { ...data, ...overrides } as RetirementData
}

describe("calculateProjection", () => {
    const fixedNow = new Date("2025-01-01T00:00:00Z")

    beforeAll(() => {
        // Stabilize time-dependent logic
        vi.useFakeTimers()
        vi.setSystemTime(fixedNow)
        vi.spyOn(console, "clear").mockImplementation(() => {})
        vi.spyOn(console, "log").mockImplementation(() => {})
    })

    afterAll(() => {
        vi.useRealTimers()
        ;(console.clear as any).mockRestore?.()
        ;(console.log as any).mockRestore?.()
    })

    beforeEach(() => {
        // Ensure timers still set each test
        vi.setSystemTime(fixedNow)
    })

    it("returns null when dateOfBirth is missing", () => {
        const data = baseData({
            personal: { dateOfBirth: "", spouseDateOfBirth: "", retirementAge: 60 },
            assets: [{ id: "c", name: "Cash", value: 1000, category: AssetType.Cash }]
        })
        const result = calculateProjection(data)
        expect(result.yearlyData).toHaveLength(0)
    })

    it("returns null when no assets provided", () => {
        const data = baseData({ assets: [] })
        const result = calculateProjection(data)
        expect(result.yearlyData).toHaveLength(0)
    })

    it("adds state pension from age 67 (no inflation)", () => {
        const data = baseData()
        const result = calculateProjection(data)
        const startAge = 60
        const arr = result.yearlyData
        const at66 = arr.find(y => y.age === 66)!
        const at67 = arr.find(y => y.age === 67)!
        expect(at66.statePension).toBe(0)
        expect(at67.statePension).toBe(11502)
    })

    it("includes spouse state pension when spouse reaches 67 (no inflation)", () => {
        // Primary is 60, spouse is 66 now so spouse hits 67 next year
        const thisYear = fixedNow.getFullYear()
        const data = baseData({
            personal: {
                dateOfBirth: `${thisYear - 60}-01-01`,
                spouseDateOfBirth: `${thisYear - 66}-01-01`,
                retirementAge: 60
            }
        })
        const result = calculateProjection(data)!
        const at67 = result.yearlyData.find(y => y.age === 67)!
        // At age 67 primary gets pension, spouse 67 too, so double
        expect(at67.statePension).toBe(11502 * 2)
    })

    it("withdraws in order: cash -> ISA -> pension -> property; calculates zero tax under allowance", () => {
        const data = baseData({
            assets: [
                { id: "c", name: "Cash", value: 1000, category: AssetType.Cash },
                { id: "i", name: "ISA", value: 2000, category: AssetType.ISA },
                { id: "p", name: "Pension", value: 3000, category: AssetType.Pension },
                { id: "pr", name: "Property", value: 4000, category: AssetType.Property }
            ],
            incomeNeeds: [{ id: "need", description: "Need", annualAmount: 5000, startingAge: 60 }],
            assumptions: {
                inflationRate: 0,
                categoryGrowthRates: { Cash: 0, "Stocks & Shares": 0, Pensions: 0, Property: 0 }
            }
        })
        const result = calculateProjection(data, 1, "lowest_growth_first")
        const first = result.yearlyData[0]
        expect(first.taxPayable).toBe(0)
        // After withdrawing 5000: cash 0, isa 0 (2000 used), pension 1000, property 4000
        expect(first.cash).toBe(0)
        expect(first.isa).toBe(0)
        expect(first.pension).toBe(1000)
        expect(first.property).toBe(4000)
        expect(first.assets).toBe(5000) // 10000 - 5000
    })

    it("applies income tax on taxable withdrawals and pays tax from assets", () => {
        const data = baseData({
            assets: [
                { id: "c", name: "Cash", value: 5000, category: AssetType.Cash },
                { id: "i", name: "ISA", value: 0, category: AssetType.ISA },
                { id: "p", name: "Pension", value: 50000, category: AssetType.Pension },
                { id: "pr", name: "Property", value: 0, category: AssetType.Property }
            ],
            incomeNeeds: [{ id: "need", description: "Need", annualAmount: 30000, startingAge: 60 }],
            incomeTax: { personalAllowance: 12570, higherRateThreshold: 50270 }
        })

        const result = calculateProjection(data)!
        const first = result.yearlyData.find(y => y.age === 60)!
        // Taxable income = 30000 (cash 5k + pension 25k), allowance 12570 => tax 20% of 17430 = 3486
        expect(Math.round(first.taxPayable)).toBe(3486)
        // Assets decreased by shortfall + tax, initial total 55000
        expect(first.assets).toBe(55000 - 30000 - 3486)
        // Tax paid from assets ultimately reduces pension (cash was 0 after withdrawal)
        expect(first.cash).toBe(0)
        expect(first.pension).toBe(50000 - 25000 - 3486)
    })

    it("applies one-off events to cash at the specified age (no inflation, no withdrawals)", () => {
        const base = baseData({
            personal: { dateOfBirth: "1965-01-01", spouseDateOfBirth: "1965-01-01", retirementAge: 70 },
            assumptions: {
                inflationRate: 0,
                categoryGrowthRates: { Cash: 0, "Stocks & Shares": 0, Pensions: 0, Property: 0 }
            },
            assets: [
                { id: "c", name: "Cash", value: 1000, category: AssetType.Cash },
                { id: "i", name: "ISA", value: 0, category: AssetType.ISA },
                { id: "p", name: "Pension", value: 0, category: AssetType.Pension },
                { id: "pr", name: "Property", value: 0, category: AssetType.Property }
            ],
            oneOffs: [{ id: "o", description: "Gift", amount: 1000, age: 61, enabled: true }]
        })
        // Fix time such that current age is 60
        const thisYear = fixedNow.getFullYear()
        const data = { ...base, personal: { ...base.personal, dateOfBirth: `${thisYear - 60}-01-01` } }
        const result = calculateProjection(data)!
        const at60 = result.yearlyData.find(y => y.age === 60)!
        const at61 = result.yearlyData.find(y => y.age === 61)!
        expect(at61.cash - at60.cash).toBe(1000)
        expect(at61.assets - at60.assets).toBe(1000)
    })

    it("applies market shocks to all assets in the shock year", () => {
        const thisYear = fixedNow.getFullYear()
        const data = baseData({
            assets: [
                { id: "c", name: "Cash", value: 2000, category: AssetType.Cash },
                { id: "i", name: "ISA", value: 2000, category: AssetType.ISA },
                { id: "p", name: "Pension", value: 2000, category: AssetType.Pension },
                { id: "pr", name: "Property", value: 2000, category: AssetType.Property }
            ],
            shocks: [{ id: "s", year: thisYear, impactPercent: -50 }],
            personal: {
                dateOfBirth: `${thisYear - 60}-01-01`,
                spouseDateOfBirth: `${thisYear - 60}-01-01`,
                retirementAge: 70
            }
        })
        const result = calculateProjection(data)!
        const first = result.yearlyData.find(y => y.age === 60)!
        expect(first.assets).toBe(4000) // 8000 * 0.5
    })

    it("sets runsOutAt when assets reach zero at or after retirement", () => {
        const thisYear = fixedNow.getFullYear()
        const data = baseData({
            personal: {
                dateOfBirth: `${thisYear - 60}-01-01`,
                spouseDateOfBirth: `${thisYear - 60}-01-01`,
                retirementAge: 60
            },
            assets: [
                { id: "c", name: "Cash", value: 10000, category: AssetType.Cash },
                { id: "i", name: "ISA", value: 0, category: AssetType.ISA },
                { id: "p", name: "Pension", value: 0, category: AssetType.Pension },
                { id: "pr", name: "Property", value: 0, category: AssetType.Property }
            ],
            incomeNeeds: [{ id: "need", description: "Need", annualAmount: 4000, startingAge: 60 }]
        })
        const result = calculateProjection(data)!
        const ageRunOut = 60 + 2 // third year
        const yearRunOut = thisYear - 60 + ageRunOut
        expect(result.runsOutAt).toBe(yearRunOut)
        const atRunOut = result.yearlyData.find(y => y.age === ageRunOut)!
        expect(atRunOut.assets).toBe(0)
    })

    it("surplus branch: when income >= expenditure, no tax charged and assets unchanged (apart from growth)", () => {
        const thisYear = fixedNow.getFullYear()
        const data = baseData({
            personal: {
                dateOfBirth: `${thisYear - 60}-01-01`,
                spouseDateOfBirth: `${thisYear - 60}-01-01`,
                retirementAge: 60
            },
            assets: [
                { id: "c", name: "Cash", value: 1000, category: AssetType.Cash },
                { id: "i", name: "ISA", value: 0, category: AssetType.ISA },
                { id: "p", name: "Pension", value: 0, category: AssetType.Pension },
                { id: "pr", name: "Property", value: 0, category: AssetType.Property }
            ],
            incomeNeeds: [{ id: "need", description: "Need", annualAmount: 500, startingAge: 60 }],
            retirementIncome: [
                {
                    id: "ri",
                    description: "Payout",
                    annualAmount: 1000,
                    startYear: thisYear,
                    enabled: true,
                    inflationAdjusted: false
                }
            ]
        })
        const result = calculateProjection(data)!
        const first = result.yearlyData.find(y => y.age === 60)!
        expect(first.taxPayable).toBe(0)
        // With 0 growth, assets remain same
        expect(first.assets).toBe(1000)
    })
})
