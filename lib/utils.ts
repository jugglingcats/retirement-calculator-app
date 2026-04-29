import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import {
    Asset,
    AssetPool,
    AssetPoolType,
    AssetType,
    Assumptions,
    DrawdownStrategyType,
    IncomeNeed,
    RetirementIncome,
    TaxSettings
} from "@/lib/types"
import { BaseDrawdownStrategy } from "@/lib/strategies/base"
import { BalancedStrategy } from "@/lib/strategies/strategyBalanced"
import { LowestGrowthFirstStrategy } from "@/lib/strategies/strategyLowestGrowthFirst"
import { TaxOptimizedStrategy } from "@/lib/strategies/strategyTaxOptimized"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Helper to map an AssetType to a growth category key used in assumptions
export function getGrowthCategory(category: AssetType) {
    switch (category) {
        case AssetType.Pension:
        case AssetType.PensionCrystallised:
            return "pension"
        case AssetType.Cash:
            return "cash"
        case AssetType.StocksAndShares:
        case AssetType.ISA:
            return "stocks"
        case AssetType.Bonds:
            return "bonds"
        case AssetType.Property:
            return "property"
        default:
            return "other"
    }
}

export function isTaxable(category: AssetType): boolean {
    switch (category) {
        case AssetType.Pension:
        case AssetType.PensionCrystallised:
            return true
        case AssetType.Cash:
            return false
        case AssetType.StocksAndShares:
            return false
        case AssetType.ISA:
            return false
        case AssetType.Bonds:
            return false
        case AssetType.Property:
            return false
    }
}

export function isCGTLiable(category: AssetType): boolean {
    switch (category) {
        case AssetType.StocksAndShares:
        case AssetType.Bonds:
            return true
        default:
            return false
    }
}

export function growthRateFor(categoryGrowthRates: Assumptions["categoryGrowthRates"], type: AssetType): number {
    const key = getGrowthCategory(type)
    const pct = categoryGrowthRates[key] || 0
    return pct / 100
}

export const assetTypes = Object.values(AssetType)

export function sumAssets(assets: AssetPool): number {
    return assetTypes.reduce((sum, type) => sum + assets[type], 0)
}

export function sumNumbers(numbers: number[]) {
    return numbers.reduce((sum, n) => sum + n, 0)
}
export function getNetExpenditure(incomeNeeds: IncomeNeed[], retirementAge: number, age: number) {
    const sortedNeeds = incomeNeeds
        .map(need => ({
            ...need,
            effectiveStartingAge: need.startingAge ?? retirementAge
        }))
        .sort((a, b) => b.effectiveStartingAge - a.effectiveStartingAge)

    return sortedNeeds.find(need => age >= need.effectiveStartingAge)
}
export function createEmptyAssetPool(): AssetPool {
    return Object.fromEntries(Object.values(AssetType).map(t => [t, 0])) as AssetPool
}

export function buildAssetPools(assets: Asset[]): [AssetPool, AssetPool] {
    const primary = createEmptyAssetPool()
    const spouse = createEmptyAssetPool()

    for (const asset of assets) {
        if (asset.belongsToSpouse) {
            spouse[asset.category] += asset.value
        } else {
            primary[asset.category] += asset.value
        }
    }

    return [primary, spouse]
}
/**
 * Build base cost pools for CGT-liable assets.
 * For assets without a baseCost specified, assume baseCost equals current value (no gain).
 */
export function buildBaseCgtCostPools(assets: Asset[]): [AssetPool, AssetPool] {
    const primary = createEmptyAssetPool()
    const spouse = createEmptyAssetPool()

    for (const asset of assets) {
        if (isCGTLiable(asset.category)) {
            // If baseCost is not specified, assume it equals current value (no gain)
            const baseCost = asset.baseCost ?? asset.value
            if (asset.belongsToSpouse) {
                spouse[asset.category] += baseCost
            } else {
                primary[asset.category] += baseCost
            }
        }
    }

    return [primary, spouse]
}

const UK_STATE_PENSION_2024 = 11502
const STATE_PENSION_AGE = 67

export function buildStatePensions(age: number, spouseAge: number, inflationMultiplier: number): number[] {
    // Calculate state pension per person
    return [
        age >= STATE_PENSION_AGE ? UK_STATE_PENSION_2024 : 0,
        spouseAge >= STATE_PENSION_AGE ? UK_STATE_PENSION_2024 : 0
    ].map(v => v * inflationMultiplier)
}

export function buildOtherIncome(
    incomeSources: RetirementIncome[],
    year: number,
    inflationMultiplier: number
): number[] {
    if (!incomeSources) {
        return [0, 0]
    }
    return incomeSources.reduce(
        (acc, income) => {
            if (income.enabled && year >= income.startYear && (!income.endYear || year <= income.endYear)) {
                const growthRate = income.growthRate || 0
                const inflation_multiplier = income.inflationAdjusted ? inflationMultiplier : 1
                const growth_multiplier = Math.pow(1 + growthRate / 100, year - income.startYear)
                const amount = income.annualAmount * inflation_multiplier * growth_multiplier

                if (income.belongsToSpouse) {
                    acc[AssetPoolType.SPOUSE] += amount
                } else {
                    acc[AssetPoolType.PRIMARY] += amount
                }
            }
            return acc
        },
        [0, 0]
    )
}
/**
 * Factory function to create the appropriate strategy instance.
 */
export function createDrawdownStrategy(
    strategyType: DrawdownStrategyType,
    taxSettings: TaxSettings,
    growthRates: AssetPool
): BaseDrawdownStrategy {
    switch (strategyType) {
        case "balanced":
            return new BalancedStrategy(taxSettings, growthRates)
        case "lowest_growth_first":
            return new LowestGrowthFirstStrategy(taxSettings, growthRates)
        case "tax_optimized":
            return new TaxOptimizedStrategy(taxSettings, growthRates)
        default:
            throw new Error(`Unknown strategy type: ${strategyType}`)
    }
}
