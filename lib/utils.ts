import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { AssetType, Assumptions } from "@/types"
import { AssetPool } from "@/lib/types"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Helper to map an AssetType to a growth category key used in assumptions
export function getGrowthCategory(category: AssetType) {
    switch (category) {
        case AssetType.Pension:
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
            return true
        case AssetType.Cash:
            return false
        case AssetType.StocksAndShares:
            // TODO: CGT calculation
            return false
        case AssetType.ISA:
            return false
        case AssetType.Bonds:
            return false
        case AssetType.Property:
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
