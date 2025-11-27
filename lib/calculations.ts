import { AssetType, RetirementData, DrawdownStrategy } from "@/types"
import { performDrawdown, AssetBalances } from "@/lib/drawdown"

const UK_STATE_PENSION_2024 = 11502
const STATE_PENSION_AGE = 67

function calculateIncomeTax(taxableIncome: number, personalAllowance: number, higherRateThreshold: number): number {
    if (taxableIncome <= personalAllowance) {
        return 0
    }

    const taxableAmount = taxableIncome - personalAllowance

    if (taxableIncome <= higherRateThreshold) {
        // All taxable income is in basic rate band (20%)
        return taxableAmount * 0.2
    }

    // Some income is in higher rate band (40%)
    const basicRateAmount = higherRateThreshold - personalAllowance
    const higherRateAmount = taxableAmount - basicRateAmount

    return basicRateAmount * 0.2 + higherRateAmount * 0.4
}

type YearlyDatapoint = {
    year: number
    age: number
    assets: number
    cash: number
    isa: number
    pension: number
    property: number
    income: number
    expenditure: number
    statePension: number
    retirementIncome: number
    taxPayable: number
}

export function calculateProjection(
    data: RetirementData,
    maxYears: number = Infinity,
    strategy: DrawdownStrategy = "balanced"
): { yearlyData: YearlyDatapoint[]; runsOutAt: number; totalNeeded: number; currentAssets: number } {
    console.clear()

    console.log("Growth rates: ", data.assumptions.categoryGrowthRates)

    if (!data.personal.dateOfBirth || data.assets.length === 0) {
        return { yearlyData: [], runsOutAt: 0, currentAssets: 0, totalNeeded: 0 }
    }

    const currentYear = new Date().getFullYear()
    const birthYear = new Date(data.personal.dateOfBirth).getFullYear()
    const currentAge = currentYear - birthYear
    const retirementAge = data.personal.retirementAge

    const spouseBirthYear = data.personal.spouseDateOfBirth
        ? new Date(data.personal.spouseDateOfBirth).getFullYear()
        : null

    // Limit the projection to at most `maxYears` from the current age, with an absolute
    // upper bound of age 100 to avoid runaway loops. Default is Infinity (effectively up to 100).
    const maxAge = Math.min(currentAge + (isFinite(maxYears) ? Math.max(0, Math.floor(maxYears)) : Infinity), 100)
    const yearlyData: YearlyDatapoint[] = []

    // Build a complete map of all asset types, summing values for categories that appear multiple times
    const assetsByType = Object.fromEntries(
        Object.values(AssetType).map(
            type =>
                [
                    type,
                    data.assets.reduce((sum, asset) => sum + (asset.category === type ? asset.value : 0), 0)
                ] as const
        )
    )

    let runsOutAt: number = 0

    // Helper to map an AssetType to a growth category key used in assumptions
    function getGrowthCategory(category: AssetType) {
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

    function growthRateFor(type: AssetType): number {
        const key = getGrowthCategory(type)
        const pct = data.assumptions.categoryGrowthRates[key] || 0
        return pct / 100
    }

    /**
     * RUN SHORTFALL CALCULATION
     */
    function run_shortfall_calculation(shortfall: number, adjustedStatePension: number, retirementIncome: number) {
        // Need to withdraw from assets
        let remainingShortfall = shortfall
        let taxableWithdrawals = 0

        if (strategy === "tax_optimized") {
            // Step 1: Withdraw from ISA (tax-free) up to higher-rate threshold buffer
            if (remainingShortfall > 0) {
                const currentTaxableIncome = adjustedStatePension + retirementIncome + taxableWithdrawals
                const roomBeforeHigherRate = Math.max(0, data.incomeTax.higherRateThreshold - currentTaxableIncome)
                const isaWithdrawal = Math.min(roomBeforeHigherRate, assetsByType.isa, remainingShortfall)
                assetsByType.isa -= isaWithdrawal
                remainingShortfall -= isaWithdrawal
            }

            // remaining shortfall is now taxable income
            const taxToPay = calculateIncomeTax(
                remainingShortfall,
                data.incomeTax.personalAllowance,
                data.incomeTax.higherRateThreshold
            )
            // we need to find the shortfall and the tax (to keep the same take home pay)
            remainingShortfall += taxToPay
            const totalTaxableIncome = adjustedStatePension + retirementIncome + remainingShortfall

            // Step 2: Withdraw from Cash first (taxable)
            if (remainingShortfall > 0) {
                const cashWithdrawal = Math.min(remainingShortfall, assetsByType.cash)
                assetsByType.cash -= cashWithdrawal
                taxableWithdrawals += cashWithdrawal
                remainingShortfall -= cashWithdrawal
            }

            // Step 3: Withdraw from Pension (taxable)
            if (remainingShortfall > 0) {
                const pensionWithdrawal = Math.min(remainingShortfall, assetsByType.pension)
                assetsByType.pension -= pensionWithdrawal
                // taxableWithdrawals += pensionWithdrawal
                remainingShortfall -= pensionWithdrawal
            }

            // Step 4: Sell Property last (taxable, less liquid)
            if (remainingShortfall > 0) {
                const propertyWithdrawal = Math.min(remainingShortfall, assetsByType.property)
                assetsByType.property -= propertyWithdrawal
                // taxableWithdrawals += propertyWithdrawal
                remainingShortfall -= propertyWithdrawal
            }

            // Step 5: Withdraw remaining from ISA (forced)
            if (remainingShortfall > 0) {
                const isaWithdrawal = Math.min(remainingShortfall, assetsByType.isa)
                assetsByType.isa -= isaWithdrawal
                // remainingShortfall -= isaWithdrawal
            }

            // Calculate tax on total taxable income (income + taxable withdrawals)
            return calculateIncomeTax(
                totalTaxableIncome,
                data.incomeTax.personalAllowance,
                data.incomeTax.higherRateThreshold
            )
        } else {
            // "balanced" or "lowest_growth_first" strategies use the drawdown module
            // Build growth rates record for each asset type
            const growthRates = Object.fromEntries(
                Object.values(AssetType).map(type => [type, growthRateFor(type)])
            ) as Record<AssetType, number>

            // Compute tax on shortfall as taxable income
            const taxToPay = calculateIncomeTax(
                remainingShortfall,
                data.incomeTax.personalAllowance,
                data.incomeTax.higherRateThreshold
            )
            const totalNeeded = remainingShortfall + taxToPay
            const totalTaxableIncome = adjustedStatePension + retirementIncome + totalNeeded

            // Perform the drawdown using the selected strategy
            performDrawdown(
                assetsByType as AssetBalances,
                totalNeeded,
                growthRates,
                strategy as "balanced" | "lowest_growth_first"
            )

            return calculateIncomeTax(
                totalTaxableIncome,
                data.incomeTax.personalAllowance,
                data.incomeTax.higherRateThreshold
            )
        }

        // Reinvest surplus after tax into ISA (tax-efficient)
        // const surplus = totalIncome - expenditure - taxPayable
        // if (surplus > 0) {
        //     assetsByType.isa += surplus
        // }
        // return taxPayable
    }

    for (let age = currentAge; age <= maxAge; age++) {
        const year = birthYear + age
        const yearsFromNow = year - currentYear

        Object.keys(assetsByType).forEach(type => {
            const growth_rate = growthRateFor(type as AssetType)
            assetsByType[type as AssetType] *= 1 + growth_rate
        })

        // Handle one-off events
        if (data.oneOffs) {
            data.oneOffs.forEach(oneOff => {
                if (oneOff.enabled && age === oneOff.age) {
                    const inflationMultiplier = Math.pow(1 + data.assumptions.inflationRate / 100, yearsFromNow)
                    const adjustedAmount = oneOff.amount * inflationMultiplier
                    assetsByType.cash += adjustedAmount
                }
            })
        }

        // Apply market shocks
        const shock = data.shocks.find(s => s.year === year)
        if (shock) {
            const shockMultiplier = 1 + shock.impactPercent / 100
            Object.keys(assetsByType).forEach(type => {
                assetsByType[type as keyof typeof assetsByType] *= shockMultiplier
            })
        }

        // Calculate state pension
        let statePensionIncome = 0
        if (age >= STATE_PENSION_AGE) {
            statePensionIncome += UK_STATE_PENSION_2024
        }
        if (spouseBirthYear) {
            const spouseAge = year - spouseBirthYear
            if (spouseAge >= STATE_PENSION_AGE) {
                statePensionIncome += UK_STATE_PENSION_2024
            }
        }

        const inflationMultiplier = Math.pow(1 + data.assumptions.inflationRate / 100, yearsFromNow)
        const adjustedStatePension = statePensionIncome * inflationMultiplier

        let retirementIncome = 0
        if (data.retirementIncome) {
            data.retirementIncome.forEach(income => {
                if (income.enabled && year >= income.startYear && (!income.endYear || year <= income.endYear)) {
                    let amount = income.annualAmount

                    // Amount is in today's money, adjust for inflation first
                    const inflationMultiplier = Math.pow(1 + data.assumptions.inflationRate / 100, yearsFromNow)
                    amount *= inflationMultiplier

                    // If a custom growth rate is specified (different from inflation), apply additional growth
                    if (income.growthRate !== undefined && income.growthRate !== data.assumptions.inflationRate) {
                        const yearsFromStart = year - income.startYear
                        const additionalGrowthRate = (income.growthRate - data.assumptions.inflationRate) / 100
                        const additionalGrowthMultiplier = Math.pow(1 + additionalGrowthRate, yearsFromStart)
                        amount *= additionalGrowthMultiplier
                    } else if (!income.inflationAdjusted) {
                        // If explicitly not inflation adjusted, use nominal value only
                        amount = income.annualAmount
                    }

                    retirementIncome += amount
                }
            })
        }

        // Calculate expenditure
        let expenditure = 0
        if (age >= retirementAge) {
            const sortedNeeds = [...data.incomeNeeds]
                .map(need => ({
                    ...need,
                    effectiveStartingAge: need.startingAge ?? retirementAge
                }))
                .sort((a, b) => b.effectiveStartingAge - a.effectiveStartingAge)

            const applicableNeed = sortedNeeds.find(need => age >= need.effectiveStartingAge)

            if (applicableNeed) {
                const inflationMultiplier = Math.pow(1 + data.assumptions.inflationRate / 100, yearsFromNow)
                expenditure = applicableNeed.annualAmount * inflationMultiplier
            }
        }

        let taxPayable = 0
        const totalIncome = adjustedStatePension + retirementIncome

        if (age >= retirementAge) {
            const shortfall = expenditure - totalIncome

            if (shortfall > 0) {
                taxPayable = run_shortfall_calculation(shortfall, adjustedStatePension, retirementIncome)
            } else {
                // Surplus income - calculate tax correctly on income surplus
                // const totalTaxableIncome = adjustedStatePension + retirementIncome
                // taxPayable = calculateIncomeTax(totalTaxableIncome, data.incomeTax.personalAllowance, data.incomeTax.higherRateThreshold)
                //
                // let remainingTax = taxPayable
                // if (assetsByType.cash >= remainingTax) {
                //     assetsByType.cash -= remainingTax
                //     remainingTax = 0
                // } else {
                //     remainingTax -= assetsByType.cash
                //     assetsByType.cash = 0
                // }
                //
                // if (remainingTax > 0 && assetsByType.isa >= remainingTax) {
                //     assetsByType.isa -= remainingTax
                //     remainingTax = 0
                // } else if (remainingTax > 0) {
                //     remainingTax -= assetsByType.isa
                //     assetsByType.isa = 0
                // }
                //
                // if (remainingTax > 0 && assetsByType.pension >= remainingTax) {
                //     assetsByType.pension -= remainingTax
                //     remainingTax = 0
                // } else if (remainingTax > 0) {
                //     remainingTax -= assetsByType.pension
                //     assetsByType.pension = 0
                // }
                //
                // if (remainingTax > 0) {
                //     assetsByType.property = Math.max(0, assetsByType.property - remainingTax)
                // }
                //
                // // Reinvest surplus after tax into ISA (tax-efficient)
                // const surplus = totalIncome - expenditure - taxPayable
                // if (surplus > 0) {
                //     assetsByType.isa += surplus
                // }
            }
        }

        const currentAssets = assetsByType.cash + assetsByType.isa + assetsByType.pension + assetsByType.property

        yearlyData.push({
            year,
            age,
            assets: Math.max(0, currentAssets),
            cash: Math.max(0, assetsByType.cash),
            isa: Math.max(0, assetsByType.isa),
            pension: Math.max(0, assetsByType.pension),
            property: Math.max(0, assetsByType.property),
            income: totalIncome,
            expenditure,
            statePension: adjustedStatePension,
            retirementIncome,
            taxPayable
        })

        if (currentAssets <= 0 && !runsOutAt && age >= retirementAge) {
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
