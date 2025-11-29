import { describe, it, expect } from "vitest"
import { applyGrowth } from "@/lib/annual/growth"
import { AssetPool, AssetType, Assumptions } from "@/lib/types"

function makePool(values: Partial<Record<AssetType, number>>): AssetPool {
    const base: Record<AssetType, number> = {
        [AssetType.Cash]: 0,
        [AssetType.StocksAndShares]: 0,
        [AssetType.ISA]: 0,
        [AssetType.Bonds]: 0,
        [AssetType.Property]: 0,
        [AssetType.Pension]: 0,
        [AssetType.PensionCrystallised]: 0
    }
    return { ...base, ...(values as any) }
}

describe("applyGrowth with ISA investment lifestyling glide path", () => {
    const assumptions: Assumptions = {
        inflationRate: 0,
        categoryGrowthRates: {
            cash: 1, // 1%
            stocks: 10, // 10%
            bonds: 2, // 2%
            property: 3, // 3%
            pension: 0,
            other: 0
        },
        investmentBalance: {
            initialEquityPercentage: 80,
            targetEquityPercentage: 20,
            yearsToTarget: 10
        }
    }

    it("uses initial equity percentage at retirement year", () => {
        const pool = makePool({
            [AssetType.Cash]: 1000,
            [AssetType.StocksAndShares]: 1000,
            [AssetType.ISA]: 1000,
            [AssetType.Bonds]: 1000,
            [AssetType.Property]: 1000
        })

        applyGrowth([pool], assumptions, /*age*/ 65, /*retirementAge*/ 65)

        // ISA blended rate: 80% stocks (10%) + 20% bonds (2%) = 8.4%
        expect(Math.round(pool[AssetType.ISA])).toBe(1084)
        // Other categories use their own rates
        expect(Math.round(pool[AssetType.StocksAndShares])).toBe(1100)
        expect(Math.round(pool[AssetType.Bonds])).toBe(1020)
        expect(Math.round(pool[AssetType.Cash])).toBe(1010)
        expect(Math.round(pool[AssetType.Property])).toBe(1030)
    })

    it("interpolates towards target equity over years to target", () => {
        const pool = makePool({ [AssetType.ISA]: 1000 })
        // 5 years after retirement with 10-year glide: 50% equity
        applyGrowth([pool], assumptions, /*age*/ 70, /*retirementAge*/ 65)
        // ISA blended: 50%*10% + 50%*2% = 6%
        expect(Math.round(pool[AssetType.ISA])).toBe(1060)
    })

    it("uses target equity percentage after glide completes", () => {
        const pool = makePool({ [AssetType.ISA]: 1000 })
        // 15 years after retirement with 10-year glide: target (20% equity)
        applyGrowth([pool], assumptions, /*age*/ 80, /*retirementAge*/ 65)
        // ISA blended: 20%*10% + 80%*2% = 3.6%
        expect(Math.round(pool[AssetType.ISA])).toBe(1036)
    })
})
