import {
    assetTypes,
    buildAssetPools,
    buildBaseCgtCostPools,
    buildOtherIncome,
    buildStatePensions,
    createEmptyAssetPool,
    getNetExpenditure,
    growthRateFor,
    isCGTLiable,
    isTaxable,
    sumNumbers
} from "@/lib/utils"
import { createDrawdownStrategy } from "@/lib/strategyFactory"
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
import { applyMarketShocks } from "@/lib/annual/marketShock"
import { applyGrowth } from "@/lib/annual/growth"

export function calculateProjection(
    data: RetirementData,
    maxYears: number = Infinity,
    strategy: DrawdownStrategy = "balanced"
): ProjectionResult {
    console.clear()

    const { personal, assets, shocks, assumptions, incomeTax, incomeNeeds, incomeStreams, oneOffs } = data

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

    // The partner is included in the projection only when explicitly enabled. For
    // backward compatibility with saved data created before the toggle existed,
    // treat the presence of `spouseDateOfBirth` as implicitly enabling the partner.
    const includePartner = personal.includePartner ?? Boolean(personal.spouseDateOfBirth)
    const spouseBirthYear =
        includePartner && personal.spouseDateOfBirth ? new Date(personal.spouseDateOfBirth).getFullYear() : null
    // Partner's retirement age defaults to the primary's when unset.
    const spouseRetirementAge = includePartner ? (personal.spouseRetirementAge ?? retirementAge) : retirementAge

    // Per-pool retirement year used for income streams that end at retirement, and
    // for the ISA glide path. When no partner is configured we fall back to the
    // primary's retirement year for the (empty) spouse pool.
    const primaryRetirementYear = birthYear + retirementAge
    const spouseRetirementYear = (spouseBirthYear ?? birthYear) + spouseRetirementAge
    const retirementYears: [number, number] = [primaryRetirementYear, spouseRetirementYear]
    const retirementAges: [number, number] = [retirementAge, spouseRetirementAge]

    let runsOutAt: number = 0

    // Gross income surplus (income minus expenditure, before tax is considered) carried
    // from the previous year into each pool's cash. Tax is already deducted from the pool
    // separately, so we carry the gross excess here and the two together produce the
    // correct net cash deposit.
    let surplusToDeposit: [number, number] = [0, 0]

    for (let age = currentAge; age <= maxAge; age++) {
        // Deposit previous year's income surplus into cash at the start of this year,
        // before bed-and-ISA, growth, and all other processing.
        assetPools[0].cash += surplusToDeposit[0]
        assetPools[1].cash += surplusToDeposit[1]
        surplusToDeposit = [0, 0]

        const year = birthYear + age
        const yearsFromNow = year - currentYear
        const inflationMultiplier = Math.pow(1 + assumptions.inflationRate / 100, yearsFromNow)
        const taxBandMultiplier = Math.pow(
            1 + (assumptions.taxBandIncreaseRate ?? assumptions.inflationRate) / 100,
            yearsFromNow
        )
        const spouseAge = year - (spouseBirthYear || Number.NaN)
        const ages = [age, spouseAge]

        applyMarketShocks(
            assetPools,
            shocks.filter(s => s.year === year && s.enabled !== false)
        )
        // Bed and ISA process runs at the start of each year for eligible individuals.
        // First convert taxable stocks into ISA (utilising the CGT allowance, optionally
        // gifting between spouses), then use any remaining ISA allowance to crystallise
        // pension (age 55+) and take the 25% tax-free lump sum into ISA.
        if (assumptions.bedAndISAEnabled) {
            const hasSpouse = !isNaN(spouseAge)
            const remainingISAAllowance = applyBedAndISAToStocks(assetPools, baseCostPools, assumptions, hasSpouse)
            applyBedAndISAToPensions(assetPools, ages, remainingISAAllowance)
        }

        applyGrowth(assetPools, assumptions, ages, retirementAges)
        applyOneOffs(assetPools, oneOffs, ages, inflationMultiplier)

        // Snapshot the post-growth, pre-drawdown position. This is the position the
        // drawdown strategy sees. End-of-year balances are derived as
        //   endPosition[t] = initialPosition[t] - withdrawals[t]
        // (cash spent on tax/CGT is already reflected in `withdrawals.cash`).
        const initialPosition: AssetPool[] = assetPools.map(a => ({ ...a }))

        const statePensionIncome = buildStatePensions(age, spouseAge, inflationMultiplier)
        const otherIncome = buildOtherIncome(incomeStreams, year, inflationMultiplier, {
            currentYear,
            retirementYears
        })

        const taxableIncome = statePensionIncome.map((pension, i) => pension + otherIncome[i])

        // Calculate expenditure — applicable from the income need's own startingAge
        // (defaults to current age). getNetExpenditure returns undefined when no need
        // is active yet (i.e. age < the earliest effectiveStartingAge).
        let expenditure = 0
        const applicableNeed = getNetExpenditure(incomeNeeds, currentAge, age)
        if (applicableNeed) {
            expenditure = applicableNeed.annualAmount * inflationMultiplier
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

        if (expenditure > 0) {
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

        // Compute the net income surplus for this year and carry it into cash at the
        // start of next year: income minus spending minus all tax due.
        // In the surplus case the initial tax liability on income is never independently
        // debited from cash (only additional tax on drawdowns is), so we must subtract
        // the full tax position here to get the true net surplus.
        const totalTaxThisYear = taxPosition[0].tax + taxPosition[1].tax
        const totalCGTThisYear = cgtResults[0].cgtPayable + cgtResults[1].cgtPayable
        const netSurplus = Math.max(0, baseTaxableIncome - expenditure - totalTaxThisYear - totalCGTThisYear)
        if (netSurplus > 0 && baseTaxableIncome > 0) {
            surplusToDeposit = [
                (netSurplus * taxableIncome[0]) / baseTaxableIncome,
                (netSurplus * taxableIncome[1]) / baseTaxableIncome
            ]
        }

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
        const computedShortfall = expenditure > 0 ? Math.max(0, expenditure - netResourcesForSpending) : 0

        yearlyData.push({
            year,
            age,
            pools,
            expenditure,
            shortfall: computedShortfall
        })

        if (currentTotalAssets <= 0 && !runsOutAt && expenditure > 0) {
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
