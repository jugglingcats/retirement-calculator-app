import { TaxSettings } from "@/lib/types"

export interface PersonalInfo {
    dateOfBirth: string
    spouseDateOfBirth: string
    retirementAge: number
}

export enum AssetType {
    Pension = "pension",
    PensionCrystallised = "pensionCrystallised",
    Cash = "cash",
    StocksAndShares = "stocks",
    ISA = "isa",
    Bonds = "bonds",
    Property = "property"
}

export interface Asset {
    id: string
    name: string
    value: number
    category: AssetType
    belongsToSpouse?: boolean
}

export interface IncomeNeed {
    id: string
    description: string
    annualAmount: number
    startingAge?: number // If empty, defaults to retirement age
}

export interface Assumptions {
    inflationRate: number
    categoryGrowthRates: Record<string, number>
    bedAndISAEnabled?: boolean
}

export interface MarketShock {
    id: string
    year: number
    impactPercent: number
    description?: string
}

export interface RetirementIncome {
    id: string
    description: string
    annualAmount: number
    startYear: number
    endYear?: number // Added optional ending year
    enabled: boolean
    inflationAdjusted: boolean
    growthRate?: number // Added optional custom growth rate (could be on top of inflation)
    belongsToSpouse?: boolean
}

export interface OneOff {
    id: string
    description: string
    amount: number // Can be negative for expenses
    age: number
    enabled: boolean
    belongsToSpouse?: boolean
}

export interface RetirementData {
    personal: PersonalInfo
    assets: Asset[]
    incomeNeeds: IncomeNeed[]
    retirementIncome: RetirementIncome[]
    assumptions: Assumptions
    incomeTax: TaxSettings // Added income tax settings
    shocks: MarketShock[]
    oneOffs: OneOff[]
}

// Strategy for funding shortfalls during retirement projections
export type DrawdownStrategy =
    | "tax_optimized" // Use ISA to avoid higher-rate band, then taxable in fixed order
    | "lowest_growth_first" // Draw from the lowest expected growth asset first
    | "balanced" // Spread withdrawals evenly across all assets
