import { TaxPosition, TaxSettings, Assumptions } from "@/lib/types"

// Default CGT settings
const DEFAULT_CGT_ALLOWANCE = 3000
const DEFAULT_CGT_RATE = 18

export interface CGTWithdrawal {
    withdrawal: number
    baseCostRatio: number // baseCost / currentValue ratio (0-1), used to calculate gain
}

export interface CGTResult {
    totalGain: number
    taxableGain: number
    cgtPayable: number
}

/**
 * Calculate Capital Gains Tax for withdrawals from CGT liable assets.
 * 
 * @param withdrawals - Array of withdrawals with their base cost ratios
 * @param assumptions - Assumptions containing CGT allowance and rate
 * @param inflationMultiplier - Multiplier for inflation adjustment of allowance
 * @returns CGT calculation result
 */
export function calculateCGT(
    withdrawals: CGTWithdrawal[],
    assumptions: Assumptions,
    inflationMultiplier: number = 1
): CGTResult {
    const allowance = (assumptions.cgtAllowance ?? DEFAULT_CGT_ALLOWANCE) * inflationMultiplier
    const rate = (assumptions.cgtRate ?? DEFAULT_CGT_RATE) / 100

    // Calculate total gain from all withdrawals
    // Gain = withdrawal * (1 - baseCostRatio)
    // If baseCostRatio is 0.8, then 80% is cost basis and 20% is gain
    const totalGain = withdrawals.reduce((sum, w) => {
        const gainRatio = 1 - w.baseCostRatio
        return sum + w.withdrawal * gainRatio
    }, 0)

    // Apply allowance
    const taxableGain = Math.max(0, totalGain - allowance)
    
    // Calculate CGT
    const cgtPayable = taxableGain * rate

    return {
        totalGain,
        taxableGain,
        cgtPayable
    }
}

export function initialTaxPosition(taxSettings: TaxSettings, inflationMultiplier = 1): TaxPosition {
    return {
        personalAllowanceRemaining: taxSettings.personalAllowance * inflationMultiplier,
        basicRateRemaining:
            taxSettings.higherRateThreshold * inflationMultiplier - taxSettings.personalAllowance * inflationMultiplier,
        tax: 0
    }
}

export function updateTaxPosition(taxableIncome: number, taxPosition: TaxPosition): TaxPosition {
    if (taxableIncome < taxPosition.personalAllowanceRemaining) {
        return {
            ...taxPosition,
            personalAllowanceRemaining: taxPosition.personalAllowanceRemaining - taxableIncome
        }
    }
    const basicRatedRemainder = taxableIncome - taxPosition.personalAllowanceRemaining
    if (basicRatedRemainder < taxPosition.basicRateRemaining) {
        return {
            ...taxPosition,
            personalAllowanceRemaining: 0,
            basicRateRemaining: taxPosition.basicRateRemaining - basicRatedRemainder,
            tax: taxPosition.tax + basicRatedRemainder * 0.2
        }
    }

    const higherRatedRemainder = basicRatedRemainder - taxPosition.basicRateRemaining
    return {
        personalAllowanceRemaining: 0,
        basicRateRemaining: 0,
        tax: taxPosition.tax + taxPosition.basicRateRemaining * 0.2 + higherRatedRemainder * 0.4
    }
}
