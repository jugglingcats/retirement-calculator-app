import { TaxPosition, TaxSettings } from "@/lib/types"

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
