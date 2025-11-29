import { AssetPool, AssetType } from "@/lib/types"

const BED_AND_ISA_MIN_AGE = 55
const ANNUAL_ISA_ALLOWANCE = 20000
const TAX_FREE_LUMP_SUM_PERCENTAGE = 0.25

/**
 * Bed and ISA process: Crystallise pension to take 25% tax-free into ISA.
 * - Each person aged 55+ can transfer up to £20,000 per year into their ISA
 * - To get £20,000 tax-free (25%), need to crystallise £80,000 from pension
 * - The remaining 75% (£60,000) goes to pensionCrystallised
 * - If one pool lacks sufficient pension, take from the other pool
 */
export function applyBedAndISA(assetPools: [AssetPool, AssetPool], ages: number[]): void {
    const [primaryAge, spouseAge] = ages

    // Determine eligibility for each person
    const primaryEligible = primaryAge >= BED_AND_ISA_MIN_AGE
    const spouseEligible = !isNaN(spouseAge) && spouseAge >= BED_AND_ISA_MIN_AGE

    // Calculate how much pension needs to be crystallised to achieve the ISA allowance
    // ISA amount = 25% of crystallised amount, so crystallised = ISA / 0.25 = ISA * 4
    const crystallisationMultiplier = 1 / TAX_FREE_LUMP_SUM_PERCENTAGE // 4

    // Process each eligible person
    const eligibility = [primaryEligible, spouseEligible]

    for (let i = 0; i < 2; i++) {
        if (!eligibility[i]) {
            continue
        }

        const targetCrystallisation = ANNUAL_ISA_ALLOWANCE * crystallisationMultiplier

        // First, try to take from own pool
        const ownPool = assetPools[i]
        const otherPool = assetPools[1 - i]

        let availableFromOwn = ownPool[AssetType.Pension]
        let availableFromOther = otherPool[AssetType.Pension]

        let crystallisedFromOwn = Math.min(availableFromOwn, targetCrystallisation)
        let remainingToFill = targetCrystallisation - crystallisedFromOwn

        // If own pool doesn't have enough, take from the other pool
        let crystallisedFromOther = 0
        if (remainingToFill > 0 && availableFromOther > 0) {
            crystallisedFromOther = Math.min(availableFromOther, remainingToFill)
        }

        const totalCrystallised = crystallisedFromOwn + crystallisedFromOther

        if (totalCrystallised === 0) continue

        // Calculate tax-free lump sum (25%) and crystallised pension (75%)
        const taxFreeLumpSum = totalCrystallised * TAX_FREE_LUMP_SUM_PERCENTAGE
        const toCrystallisedPension = totalCrystallised * (1 - TAX_FREE_LUMP_SUM_PERCENTAGE)

        // Update own pool
        ownPool[AssetType.Pension] -= crystallisedFromOwn
        ownPool[AssetType.ISA] += taxFreeLumpSum
        ownPool[AssetType.PensionCrystallised] += toCrystallisedPension

        // Update other pool if we took from it
        if (crystallisedFromOther > 0) {
            otherPool[AssetType.Pension] -= crystallisedFromOther
        }
    }
}
