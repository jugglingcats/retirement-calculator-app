import { AssetType, RetirementData } from "@/types"

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

export function calculateProjection(data: RetirementData, maxYears: number = Infinity) {
    console.clear()

    console.log("Growth rates: ", data.assumptions.categoryGrowthRates)

    if (!data.personal.dateOfBirth || data.assets.length === 0) {
        return null
    }

    const currentYear = new Date().getFullYear()
    const birthYear = new Date(data.personal.dateOfBirth).getFullYear()
    const currentAge = currentYear - birthYear
    const retirementAge = data.personal.retirementAge

    const spouseBirthYear = data.personal.spouseDateOfBirth
        ? new Date(data.personal.spouseDateOfBirth).getFullYear()
        : null

    // Limit the projection to at most `maxYears` from the current age, with an absolute
    // upper bound of age 120 to avoid runaway loops. Default is Infinity (effectively up to 120).
    const maxAge = Math.min(currentAge + (isFinite(maxYears) ? Math.max(0, Math.floor(maxYears)) : Infinity), 120)
    const yearlyData: Array<{
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
    }> = []

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

    let runsOutAt: number | null = null

    /**
     * RUN SHORTFALL CALCULATION
     */
    function run_shortfall_calculation(
        shortfall: number,
        adjustedStatePension: number,
        retirementIncome: number,
        taxPayable: number,
        totalIncome: number,
        expenditure: number
    ) {
        // Need to withdraw from assets
        let remainingWithdrawal = shortfall
        let taxableWithdrawals = 0

        // Step 1: Withdraw from Cash first (taxable)
        if (remainingWithdrawal > 0 && assetsByType.cash > 0) {
            const cashWithdrawal = Math.min(remainingWithdrawal, assetsByType.cash)
            assetsByType.cash -= cashWithdrawal
            taxableWithdrawals += cashWithdrawal
            remainingWithdrawal -= cashWithdrawal
            console.log("withdraw cash", cashWithdrawal)
        }

        // Step 2: Withdraw from ISA (tax-free)
        // Try to minimize higher rate tax by using ISA intelligently
        if (remainingWithdrawal > 0 && assetsByType.isa > 0) {
            const currentTaxableIncome = adjustedStatePension + retirementIncome + taxableWithdrawals
            const roomBeforeHigherRate = Math.max(0, data.incomeTax.higherRateThreshold - currentTaxableIncome)

            // If we're approaching higher rate threshold, use ISA for the excess
            const isaWithdrawal = Math.min(roomBeforeHigherRate, assetsByType.isa)
            // if (roomBeforeHigherRate < remainingWithdrawal) {
            //     // Would push into higher rate, so use ISA for the excess
            //     isaWithdrawal = Math.min(remainingWithdrawal, assetsByType.isa)
            // } else {
            //     // Still in basic rate, withdraw a reasonable amount from ISA
            //     isaWithdrawal = Math.min(remainingWithdrawal, assetsByType.isa)
            // }

            assetsByType.isa -= isaWithdrawal
            remainingWithdrawal -= isaWithdrawal
        }

        // Step 3: Withdraw from Pension (taxable)
        if (remainingWithdrawal > 0 && assetsByType.pension > 0) {
            const pensionWithdrawal = Math.min(remainingWithdrawal, assetsByType.pension)
            assetsByType.pension -= pensionWithdrawal
            taxableWithdrawals += pensionWithdrawal
            remainingWithdrawal -= pensionWithdrawal
        }

        // Step 4: Sell Property last (taxable, less liquid)
        if (remainingWithdrawal > 0 && assetsByType.property > 0) {
            const propertyWithdrawal = Math.min(remainingWithdrawal, assetsByType.property)
            assetsByType.property -= propertyWithdrawal
            taxableWithdrawals += propertyWithdrawal
            remainingWithdrawal -= propertyWithdrawal
        }

        // Calculate tax on total taxable income (income + taxable withdrawals)
        const totalTaxableIncome = adjustedStatePension + retirementIncome + taxableWithdrawals
        taxPayable = calculateIncomeTax(
            totalTaxableIncome,
            data.incomeTax.personalAllowance,
            data.incomeTax.higherRateThreshold
        )

        // Withdraw tax payment from assets.
        // Preference: cash -> ISA -> pension -> property. This keeps behavior simple
        // and satisfies tests that expect tax to reduce taxable accounts when cash is exhausted.
        let remainingTax = taxPayable
        if (remainingTax > 0) {
            const fromCash = Math.min(assetsByType.cash, remainingTax)
            assetsByType.cash -= fromCash
            remainingTax -= fromCash
        }

        if (remainingTax > 0) {
            const fromIsa = Math.min(assetsByType.isa, remainingTax)
            assetsByType.isa -= fromIsa
            remainingTax -= fromIsa
        }

        if (remainingTax > 0) {
            const fromPension = Math.min(assetsByType.pension, remainingTax)
            assetsByType.pension -= fromPension
            remainingTax -= fromPension
        }

        if (remainingTax > 0) {
            const fromProperty = Math.min(assetsByType.property, remainingTax)
            assetsByType.property -= fromProperty
            remainingTax -= fromProperty
        }

        // Reinvest surplus after tax into ISA (tax-efficient)
        // const surplus = totalIncome - expenditure - taxPayable
        // if (surplus > 0) {
        //     assetsByType.isa += surplus
        // }
        return taxPayable
    }

    for (let age = currentAge; age <= maxAge; age++) {
        const year = birthYear + age
        const yearsFromNow = year - currentYear

        Object.keys(assetsByType).forEach(type => {
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

            const growth_category = getGrowthCategory(type as AssetType)
            const category_growth_rate_percent = data.assumptions.categoryGrowthRates[growth_category] || 0
            const growth_rate = category_growth_rate_percent / 100
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
                taxPayable = run_shortfall_calculation(
                    shortfall,
                    adjustedStatePension,
                    retirementIncome,
                    taxPayable,
                    totalIncome,
                    expenditure
                )
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

        console.log("summary at year=", year, age, currentAssets, assetsByType)
    }

    return {
        yearlyData,
        runsOutAt,
        totalNeeded: 0,
        currentAssets: data.assets.reduce((sum, asset) => sum + asset.value, 0)
    }
}
