import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { AssetType, Assumptions } from "@/types"

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
/**
 * Calculates income tax based on UK tax bands.
 */
export function calculateIncomeTax(
    taxableIncome: number,
    personalAllowance: number,
    higherRateThreshold: number
): number {
    if (taxableIncome <= personalAllowance) {
        return 0
    }

    const taxableAboveAllowance = taxableIncome - personalAllowance
    const basicRateBand = higherRateThreshold - personalAllowance

    if (taxableAboveAllowance <= basicRateBand) {
        return taxableAboveAllowance * 0.2
    }

    const basicRateTax = basicRateBand * 0.2
    const higherRateTax = (taxableAboveAllowance - basicRateBand) * 0.4

    return basicRateTax + higherRateTax
}
