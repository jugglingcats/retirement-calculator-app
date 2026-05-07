import { AssetPool, AssetType, Assumptions } from "@/lib/types"

const BED_AND_ISA_MIN_AGE = 55
export const DEFAULT_ANNUAL_ISA_ALLOWANCE = 20000
const DEFAULT_CGT_ALLOWANCE = 3000
const TAX_FREE_LUMP_SUM_PERCENTAGE = 0.25

/**
 * Bed and ISA via taxable stock holdings: convert stocks into ISA up to the
 * annual ISA allowance for each person, while ensuring no person triggers more
 * gains than the CGT annual allowance.
 *
 * Strategy per person `i`:
 *   1. Use `i`'s own stocks first (gain accrues to `i`).
 *   2. If `i` still has ISA allowance left and own stocks/CGT allowance are
 *      exhausted, accept a CGT-free inter-spousal gift of stocks from the
 *      partner. The recipient then disposes (transfer to ISA) using the
 *      recipient's CGT allowance — gain is computed against the partner's
 *      original cost basis.
 *
 * Returns the remaining ISA allowance per person, so any leftover can be
 * consumed by `applyBedAndISAToPensions` (pension crystallisation 25% TFLS).
 */
export function applyBedAndISAToStocks(
    assetPools: [AssetPool, AssetPool],
    baseCostPools: [AssetPool, AssetPool],
    assumptions: Assumptions,
    hasSpouse: boolean
): [number, number] {
    const isaAllowance = assumptions.annualISAAllowance ?? DEFAULT_ANNUAL_ISA_ALLOWANCE
    const cgtAllowance = assumptions.cgtAllowance ?? DEFAULT_CGT_ALLOWANCE

    const remainingISA: [number, number] = [isaAllowance, hasSpouse ? isaAllowance : 0]
    const remainingCGT: [number, number] = [cgtAllowance, cgtAllowance]

    const transferStocks = (sourceIdx: number, recipientIdx: number) => {
        if (remainingISA[recipientIdx] <= 0) return

        const sourcePool = assetPools[sourceIdx]
        const sourceBaseCostPool = baseCostPools[sourceIdx]
        const stocksAvail = sourcePool[AssetType.StocksAndShares]
        if (stocksAvail <= 0) return

        const baseCost = sourceBaseCostPool[AssetType.StocksAndShares]
        const gainRatio = Math.max(0, 1 - baseCost / stocksAvail)

        // Cap by recipient's remaining CGT allowance (gain accrues to recipient)
        const maxByCGT = gainRatio > 0 ? remainingCGT[recipientIdx] / gainRatio : Infinity
        const transfer = Math.min(stocksAvail, remainingISA[recipientIdx], maxByCGT)

        if (transfer <= 0) return

        const baseCostMoved = baseCost * (transfer / stocksAvail)
        const gain = transfer - baseCostMoved

        sourcePool[AssetType.StocksAndShares] -= transfer
        sourceBaseCostPool[AssetType.StocksAndShares] -= baseCostMoved
        assetPools[recipientIdx][AssetType.ISA] += transfer

        remainingISA[recipientIdx] -= transfer
        remainingCGT[recipientIdx] -= gain
    }

    // Pass 1: each person uses their own stocks first.
    for (let i = 0; i < 2; i++) {
        if (i === 1 && !hasSpouse) continue
        transferStocks(i, i)
    }

    // Pass 2: if a person still has ISA allowance left, accept a gift from the
    // partner's stocks (CGT-free between spouses; recipient realises the gain
    // on disposal into ISA).
    if (hasSpouse) {
        for (let i = 0; i < 2; i++) {
            if (remainingISA[i] <= 0) continue
            transferStocks(1 - i, i)
        }
    }

    return remainingISA
}

/**
 * Bed and ISA via pension crystallisation: take 25% tax-free from a
 * crystallised pension into ISA, putting the remaining 75% into the
 * crystallised pension pool. Limited per-person by remaining ISA allowance
 * and by the minimum age (55) for pension access.
 *
 * - Each eligible person aged 55+ uses their `remainingISAAllowance[i]`
 *   to receive a tax-free lump sum into ISA.
 * - To get £X tax-free (25%), crystallise £X * 4 from pension.
 * - The remaining 75% goes to pensionCrystallised.
 * - If one pool lacks sufficient pension, take from the other pool.
 */
export function applyBedAndISAToPensions(
    assetPools: [AssetPool, AssetPool],
    ages: number[],
    remainingISAAllowance: [number, number]
): void {
    const [primaryAge, spouseAge] = ages

    const primaryEligible = primaryAge >= BED_AND_ISA_MIN_AGE
    const spouseEligible = !isNaN(spouseAge) && spouseAge >= BED_AND_ISA_MIN_AGE
    const eligibility = [primaryEligible, spouseEligible]

    const crystallisationMultiplier = 1 / TAX_FREE_LUMP_SUM_PERCENTAGE // 4

    /**
     * Crystallise from `pensionOwnerIdx`'s pension to fill `isaOwnerIdx`'s
     * remaining ISA allowance. The 25% tax-free lump sum lands in the ISA
     * owner's ISA; the 75% remainder stays in the pension owner's
     * crystallised pension pool (no inter-person leakage of pension assets).
     */
    const crystalliseFor = (pensionOwnerIdx: number, isaOwnerIdx: number) => {
        if (!eligibility[isaOwnerIdx]) {
            return
        }
        if (remainingISAAllowance[isaOwnerIdx] <= 0) {
            return
        }

        const pensionPool = assetPools[pensionOwnerIdx]
        const available = pensionPool[AssetType.Pension]
        if (available <= 0) return

        const targetCrystallisation = remainingISAAllowance[isaOwnerIdx] * crystallisationMultiplier
        const crystallised = Math.min(available, targetCrystallisation)

        const taxFreeLumpSum = crystallised * TAX_FREE_LUMP_SUM_PERCENTAGE
        const toCrystallisedPension = crystallised - taxFreeLumpSum

        pensionPool[AssetType.Pension] -= crystallised
        pensionPool[AssetType.PensionCrystallised] += toCrystallisedPension
        assetPools[isaOwnerIdx][AssetType.ISA] += taxFreeLumpSum
        remainingISAAllowance[isaOwnerIdx] -= taxFreeLumpSum
    }

    // Each person's pension fills their own ISA first, then their partner's.
    for (let pensionOwnerIdx = 0; pensionOwnerIdx < 2; pensionOwnerIdx++) {
        crystalliseFor(pensionOwnerIdx, pensionOwnerIdx)
        crystalliseFor(pensionOwnerIdx, 1 - pensionOwnerIdx)
    }
}
