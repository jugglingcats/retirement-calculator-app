import { assetTypes, growthRateFor, isCGTLiable, isTaxable, sumNumbers } from "@/lib/utils"
import {
    AssetPool,
    AssetPoolType,
    AssetType,
    DrawdownStrategy,
    PoolYear,
    ProjectionResult,
    RetirementData,
    RetirementIncome,
    YearlyDatapoint
} from "@/lib/types"
import { emptyAssetPool, sumPool } from "@/lib/yearlyView"
import { calculateCGT, CGTWithdrawal, initialTaxPosition, updateTaxPosition } from "@/lib/tax"
import { createDrawdownStrategy } from "@/lib/strategies"
import { applyBedAndISA } from "@/lib/annual/bedAndIsa"
import { applyOneOffs } from "@/lib/annual/oneOffs"
import { applyMarketShock } from "@/lib/annual/marketShock"
import { applyGrowth } from "@/lib/annual/growth"

// Type for tracking base costs of CGT-liable assets
type BaseCostPool = Record<AssetType, number>

const UK_STATE_PENSION_2024 = 11502
const STATE_PENSION_AGE = 67

function getNetExpenditure(incomeNeeds: RetirementData["incomeNeeds"], retirementAge: number, age: number) {
    const sortedNeeds = [...incomeNeeds]
        .map(need => ({
            ...need,
            effectiveStartingAge: need.startingAge ?? retirementAge
        }))
        .sort((a, b) => b.effectiveStartingAge - a.effectiveStartingAge)

    return sortedNeeds.find(need => age >= need.effectiveStartingAge)
}

function buildAssetPools(assets: RetirementData["assets"]): [AssetPool, AssetPool] {
    const primary = emptyAssetPool()
    const spouse = emptyAssetPool()

    for (const asset of assets) {
        if (asset.belongsToSpouse) {
            spouse[asset.category] += asset.value
        } else {
            primary[asset.category] += asset.value
        }
    }

    return [primary, spouse]
}

function createEmptyBaseCostPool(): BaseCostPool {
    return Object.fromEntries(Object.values(AssetType).map(type => [type, 0])) as BaseCostPool
}

/**
 * Build base cost pools for CGT-liable assets.
 * For assets without a baseCost specified, assume baseCost equals current value (no gain).
 */
function buildBaseCostPools(assets: RetirementData["assets"]): [BaseCostPool, BaseCostPool] {
    const primary = createEmptyBaseCostPool()
    const spouse = createEmptyBaseCostPool()

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

function buildStatePensions(age: number, spouseAge: number, inflationMultiplier: number): number[] {
    // Calculate state pension per person
    return [
        age >= STATE_PENSION_AGE ? UK_STATE_PENSION_2024 : 0,
        spouseAge >= STATE_PENSION_AGE ? UK_STATE_PENSION_2024 : 0
    ].map(v => v * inflationMultiplier)
}

function buildOtherIncome(incomeSources: RetirementIncome[], year: number, inflationMultiplier: number): number[] {
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
    const baseCostPools = buildBaseCostPools(assets)

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

        // Bed and ISA process runs at the start of each year for eligible individuals (age 55+)
        if (assumptions.bedAndISAEnabled) {
            applyBedAndISA(assetPools, ages)
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
        const initialPosition: [AssetPool, AssetPool] = [{ ...assetPools[0] }, { ...assetPools[1] }]

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
                ) as Record<AssetType, number>

                const strategyInstance = createDrawdownStrategy(strategy, incomeTax, growthRates)
                strategyInstance.execute(assetPools, shortfall, taxPosition)
            }
        }

        // Compute withdrawals by pool and by asset class (positive reductions only).
        // At this point cash has already been debited for the drawdown itself but not yet
        // for income tax / CGT — those are folded in below so that the final withdrawal map
        // equals `initialPosition - endingBalances` exactly.
        const withdrawalsDetailPerPool: [AssetPool, AssetPool] = [emptyAssetPool(), emptyAssetPool()]
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
