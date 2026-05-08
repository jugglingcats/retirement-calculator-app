export interface PersonalInfo {
    dateOfBirth: string
    spouseDateOfBirth: string
    retirementAge: number
    /**
     * Whether partner details (spouse date of birth and retirement age) should be
     * included in the projection. When false, the spouse-related fields are
     * ignored regardless of their stored values.
     */
    includePartner?: boolean
    /**
     * Desired retirement age for the partner. Defaults to {@link retirementAge}
     * when not specified.
     */
    spouseRetirementAge?: number
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
    baseCost?: number // Original cost basis for CGT calculation (applicable to stocks and bonds)
}

export interface IncomeNeed {
    id: string
    description: string
    annualAmount: number
    startingAge?: number // If empty, defaults to current age
}

export interface Assumptions {
    inflationRate: number
    // Annual percentage rate used to uprate income tax bands/allowances (can differ from inflation)
    taxBandIncreaseRate?: number
    categoryGrowthRates: Record<string, number>
    bedAndISAEnabled?: boolean
    // Annual ISA allowance per person (default £20000)
    annualISAAllowance?: number
    // Master toggle to enable/disable ISA investment balance glide path
    investmentBalanceEnabled?: boolean
    // Optional ISA investment balance glide path (equity/bond split over time)
    investmentBalance?: {
        initialEquityPercentage: number // e.g., 80 means 80% equity / 20% bonds at start
        targetEquityPercentage: number // e.g., 40 means 40% equity / 60% bonds at end
        yearsToTarget: number // number of years after retirement to reach the target mix
    }
    // Capital Gains Tax settings
    cgtAllowance?: number // Annual CGT allowance (default £3000)
    cgtRate?: number // CGT rate as percentage (default 18%)
    // When true, all displayed values (charts, tables, Excel export) are deflated
    // by the inflation rate so they are shown in today's money. The underlying
    // calculation is unchanged.
    showInTodaysMoney?: boolean
}

export interface MarketShock {
    id: string
    year: number
    impactPercent: number
    description?: string
    enabled?: boolean
}

export interface IncomeStream {
    id: string
    description: string
    annualAmount: number
    /**
     * Year the income stream begins. Optional; defaults to the current year when
     * not specified at projection time.
     */
    startYear?: number
    /** Optional explicit end year. Ignored when {@link endsAtRetirement} is true. */
    endYear?: number
    /**
     * When true the income stream ends automatically when the owner reaches their
     * retirement year. {@link endYear} is cleared in the UI in this case and the
     * effective end year is computed at projection time.
     */
    endsAtRetirement?: boolean
    enabled: boolean
    inflationAdjusted: boolean
    growthRate?: number // Optional custom growth rate (could be on top of inflation)
    /**
     * Optional cap on the annual income, expressed in today's money. When set,
     * the income for this stream cannot exceed this limit regardless of the
     * year, growth rate, or inflation adjustment. The cap itself rises with
     * inflation so it represents a constant amount in real (today's) terms.
     */
    limit?: number
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
    incomeStreams: IncomeStream[]
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

/**
 * A single human-readable audit entry produced by a drawdown strategy. Entries
 * are produced as the strategy makes decisions (sorting, choosing assets,
 * withdrawing, recomputing tax) and are surfaced in the UI so users can
 * inspect the reasoning behind each year's drawdown.
 */
export interface AuditEntry {
    /** High-level phase, e.g. "setup", "iteration", "withdrawal", "tax-update", "summary". */
    stage: string
    /** Human-readable message. */
    message: string
    /** Optional structured data for debugging. Not displayed prominently. */
    data?: Record<string, unknown>
}

/**
 * Single per-person view of one simulated year.
 *
 * `initialPosition` captures the per-person asset balances *after* start-of-year
 * carry-over, bed&ISA, growth, one-offs and market shocks have been applied —
 * i.e. the position the drawdown strategy sees. End-of-year balances are
 * intentionally not stored: they are derived as
 *   endPosition[t] = initialPosition[t] - withdrawals[t]
 * since cash spent on income tax and CGT is already reflected in
 * `withdrawals.cash`.
 */
export interface PoolYear {
    initialPosition: AssetPool
    income: {
        statePension: number
        // Non-state pension income (e.g. DB pensions, salary). Sourced from
        // the configured income streams.
        otherIncome: number
    }
    // Positive reductions only. `withdrawals.cash` includes cash spent on
    // income tax and CGT for this person.
    withdrawals: AssetPool
    // Income tax payable by this person.
    tax: number
    // Capital Gains Tax payable by this person.
    cgtPayable: number
}

/**
 * One simulated year of the household projection.
 *
 * The per-pool record is the single source of truth: household-level numbers
 * (combined balances, totals, etc.) are derived in `lib/yearlyView.ts` via
 * `householdYearly`. Index 0 is the primary ("me"), index 1 is the spouse and
 * is always present (an "empty" `PoolYear` when no spouse is configured).
 */
export type YearlyDatapoint = {
    year: number
    age: number
    pools: [PoolYear, PoolYear]
    // Household target spending for the year (after inflation).
    expenditure: number
    // Unmet expenditure for the year, when assets and income are insufficient.
    shortfall: number
    /**
     * Per-year audit log of drawdown strategy decisions. Populated only in years
     * where the drawdown strategy is invoked (i.e. when there is a shortfall).
     * Not persisted — purely for inspection in the UI.
     */
    audit?: AuditEntry[]
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
