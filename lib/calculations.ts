import {
    assetTypes,
    buildAssetPools,
    buildBaseCgtCostPools,
    buildOtherIncome,
    buildStatePensions,
    createDrawdownStrategy,
    createEmptyAssetPool,
    getNetExpenditure,
    growthRateFor,
    isCGTLiable,
    isTaxable,
    sumNumbers
} from "@/lib/utils"
import {
    AssetPool,
    AssetType,
    DrawdownStrategy,
    PoolYear,
    ProjectionResult,
    RetirementData,
    YearlyDatapoint
} from "@/lib/types"
import { sumPool } from "@/lib/yearlyView"
import { calculateCGT, CGTWithdrawal, initialTaxPosition, updateTaxPosition } from "@/lib/tax"
import { applyBedAndISAToPensions, applyBedAndISAToStocks } from "@/lib/annual/bedAndIsa"
import { applyOneOffs } from "@/lib/annual/oneOffs"
import { applyMarketShock } from "@/lib/annual/marketShock"
import { applyGrowth } from "@/lib/annual/growth"

export function calculateProjection(
    data: RetirementData,
    maxYears: number = Infinity,
    strategy: DrawdownStrategy = "balanced"
): ProjectionResult {
    console.clear()

    const { personal, assets, shocks, assumptions, incomeTax, incomeNeeds, retirementIncome, oneOffs } = data

    const currentYear = new Date().getFullYear()
    const birthYear = new Date(personal.dateOfBirth).getFullYear()
    const currentAge = currentYear - birthYear
    const retirementAge = personal.retirementAge

    // Limit the projection to at most `maxYears` from the current age, with an absolute
    // upper bound of age 100 to avoid runaway loops. Default is Infinity (effectively up to 100).
    const maxAge = Math.min(currentAge + (isFinite(maxYears) ? Math.max(0, Math.floor(maxYears)) : Infinity), 100)
    const yearlyData: YearlyDatapoint[] = []

    // Build separate asset maps for primary and spouse
    const assetPools = buildAssetPools(assets)

    // Build base cost pools for CGT calculation (tracks original cost basis)
    const baseCostPools = buildBaseCgtCostPools(assets)

    const spouseBirthYear = personal.spouseDateOfBirth ? new Date(personal.spouseDateOfBirth).getFullYear() : null

    let runsOutAt: number = 0

    for (let age = currentAge; age <= maxAge; age++) {
        const year = birthYear + age
        const yearsFromNow = year - currentYear
        const inflationMultiplier = Math.pow(1 + assumptions.inflationRate / 100, yearsFromNow)
        const taxBandMultiplier = Math.pow(
            1 + (assumptions.taxBandIncreaseRate ?? assumptions.inflationRate) / 100,
            yearsFromNow
        )
        const spouseAge = year - (spouseBirthYear || Number.NaN)
        const ages = [age, spouseAge]

        // Bed and ISA process runs at the start of each year for eligible individuals.
        // First convert taxable stocks into ISA (utilising the CGT allowance, optionally
        // gifting between spouses), then use any remaining ISA allowance to crystallise
        // pension (age 55+) and take the 25% tax-free lump sum into ISA.
        if (assumptions.bedAndISAEnabled) {
            const hasSpouse = !isNaN(spouseAge)
            const remainingISAAllowance = applyBedAndISAToStocks(assetPools, baseCostPools, assumptions, hasSpouse)
            applyBedAndISAToPensions(assetPools, ages, remainingISAAllowance)
        }

        applyGrowth(assetPools, assumptions, age, retirementAge)
        applyOneOffs(assetPools, oneOffs, ages, inflationMultiplier)
        applyMarketShock(
            assetPools,
            shocks.find(s => s.year === year && s.enabled !== false)
        )

        // Snapshot the post-growth, pre-drawdown position. This is the position the
        // drawdown strategy sees. End-of-year balances are derived as
        //   endPosition[t] = initialPosition[t] - withdrawals[t]
        // (cash spent on tax/CGT is already reflected in `withdrawals.cash`).
        const initialPosition: AssetPool[] = assetPools.map(a => ({ ...a }))

        const statePensionIncome = buildStatePensions(age, spouseAge, inflationMultiplier)
        const otherIncome = buildOtherIncome(retirementIncome, year, inflationMultiplier)

        const taxableIncome = statePensionIncome.map((pension, i) => pension + otherIncome[i])

        // Calculate expenditure
        let expenditure = 0
        if (age >= retirementAge) {
            const applicableNeed = getNetExpenditure(incomeNeeds, retirementAge, age)
            if (applicableNeed) {
                expenditure = applicableNeed.annualAmount * inflationMultiplier
            }
        }

        const baseTaxableIncome = sumNumbers(taxableIncome)

        const taxPosition = taxableIncome.map(_ => initialTaxPosition(incomeTax, taxBandMultiplier))
        taxPosition.forEach((p, i) => {
            taxPosition[i] = updateTaxPosition(taxableIncome[i], p)
        })

        const initialTaxLiability = taxPosition.map(p => p.tax)

        const initialCashLiability = -sumNumbers(assetPools.map(pool => Math.min(0, pool.cash)))
        assetPools.forEach(pool => {
            // Ensure cash pool non-negative (negative cash is added to shortfall)
            pool.cash = Math.max(0, pool.cash)
        })

        if (age >= retirementAge) {
            // Initial tax liability is handled in `execute` method, so just include the initial cash liability here
            const shortfall = expenditure - baseTaxableIncome + initialCashLiability

            if (shortfall > 0) {
                const growthRates = Object.fromEntries(
                    Object.values(AssetType).map(type => [type, growthRateFor(assumptions.categoryGrowthRates, type)])
                ) as AssetPool

                const strategyInstance = createDrawdownStrategy(strategy, incomeTax, growthRates)
                strategyInstance.execute(assetPools, shortfall, taxPosition)
            }
        }

        // Compute withdrawals by pool and by asset class (positive reductions only).
        // At this point cash has already been debited for the drawdown itself but not yet
        // for income tax / CGT — those are folded in below so that the final withdrawal map
        // equals `initialPosition - endingBalances` exactly.
        const withdrawalsDetailPerPool: [AssetPool, AssetPool] = [createEmptyAssetPool(), createEmptyAssetPool()]
        for (let i = 0; i < 2; i++) {
            for (const type of assetTypes) {
                const diff = initialPosition[i][type] - assetPools[i][type]
                withdrawalsDetailPerPool[i][type] = diff > 0 ? diff : 0
            }
        }

        const taxableWithdrawals = assetPools.map((pool, i) => {
            return assetTypes
                .filter(type => isTaxable(type))
                .reduce((sum, type) => sum + initialPosition[i][type] - pool[type], 0)
        })

        taxableWithdrawals.forEach((taxable, i) => {
            taxPosition[i] = updateTaxPosition(taxable, taxPosition[i])
        })

        // Settle additional income tax (over what was implicitly paid during drawdown)
        // out of cash, and reflect it in the recorded cash withdrawal.
        assetPools.forEach((pool, i) => {
            const additionalTax = taxPosition[i].tax - initialTaxLiability[i]
            pool.cash -= additionalTax
            withdrawalsDetailPerPool[i].cash += additionalTax
        })

        // Calculate CGT for withdrawals from CGT-liable assets (stocks, bonds)
        const cgtWithdrawalsPerPool: CGTWithdrawal[][] = assetPools.map((pool, i) => {
            const withdrawals: CGTWithdrawal[] = []
            for (const type of assetTypes) {
                if (isCGTLiable(type)) {
                    const withdrawal = initialPosition[i][type] - pool[type]
                    if (withdrawal > 0) {
                        // Calculate base cost ratio: what proportion of current value is original cost
                        const currentValue = initialPosition[i][type]
                        const baseCost = baseCostPools[i][type]
                        const baseCostRatio = currentValue > 0 ? Math.min(1, baseCost / currentValue) : 1

                        withdrawals.push({ withdrawal, baseCostRatio })

                        // Update base cost pool proportionally to withdrawal
                        // If we withdraw X% of the asset, we also "withdraw" X% of the base cost
                        const withdrawalRatio = withdrawal / currentValue
                        baseCostPools[i][type] -= baseCost * withdrawalRatio
                    }
                }
            }
            return withdrawals
        })

        // Calculate CGT for each person and subtract from their cash pool
        const cgtResults = cgtWithdrawalsPerPool.map(withdrawals =>
            calculateCGT(withdrawals, assumptions, inflationMultiplier)
        )

        assetPools.forEach((pool, i) => {
            const cgtPayable = cgtResults[i].cgtPayable
            pool.cash -= cgtPayable
            withdrawalsDetailPerPool[i].cash += cgtPayable
        })

        // Build the per-pool record. End-of-year balances are *not* stored: they can be
        // recovered as `initialPosition - withdrawals`.
        const pools: [PoolYear, PoolYear] = [
            {
                initialPosition: initialPosition[0],
                income: {
                    statePension: statePensionIncome[0] || 0,
                    otherIncome: otherIncome[0] || 0
                },
                withdrawals: withdrawalsDetailPerPool[0],
                tax: taxPosition[0].tax,
                cgtPayable: cgtResults[0].cgtPayable
            },
            {
                initialPosition: initialPosition[1],
                income: {
                    statePension: statePensionIncome[1] || 0,
                    otherIncome: otherIncome[1] || 0
                },
                withdrawals: withdrawalsDetailPerPool[1],
                tax: taxPosition[1].tax,
                cgtPayable: cgtResults[1].cgtPayable
            }
        ]

        // Compute end-of-year total assets and any unmet shortfall for the year.
        const currentTotalAssets = assetPools.reduce((sum, pool) => sum + sumPool(pool), 0)
        const totalTaxPayable = taxPosition[0].tax + taxPosition[1].tax
        const totalCGTPayable = cgtResults[0].cgtPayable + cgtResults[1].cgtPayable
        const totalWithdrawalsSum = sumPool(withdrawalsDetailPerPool[0]) + sumPool(withdrawalsDetailPerPool[1])
        const netResourcesForSpending = baseTaxableIncome + totalWithdrawalsSum - totalTaxPayable - totalCGTPayable
        const computedShortfall = age >= retirementAge ? Math.max(0, expenditure - netResourcesForSpending) : 0

        yearlyData.push({
            year,
            age,
            pools,
            expenditure,
            shortfall: computedShortfall
        })

        if (currentTotalAssets <= 0 && !runsOutAt && age >= retirementAge) {
            runsOutAt = year
        }
    }

    return {
        yearlyData,
        runsOutAt,
        totalNeeded: 0,
        currentAssets: data.assets.reduce((sum, asset) => sum + asset.value, 0)
    }
}
