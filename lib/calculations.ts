import { AssetType, DrawdownStrategy, RetirementData } from "@/types"
import { getGrowthCategory, growthRateFor } from "@/lib/utils"
import { run_shortfall_calculation_split } from "@/lib/shortfall"
import { AssetBalances, ProjectionResult, YearlyDatapoint } from "@/lib/types"

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

function createEmptyAssetBalances(): AssetBalances {
    return Object.fromEntries(Object.values(AssetType).map(type => [type, 0])) as AssetBalances
}

function buildAssetsByOwner(assets: RetirementData["assets"]): { primary: AssetBalances; spouse: AssetBalances } {
    const primary = createEmptyAssetBalances()
    const spouse = createEmptyAssetBalances()

    for (const asset of assets) {
        if (asset.belongsToSpouse) {
            spouse[asset.category] += asset.value
        } else {
            primary[asset.category] += asset.value
        }
    }

    return { primary, spouse }
}

function applyGrowth(assets: AssetBalances, categoryGrowthRates: Record<string, number>): void {
    for (const type of Object.values(AssetType)) {
        const growthRate = growthRateFor(categoryGrowthRates, type)
        assets[type] *= 1 + growthRate
    }
}

function applyMarketShock(assets: AssetBalances, shockMultiplier: number): void {
    for (const type of Object.values(AssetType)) {
        if (getGrowthCategory(type) === "stocks") {
            assets[type] *= shockMultiplier
        }
    }
}

function sumAssets(assets: AssetBalances): number {
    return assets.cash + assets.isa + assets.pension + assets.property
}

function combineAssets(primary: AssetBalances, spouse: AssetBalances): AssetBalances {
    const combined = createEmptyAssetBalances()
    for (const type of Object.values(AssetType)) {
        combined[type] = primary[type] + spouse[type]
    }
    return combined
}

export function calculateProjection(
    data: RetirementData,
    maxYears: number = Infinity,
    strategy: DrawdownStrategy = "balanced"
): ProjectionResult {
    console.clear()

    const currentYear = new Date().getFullYear()
    const birthYear = new Date(data.personal.dateOfBirth).getFullYear()
    const currentAge = currentYear - birthYear
    const retirementAge = data.personal.retirementAge

    // Limit the projection to at most `maxYears` from the current age, with an absolute
    // upper bound of age 100 to avoid runaway loops. Default is Infinity (effectively up to 100).
    const maxAge = Math.min(currentAge + (isFinite(maxYears) ? Math.max(0, Math.floor(maxYears)) : Infinity), 100)
    const yearlyData: YearlyDatapoint[] = []

    // Build separate asset maps for primary and spouse
    const { primary: primaryAssets, spouse: spouseAssets } = buildAssetsByOwner(data.assets)

    const spouseBirthYear = data.personal.spouseDateOfBirth
        ? new Date(data.personal.spouseDateOfBirth).getFullYear()
        : null

    let runsOutAt: number = 0

    for (let age = currentAge; age <= maxAge; age++) {
        const year = birthYear + age
        const yearsFromNow = year - currentYear
        const inflationMultiplier = Math.pow(1 + data.assumptions.inflationRate / 100, yearsFromNow)

        // Apply growth to both asset pools
        applyGrowth(primaryAssets, data.assumptions.categoryGrowthRates)
        applyGrowth(spouseAssets, data.assumptions.categoryGrowthRates)

        // Handle one-off events - add to correct owner's cash
        if (data.oneOffs) {
            data.oneOffs.forEach(oneOff => {
                if (oneOff.enabled && age === oneOff.age) {
                    const adjustedAmount = oneOff.amount * inflationMultiplier
                    if (oneOff.belongsToSpouse) {
                        spouseAssets.cash += adjustedAmount
                    } else {
                        primaryAssets.cash += adjustedAmount
                    }
                }
            })
        }

        // Apply market shocks to both pools
        const shock = data.shocks.find(s => s.year === year)
        if (shock) {
            const shockMultiplier = 1 + shock.impactPercent / 100
            applyMarketShock(primaryAssets, shockMultiplier)
            applyMarketShock(spouseAssets, shockMultiplier)
        }

        // Calculate state pension per person
        let primaryStatePension = 0
        let spouseStatePension = 0

        if (age >= STATE_PENSION_AGE) {
            primaryStatePension = UK_STATE_PENSION_2024
        }

        if (spouseBirthYear) {
            const spouseAge = year - spouseBirthYear
            if (spouseAge >= STATE_PENSION_AGE) {
                spouseStatePension = UK_STATE_PENSION_2024
            }
        }

        const adjustedPrimaryStatePension = primaryStatePension * inflationMultiplier
        const adjustedSpouseStatePension = spouseStatePension * inflationMultiplier
        const totalStatePension = adjustedPrimaryStatePension + adjustedSpouseStatePension

        // Calculate retirement income per person
        let primaryRetirementIncome = 0
        let spouseRetirementIncome = 0

        if (data.retirementIncome) {
            data.retirementIncome.forEach(income => {
                if (income.enabled && year >= income.startYear && (!income.endYear || year <= income.endYear)) {
                    const growthRate = income.growthRate || 0
                    const inflation_multiplier = income.inflationAdjusted ? inflationMultiplier : 1
                    const growth_multiplier = Math.pow(1 + growthRate / 100, year - income.startYear)
                    const amount = income.annualAmount * inflation_multiplier * growth_multiplier

                    if (income.belongsToSpouse) {
                        spouseRetirementIncome += amount
                    } else {
                        primaryRetirementIncome += amount
                    }
                }
            })
        }

        const totalRetirementIncome = primaryRetirementIncome + spouseRetirementIncome

        // Calculate expenditure
        let netExpenditure = 0
        if (age >= retirementAge) {
            const applicableNeed = getNetExpenditure(data.incomeNeeds, retirementAge, age)
            if (applicableNeed) {
                netExpenditure = applicableNeed.annualAmount * inflationMultiplier
            }
        }

        let taxPayable = 0
        let assetWithdrawals = 0
        const baseTaxableIncome = totalStatePension + totalRetirementIncome

        if (age >= retirementAge) {
            const netShortfall = netExpenditure - baseTaxableIncome

            if (netShortfall > 0) {
                const result = run_shortfall_calculation_split(
                    data,
                    primaryAssets,
                    spouseAssets,
                    netShortfall,
                    adjustedPrimaryStatePension,
                    adjustedSpouseStatePension,
                    primaryRetirementIncome,
                    spouseRetirementIncome,
                    strategy
                )
                taxPayable = result.primaryTax + result.spouseTax
                assetWithdrawals =
                    result.primaryWithdrawn + result.spouseWithdrawn + result.primaryTax + result.spouseTax

                primaryAssets.cash -= result.primaryTax
                spouseAssets.cash -= result.spouseTax
            }
        }

        // Combine assets for chart display
        const combinedAssets = combineAssets(primaryAssets, spouseAssets)
        const currentTotalAssets = sumAssets(combinedAssets)

        yearlyData.push({
            year,
            age,
            assets: Math.max(0, currentTotalAssets),
            cash: Math.max(0, combinedAssets.cash),
            isa: Math.max(0, combinedAssets.isa),
            pension: Math.max(0, combinedAssets.pension),
            property: Math.max(0, combinedAssets.property),
            income: baseTaxableIncome,
            expenditure: netExpenditure,
            statePension: totalStatePension,
            retirementIncome: totalRetirementIncome,
            taxPayable,
            assetWithdrawals
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
