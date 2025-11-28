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

    it("withdraws from lowest growth assets first with lowest_growth_first strategy", () => {
        const data = baseData({
            assets: [
                { id: "c", name: "Cash", value: 3000, category: AssetType.Cash },
                { id: "i", name: "ISA", value: 0, category: AssetType.ISA },
                { id: "p", name: "Pension", value: 5000, category: AssetType.Pension },
                { id: "pr", name: "Property", value: 2000, category: AssetType.Property }
            ],
            incomeNeeds: [{ id: "need", description: "Need", annualAmount: 4000, startingAge: 60 }],
            assumptions: {
                inflationRate: 0,
                // Use 0 growth rates to isolate drawdown behavior; different rates determine order
                categoryGrowthRates: { cash: 0, stocks: 0, pension: 0, property: 0 }
            }
        })
        // With equal 0% growth rates, order is determined by enum order in AssetType
        // AssetType order: pension, cash, stocks, isa, bonds, property
        // Should withdraw from first available in that order
        const result = calculateProjection(data, 1, "lowest_growth_first")
        const first = result.yearlyData[0]
        // Withdrawal of 4000: from pension (3000 avail but takes what needed), cash, property in order
        // With 0 growth, total assets = 10000, need 4000
        expect(first.assets).toBe(6000)
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
            incomeTax: { personalAllowance: 12570, higherRateThreshold: 50270 },
            assumptions: {
                inflationRate: 0,
                categoryGrowthRates: { cash: 1, stocks: 5, pension: 4, property: 3 }
            }
        })

        // Use lowest_growth_first to get predictable order: cash first, then pension
        const result = calculateProjection(data, 1, "lowest_growth_first")
        const first = result.yearlyData.find(y => y.age === 60)!
        // Growth applied first: Cash 5000*1.01=5050, Pension 50000*1.04=52000, total 57050
        const totalAssets = 5000 * 1.01 + 50000 * 1.04
        // Cash is not taxable (for now) so no tax paid on cash
        const expectedTax = (30000 - 5000 * 1.01 - 12570) * 0.2
        expect(Math.round(first.taxPayable)).toBe(expectedTax)
        // Assets after growth (57050) minus withdrawal (33486) = 23564
        expect(first.assets).toBe(totalAssets - 30000 - expectedTax)
        // Cash exhausted after growth (5050), remaining 28436 from pension
        expect(first.cash).toBe(0)
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

    it("separates assets by owner and combines them in output", () => {
        const thisYear = fixedNow.getFullYear()
        const data = baseData({
            personal: {
                dateOfBirth: `${thisYear - 60}-01-01`,
                spouseDateOfBirth: `${thisYear - 60}-01-01`,
                retirementAge: 70
            },
            assets: [
                { id: "c1", name: "My Cash", value: 5000, category: AssetType.Cash, belongsToSpouse: false },
                { id: "c2", name: "Spouse Cash", value: 3000, category: AssetType.Cash, belongsToSpouse: true },
                { id: "i1", name: "My ISA", value: 2000, category: AssetType.ISA, belongsToSpouse: false },
                { id: "i2", name: "Spouse ISA", value: 1000, category: AssetType.ISA, belongsToSpouse: true },
                { id: "p", name: "Pension", value: 0, category: AssetType.Pension },
                { id: "pr", name: "Property", value: 0, category: AssetType.Property }
            ],
            incomeNeeds: [{ id: "need", description: "Need", annualAmount: 0, startingAge: 70 }]
        })
        const result = calculateProjection(data)!
        const first = result.yearlyData.find(y => y.age === 60)!
        // Combined cash: 5000 + 3000 = 8000, Combined ISA: 2000 + 1000 = 3000
        expect(first.cash).toBe(8000)
        expect(first.isa).toBe(3000)
        expect(first.assets).toBe(11000)
    })

    it("applies one-off to spouse's cash when belongsToSpouse is true", () => {
        const thisYear = fixedNow.getFullYear()
        const data = baseData({
            personal: {
                dateOfBirth: `${thisYear - 60}-01-01`,
                spouseDateOfBirth: `${thisYear - 60}-01-01`,
                retirementAge: 70
            },
            assets: [
                { id: "c1", name: "My Cash", value: 5000, category: AssetType.Cash, belongsToSpouse: false },
                { id: "c2", name: "Spouse Cash", value: 3000, category: AssetType.Cash, belongsToSpouse: true },
                { id: "i", name: "ISA", value: 0, category: AssetType.ISA },
                { id: "p", name: "Pension", value: 0, category: AssetType.Pension },
                { id: "pr", name: "Property", value: 0, category: AssetType.Property }
            ],
            incomeNeeds: [{ id: "need", description: "Need", annualAmount: 0, startingAge: 70 }],
            oneOffs: [
                { id: "o1", description: "My bonus", amount: 1000, age: 61, enabled: true, belongsToSpouse: false },
                {
                    id: "o2",
                    description: "Spouse inheritance",
                    amount: 2000,
                    age: 61,
                    enabled: true,
                    belongsToSpouse: true
                }
            ]
        })
        const result = calculateProjection(data)!
        const at60 = result.yearlyData.find(y => y.age === 60)!
        const at61 = result.yearlyData.find(y => y.age === 61)!
        // Both one-offs happen at age 61, total cash increase should be 3000
        expect(at61.cash - at60.cash).toBe(3000)
        expect(at61.assets - at60.assets).toBe(3000)
    })

    it("attributes retirement income to correct spouse for tax calculation", () => {
        const thisYear = fixedNow.getFullYear()
        const data = baseData({
            personal: {
                dateOfBirth: `${thisYear - 60}-01-01`,
                spouseDateOfBirth: `${thisYear - 60}-01-01`,
                retirementAge: 60
            },
            assets: [
                { id: "c", name: "Cash", value: 50000, category: AssetType.Cash },
                { id: "i", name: "ISA", value: 0, category: AssetType.ISA },
                { id: "p", name: "Pension", value: 0, category: AssetType.Pension },
                { id: "pr", name: "Property", value: 0, category: AssetType.Property }
            ],
            incomeNeeds: [{ id: "need", description: "Need", annualAmount: 10000, startingAge: 60 }],
            retirementIncome: [
                {
                    id: "ri1",
                    description: "My Pension",
                    annualAmount: 5000,
                    startYear: thisYear,
                    enabled: true,
                    inflationAdjusted: false,
                    belongsToSpouse: false
                },
                {
                    id: "ri2",
                    description: "Spouse Pension",
                    annualAmount: 5000,
                    startYear: thisYear,
                    enabled: true,
                    inflationAdjusted: false,
                    belongsToSpouse: true
                }
            ]
        })
        const result = calculateProjection(data)!
        const first = result.yearlyData.find(y => y.age === 60)!
        // Total retirement income should be 10000 (5000 + 5000)
        expect(first.retirementIncome).toBe(10000)
        // Income covers expenditure, no tax should be due (both under personal allowance)
        expect(first.taxPayable).toBe(0)
    })
})
