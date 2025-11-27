export interface PersonalInfo {
    dateOfBirth: string
    spouseDateOfBirth: string
    retirementAge: number
}

export enum AssetType {
    Pension = "pension",
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
}

export interface IncomeTax {
    personalAllowance: number
    higherRateThreshold: number
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
    growthRate?: number // Added optional custom growth rate
}

export interface OneOff {
    id: string
    description: string
    amount: number // Can be negative for expenses
    age: number
    enabled: boolean
}

export interface RetirementData {
    personal: PersonalInfo
    assets: Asset[]
    incomeNeeds: IncomeNeed[]
    retirementIncome: RetirementIncome[]
    assumptions: Assumptions
    incomeTax: IncomeTax // Added income tax settings
    shocks: MarketShock[]
    oneOffs: OneOff[]
}

// Strategy for funding shortfalls during retirement projections
export type WithdrawalStrategy =
    | "tax_optimized" // Use ISA to avoid higher-rate band, then taxable in fixed order
    | "lowest_growth_first" // Draw from the lowest expected growth asset first
    | "balanced" // Spread withdrawals evenly across all assets
