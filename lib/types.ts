import { AssetType } from "@/types"

export type AssetPool = Record<AssetType, number>
export type DrawdownStrategyType = "balanced" | "lowest_growth_first" | "tax_optimized"

export interface TaxSettings {
    personalAllowance: number
    higherRateThreshold: number
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
    stocks: number
    isa: number
    pension: number
    pensionCrystallised: number
    property: number
    income: number
    expenditure: number
    statePension: number
    retirementIncome: number
    taxPayable: number
    assetWithdrawals: number
    shortfall?: number
}
export type ProjectionResult = {
    yearlyData: YearlyDatapoint[]
    runsOutAt: number
    totalNeeded: number
    currentAssets: number
}
export type TaxPosition = {
    personalAllowanceRemaining: number
    basicRateRemaining: number
    tax: number
}
export enum AssetPoolType {
    PRIMARY = 0,
    SPOUSE = 1
}
