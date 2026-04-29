import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { calculateProjection } from "@/lib/calculations"
import { AssetType, RetirementData, YearlyDatapoint } from "@/lib/types"
import { householdYearly } from "@/lib/yearlyView"

// Convenience: flatten a per-pool `YearlyDatapoint` into the household-level
// snapshot so tests can keep asserting on simple flat fields.
const hh = (yd: YearlyDatapoint) => householdYearly(yd)

function baseData(overrides: Partial<RetirementData> = {}): RetirementData {
    const current = new Date()
    const currentYear = current.getFullYear()

    const data: RetirementData = {
        personal: {
            dateOfBirth: `${currentYear - 55}-01-01`, // Age 55 - eligible for Bed and ISA
            spouseDateOfBirth: "",
            retirementAge: 65
        },
        assets: [
            { id: "c", name: "Cash", value: 0, category: AssetType.Cash },
            { id: "i", name: "ISA", value: 0, category: AssetType.ISA },
            { id: "p", name: "Pension", value: 0, category: AssetType.Pension },
            { id: "pr", name: "Property", value: 0, category: AssetType.Property }
        ],
        incomeNeeds: [{ id: "need", description: "Base need", annualAmount: 0, startingAge: 65 }],
        retirementIncome: [],
        assumptions: {
            inflationRate: 0,
            categoryGrowthRates: {
                cash: 0,
                stocks: 0,
                pension: 0,
                property: 0
            },
            bedAndISAEnabled: true
        },
        incomeTax: {
            personalAllowance: 12570,
            higherRateThreshold: 50270
        },
        shocks: [],
        oneOffs: []
    }

    return { ...data, ...overrides } as RetirementData
}

describe("Bed and ISA", () => {
    const fixedNow = new Date("2025-01-01T00:00:00Z")

    beforeAll(() => {
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
        vi.setSystemTime(fixedNow)
    })

    describe("Age eligibility", () => {
        it("does not crystallise pension when person is under 55", () => {
            const data = baseData({
                personal: {
                    dateOfBirth: "1975-01-01", // Age 50 in 2025
                    spouseDateOfBirth: "",
                    retirementAge: 65
                },
                assets: [
                    { id: "p", name: "Pension", value: 100000, category: AssetType.Pension },
                    { id: "i", name: "ISA", value: 0, category: AssetType.ISA }
                ]
            })

            const result = calculateProjection(data, 1)
            const firstYear = hh(result.yearlyData[0])

            // Pension should remain unchanged (shown as combined pension in chart)
            expect(firstYear.pension).toBe(100000)
            // ISA should remain at 0
            expect(firstYear.isa).toBe(0)
        })

        it("crystallises pension when person turns 55", () => {
            const data = baseData({
                personal: {
                    dateOfBirth: "1970-01-01", // Age 55 in 2025
                    spouseDateOfBirth: "",
                    retirementAge: 65
                },
                assets: [
                    { id: "p", name: "Pension", value: 100000, category: AssetType.Pension },
                    { id: "i", name: "ISA", value: 0, category: AssetType.ISA }
                ]
            })

            const result = calculateProjection(data, 1)
            const firstYear = hh(result.yearlyData[0])

            // Should crystallise £80,000: £20,000 to ISA, £60,000 to pensionCrystallised
            // Uncrystallised pension = 100000 - 80000 = 20000
            // Crystallised pension = 60000
            // Total pension (uncrystallised + crystallised) = 80000
            expect(firstYear.pension + firstYear.pensionCrystallised).toBe(80000)
            expect(firstYear.pension).toBe(20000)
            expect(firstYear.pensionCrystallised).toBe(60000)
            expect(firstYear.isa).toBe(20000)
        })
    })

    describe("Basic crystallisation", () => {
        it("crystallises up to £80,000 pension to get £20,000 ISA allowance", () => {
            const data = baseData({
                personal: {
                    dateOfBirth: "1970-01-01", // Age 55
                    spouseDateOfBirth: "",
                    retirementAge: 65
                },
                assets: [
                    { id: "p", name: "Pension", value: 200000, category: AssetType.Pension },
                    { id: "i", name: "ISA", value: 10000, category: AssetType.ISA }
                ]
            })

            const result = calculateProjection(data, 1)
            const firstYear = hh(result.yearlyData[0])

            // £80,000 crystallised: £20,000 (25%) to ISA, £60,000 (75%) to pensionCrystallised
            // Remaining uncrystallised pension: 200000 - 80000 = 120000
            // Crystallised pension: 60000
            // Total pension shown: 120000 + 60000 = 180000
            expect(firstYear.pension + firstYear.pensionCrystallised).toBe(180000)
            expect(firstYear.pension).toBe(120000)
            expect(firstYear.pensionCrystallised).toBe(60000)
            // ISA: original 10000 + 20000 = 30000
            expect(firstYear.isa).toBe(30000)
        })

        it("crystallises partial amount when pension is less than £80,000", () => {
            const data = baseData({
                personal: {
                    dateOfBirth: "1970-01-01", // Age 55
                    spouseDateOfBirth: "",
                    retirementAge: 65
                },
                assets: [
                    { id: "p", name: "Pension", value: 40000, category: AssetType.Pension },
                    { id: "i", name: "ISA", value: 0, category: AssetType.ISA }
                ]
            })

            const result = calculateProjection(data, 1)
            const firstYear = hh(result.yearlyData[0])

            // All £40,000 crystallised: £10,000 (25%) to ISA, £30,000 (75%) to pensionCrystallised
            // Uncrystallised pension: 0
            // Crystallised pension: 30000
            // Total pension shown: 0 + 30000 = 30000
            expect(firstYear.pension + firstYear.pensionCrystallised).toBe(30000)
            expect(firstYear.pension).toBe(0)
            expect(firstYear.pensionCrystallised).toBe(30000)
            expect(firstYear.isa).toBe(10000)
        })

        it("does nothing when there is no pension", () => {
            const data = baseData({
                personal: {
                    dateOfBirth: "1970-01-01", // Age 55
                    spouseDateOfBirth: "",
                    retirementAge: 65
                },
                assets: [
                    { id: "p", name: "Pension", value: 0, category: AssetType.Pension },
                    { id: "i", name: "ISA", value: 5000, category: AssetType.ISA }
                ]
            })

            const result = calculateProjection(data, 1)
            const firstYear = hh(result.yearlyData[0])

            expect(firstYear.pension).toBe(0)
            expect(firstYear.isa).toBe(5000)
        })
    })

    describe("Spouse scenarios", () => {
        it("crystallises pension for both primary and spouse when both are 55+", () => {
            const data = baseData({
                personal: {
                    dateOfBirth: "1970-01-01", // Age 55
                    spouseDateOfBirth: "1968-01-01", // Age 57
                    retirementAge: 65
                },
                assets: [
                    { id: "p1", name: "Pension", value: 100000, category: AssetType.Pension },
                    {
                        id: "p2",
                        name: "Spouse Pension",
                        value: 100000,
                        category: AssetType.Pension,
                        belongsToSpouse: true
                    },
                    { id: "i1", name: "ISA", value: 0, category: AssetType.ISA },
                    { id: "i2", name: "Spouse ISA", value: 0, category: AssetType.ISA, belongsToSpouse: true }
                ]
            })

            const result = calculateProjection(data, 1)
            const firstYear = hh(result.yearlyData[0])

            // Both crystallise £80,000 each
            // Primary: 100000 - 80000 = 20000 uncrystallised, 60000 crystallised
            // Spouse: 100000 - 80000 = 20000 uncrystallised, 60000 crystallised
            // Total uncrystallised: 40000, Total crystallised: 120000
            expect(firstYear.pension + firstYear.pensionCrystallised).toBe(160000)
            expect(firstYear.pension).toBe(40000)
            expect(firstYear.pensionCrystallised).toBe(120000)
            // ISA: £20,000 each = £40,000 total
            expect(firstYear.isa).toBe(40000)
        })

        it("only crystallises for eligible spouse when primary is under 55", () => {
            const data = baseData({
                personal: {
                    dateOfBirth: "1975-01-01", // Age 50 - not eligible
                    spouseDateOfBirth: "1968-01-01", // Age 57 - eligible
                    retirementAge: 65
                },
                assets: [
                    { id: "p1", name: "Pension", value: 100000, category: AssetType.Pension },
                    {
                        id: "p2",
                        name: "Spouse Pension",
                        value: 100000,
                        category: AssetType.Pension,
                        belongsToSpouse: true
                    },
                    { id: "i1", name: "ISA", value: 0, category: AssetType.ISA },
                    { id: "i2", name: "Spouse ISA", value: 0, category: AssetType.ISA, belongsToSpouse: true }
                ]
            })

            const result = calculateProjection(data, 1)
            const firstYear = hh(result.yearlyData[0])

            // Only spouse crystallises £80,000
            // Primary pension unchanged: 100000 uncrystallised
            // Spouse: 100000 - 80000 = 20000 uncrystallised, 60000 crystallised
            // Total uncrystallised: 120000, Total crystallised: 60000
            expect(firstYear.pension + firstYear.pensionCrystallised).toBe(180000)
            expect(firstYear.pension).toBe(120000)
            expect(firstYear.pensionCrystallised).toBe(60000)
            // Only spouse ISA gets £20,000
            expect(firstYear.isa).toBe(20000)
        })
    })

    describe("Cross-pool borrowing", () => {
        it("takes from other pool when own pension is insufficient", () => {
            const data = baseData({
                personal: {
                    dateOfBirth: "1970-01-01", // Age 55
                    spouseDateOfBirth: "1968-01-01", // Age 57
                    retirementAge: 65
                },
                assets: [
                    { id: "p1", name: "Pension", value: 40000, category: AssetType.Pension },
                    {
                        id: "p2",
                        name: "Spouse Pension",
                        value: 200000,
                        category: AssetType.Pension,
                        belongsToSpouse: true
                    },
                    { id: "i1", name: "ISA", value: 0, category: AssetType.ISA },
                    { id: "i2", name: "Spouse ISA", value: 0, category: AssetType.ISA, belongsToSpouse: true }
                ]
            })

            const result = calculateProjection(data, 1)
            const firstYear = hh(result.yearlyData[0])

            // Primary has £40,000, needs £80,000, so takes £40,000 from spouse's pension
            // Primary: crystallises own £40,000 + £40,000 from spouse = £80,000
            //   -> £20,000 to primary ISA, £60,000 to primary pensionCrystallised
            // Spouse: has 200000 - 40000 (given to primary) = 160000
            //   -> crystallises £80,000: £20,000 to spouse ISA, £60,000 to spouse pensionCrystallised
            //   -> remaining uncrystallised: 160000 - 80000 = 80000
            // Total uncrystallised: 0 + 80000 = 80000
            // Total crystallised: 60000 + 60000 = 120000
            // Total pension: 200000
            expect(firstYear.pension + firstYear.pensionCrystallised).toBe(200000)
            expect(firstYear.pension).toBe(80000)
            expect(firstYear.pensionCrystallised).toBe(120000)
            // Total ISA: £20,000 + £20,000 = £40,000
            expect(firstYear.isa).toBe(40000)
        })

        it("takes from primary pool when spouse is eligible but has no pension", () => {
            const data = baseData({
                personal: {
                    dateOfBirth: "1970-01-01", // Age 55
                    spouseDateOfBirth: "1968-01-01", // Age 57
                    retirementAge: 65
                },
                assets: [
                    { id: "p1", name: "Pension", value: 200000, category: AssetType.Pension },
                    { id: "p2", name: "Spouse Pension", value: 0, category: AssetType.Pension, belongsToSpouse: true },
                    { id: "i1", name: "ISA", value: 0, category: AssetType.ISA },
                    { id: "i2", name: "Spouse ISA", value: 0, category: AssetType.ISA, belongsToSpouse: true }
                ]
            })

            const result = calculateProjection(data, 1)
            const firstYear = hh(result.yearlyData[0])

            // Primary crystallises £80,000 from own pension
            // Spouse has £0, takes £80,000 from primary's remaining pension (200000 - 80000 = 120000)
            // Primary remaining: 120000 - 80000 = 40000 uncrystallised + 60000 crystallised
            // Spouse: 0 uncrystallised + 60000 crystallised
            // Total uncrystallised: 40000, Total crystallised: 120000
            expect(firstYear.pension + firstYear.pensionCrystallised).toBe(160000)
            expect(firstYear.pension).toBe(40000)
            expect(firstYear.pensionCrystallised).toBe(120000)
            // Total ISA: £20,000 + £20,000 = £40,000
            expect(firstYear.isa).toBe(40000)
        })

        it("handles case where total pension across pools is less than needed for one allowance", () => {
            const data = baseData({
                personal: {
                    dateOfBirth: "1970-01-01", // Age 55
                    spouseDateOfBirth: "1968-01-01", // Age 57
                    retirementAge: 65
                },
                assets: [
                    { id: "p1", name: "Pension", value: 30000, category: AssetType.Pension },
                    {
                        id: "p2",
                        name: "Spouse Pension",
                        value: 30000,
                        category: AssetType.Pension,
                        belongsToSpouse: true
                    },
                    { id: "i1", name: "ISA", value: 0, category: AssetType.ISA },
                    { id: "i2", name: "Spouse ISA", value: 0, category: AssetType.ISA, belongsToSpouse: true }
                ]
            })

            const result = calculateProjection(data, 1)
            const firstYear = hh(result.yearlyData[0])

            // Primary: has £30,000, takes £30,000 from spouse = £60,000 crystallised
            //   -> £15,000 to ISA, £45,000 to pensionCrystallised
            // Spouse: has £0 remaining (all taken by primary), nothing to crystallise
            // Total uncrystallised: 0, Total crystallised: 45000
            expect(firstYear.pension + firstYear.pensionCrystallised).toBe(45000)
            expect(firstYear.pension).toBe(0)
            expect(firstYear.pensionCrystallised).toBe(45000)
            // Total ISA: £15,000 (primary only)
            expect(firstYear.isa).toBe(15000)
        })
    })

    describe("Multiple years of crystallisation", () => {
        it("crystallises each year up to the annual allowance", () => {
            const data = baseData({
                personal: {
                    dateOfBirth: "1970-01-01", // Age 55
                    spouseDateOfBirth: "",
                    retirementAge: 65
                },
                assets: [
                    { id: "p", name: "Pension", value: 200000, category: AssetType.Pension },
                    { id: "i", name: "ISA", value: 0, category: AssetType.ISA }
                ]
            })

            const result = calculateProjection(data, 3)
            const y0 = hh(result.yearlyData[0])
            const y1 = hh(result.yearlyData[1])
            const y2 = hh(result.yearlyData[2])

            // Year 1 (age 55): crystallise £80,000
            // Uncrystallised: 200000 - 80000 = 120000, Crystallised: 60000
            expect(y0.pension + y0.pensionCrystallised).toBe(180000)
            expect(y0.pension).toBe(120000)
            expect(y0.pensionCrystallised).toBe(60000)
            expect(y0.isa).toBe(20000)

            // Year 2 (age 56): crystallise another £80,000
            // Uncrystallised: 120000 - 80000 = 40000, Crystallised: 60000 + 60000 = 120000
            expect(y1.pension + y1.pensionCrystallised).toBe(160000)
            expect(y1.pension).toBe(40000)
            expect(y1.pensionCrystallised).toBe(120000)
            expect(y1.isa).toBe(40000)

            // Year 3 (age 57): only £40,000 uncrystallised pension remains
            // Uncrystallised: 0, Crystallised: 120000 + 30000 = 150000
            expect(y2.pension + y2.pensionCrystallised).toBe(150000)
            expect(y2.pension).toBe(0)
            expect(y2.pensionCrystallised).toBe(150000)
            expect(y2.isa).toBe(50000)
        })

        it("stops crystallising when all pension is crystallised", () => {
            const data = baseData({
                personal: {
                    dateOfBirth: "1970-01-01", // Age 55
                    spouseDateOfBirth: "",
                    retirementAge: 65
                },
                assets: [
                    { id: "p", name: "Pension", value: 80000, category: AssetType.Pension },
                    { id: "i", name: "ISA", value: 0, category: AssetType.ISA }
                ]
            })

            const result = calculateProjection(data, 3)
            const y0 = hh(result.yearlyData[0])
            const y1 = hh(result.yearlyData[1])
            const y2 = hh(result.yearlyData[2])

            // Year 1: crystallise all £80,000
            // Uncrystallised: 0, Crystallised: 60000
            expect(y0.pension + y0.pensionCrystallised).toBe(60000)
            expect(y0.pension).toBe(0)
            expect(y0.pensionCrystallised).toBe(60000)
            expect(y0.isa).toBe(20000)

            // Year 2: no uncrystallised pension left, nothing happens
            expect(y1.pension + y1.pensionCrystallised).toBe(60000)
            expect(y1.pension).toBe(0)
            expect(y1.pensionCrystallised).toBe(60000)
            expect(y1.isa).toBe(20000)

            // Year 3: still nothing to crystallise
            expect(y2.pension + y2.pensionCrystallised).toBe(60000)
            expect(y2.pension).toBe(0)
            expect(y2.pensionCrystallised).toBe(60000)
            expect(y2.isa).toBe(20000)
        })
    })

    describe("Total assets preservation", () => {
        it("preserves total assets during crystallisation (no value lost)", () => {
            const data = baseData({
                personal: {
                    dateOfBirth: "1970-01-01", // Age 55
                    spouseDateOfBirth: "",
                    retirementAge: 65
                },
                assets: [
                    { id: "p", name: "Pension", value: 100000, category: AssetType.Pension },
                    { id: "i", name: "ISA", value: 50000, category: AssetType.ISA },
                    { id: "c", name: "Cash", value: 25000, category: AssetType.Cash }
                ]
            })

            const result = calculateProjection(data, 1)
            const firstYear = hh(result.yearlyData[0])

            // Total assets should remain 175000
            // Uncrystallised pension: 100000 - 80000 = 20000
            // Crystallised pension: 60000
            // Total pension: 80000
            // ISA: 50000 + 20000 = 70000
            // Cash: 25000
            expect(firstYear.assets).toBe(175000)
            expect(firstYear.pension + firstYear.pensionCrystallised).toBe(80000)
            expect(firstYear.pension).toBe(20000)
            expect(firstYear.pensionCrystallised).toBe(60000)
            expect(firstYear.isa).toBe(70000)
            expect(firstYear.cash).toBe(25000)
        })
    })
})
