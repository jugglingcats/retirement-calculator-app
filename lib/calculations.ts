import { assetTypes, growthRateFor, isTaxable, sumAssets, sumNumbers } from "@/lib/utils"
import {
    AssetPool,
    AssetPoolType,
    AssetType,
    DrawdownStrategy,
    ProjectionResult,
    RetirementData,
    RetirementIncome,
    YearlyDatapoint
} from "@/lib/types"
import { initialTaxPosition, updateTaxPosition } from "@/lib/tax"
import { createDrawdownStrategy } from "@/lib/strategies"
import { applyBedAndISA } from "@/lib/annual/bedAndIsa"
import { applyOneOffs } from "@/lib/annual/oneOffs"
import { applyMarketShock } from "@/lib/annual/marketShock"
import { applyGrowth } from "@/lib/annual/growth"

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

function createEmptyAssetBalances(): AssetPool {
    return Object.fromEntries(Object.values(AssetType).map(type => [type, 0])) as AssetPool
}

function buildAssetPools(assets: RetirementData["assets"]): [AssetPool, AssetPool] {
    const primary = createEmptyAssetBalances()
    const spouse = createEmptyAssetBalances()

    for (const asset of assets) {
        if (asset.belongsToSpouse) {
            spouse[asset.category] += asset.value
        } else {
            primary[asset.category] += asset.value
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

function buildRetirementIncome(incomeSources: RetirementIncome[], year: number, inflationMultiplier: number): number[] {
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

function combineAssets(pools: AssetPool[]): AssetPool {
    const combined = createEmptyAssetBalances()
    for (const pool of pools) {
        for (const type of Object.values(AssetType)) {
            combined[type] += pool[type]
        }
    }
    return combined
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
            shocks.find(s => s.year === year)
        )

        const statePensionIncome = buildStatePensions(age, spouseAge, inflationMultiplier)
        const otherIncome = buildRetirementIncome(retirementIncome, year, inflationMultiplier)

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
            const income = taxableIncome[i]
            taxPosition[i] = updateTaxPosition(income, p)
        })

        const initialTaxLiability = taxPosition.map(p => p.tax)

        const initialCashLiability = -sumNumbers(assetPools.map(pool => Math.min(0, pool.cash)))
        assetPools.forEach(pool => {
            // Ensure cash pool non-negative (negative cash is added to shortfall)
            pool.cash = Math.max(0, pool.cash)
        })

        const startingAssets = assetPools.map(pool => ({
            ...pool
        }))

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

        const totalWithdrawals = assetPools.map((pool, i) => {
            return assetTypes.reduce((sum, type) => sum + startingAssets[i][type] - pool[type], 0)
        })

        const taxableWithdrawals = assetPools.map((pool, i) => {
            return assetTypes
                .filter(type => isTaxable(type))
                .reduce((sum, type) => sum + startingAssets[i][type] - pool[type], 0)
        })

        taxableWithdrawals.forEach((taxable, i) => {
            taxPosition[i] = updateTaxPosition(taxable, taxPosition[i])
        })

        assetPools.forEach((pool, i) => {
            const additionalTax = taxPosition[i].tax - initialTaxLiability[i]
            pool.cash -= additionalTax
        })

        // Combine assets for chart display
        const combinedAssets = combineAssets(assetPools)
        const currentTotalAssets = sumAssets(combinedAssets)

        // Compute total tax and any unmet shortfall for the year
        const totalTaxPayable = sumNumbers(taxPosition.map(p => p.tax))
        const totalWithdrawalsSum = sumNumbers(totalWithdrawals)
        const netResourcesForSpending = baseTaxableIncome + totalWithdrawalsSum - totalTaxPayable
        const computedShortfall = age >= retirementAge ? Math.max(0, expenditure - netResourcesForSpending) : 0

        yearlyData.push({
            year,
            age,
            assets: Math.max(0, currentTotalAssets),
            cash: Math.max(0, combinedAssets.cash),
            stocks: Math.max(0, combinedAssets.stocks),
            isa: Math.max(0, combinedAssets.isa),
            pension: Math.max(0, combinedAssets.pension),
            pensionCrystallised: Math.max(0, combinedAssets.pensionCrystallised),
            property: Math.max(0, combinedAssets.property),
            income: baseTaxableIncome,
            expenditure: expenditure,
            statePension: sumNumbers(statePensionIncome),
            retirementIncome: sumNumbers(otherIncome),
            taxPayable: totalTaxPayable,
            assetWithdrawals: totalWithdrawalsSum,
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
