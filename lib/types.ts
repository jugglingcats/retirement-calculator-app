import { AssetType } from "@/types"

export type AssetBalances = Record<AssetType, number>
export type DrawdownStrategyType = "balanced" | "lowest_growth_first" | "tax_optimized"

export interface TaxSettings {
    personalAllowance: number
    higherRateThreshold: number
}

export interface PersonIncomeData {
    statePension: number
    retirementIncome: number
}

export interface SplitShortfallResult {
    primaryTax: number
    spouseTax: number
    primaryWithdrawn: number
    spouseWithdrawn: number
}

export interface AssetDrawdownResult {
    remaining: number
    taxableWithdrawn: number
}
export type YearlyDatapoint = {
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
    assetWithdrawals: number
}
export type ProjectionResult = {
    yearlyData: YearlyDatapoint[]
    runsOutAt: number
    totalNeeded: number
    currentAssets: number
}
