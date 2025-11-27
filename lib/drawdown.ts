import { AssetType } from "@/types"

export type DrawdownStrategy = "lowest_growth_first" | "balanced"

export type AssetBalances = Record<AssetType, number>

/**
 * Performs drawdown from assets to meet a shortfall amount.
 * Modifies the assets object in place and returns the total amount withdrawn.
 */
export function performDrawdown(
    assets: AssetBalances,
    amount: number,
    growthRates: Record<AssetType, number>,
    strategy: DrawdownStrategy
): number {
    if (amount <= 0) return 0

    let remaining = amount

    if (strategy === "balanced") {
        remaining = drawdownBalanced(assets, remaining)
    } else if (strategy === "lowest_growth_first") {
        remaining = drawdownLowestGrowthFirst(assets, remaining, growthRates)
    }

    return amount - remaining
}

/**
 * Balanced strategy: withdraw proportionally from each asset class
 * based on their relative sizes.
 */
function drawdownBalanced(assets: AssetBalances, amount: number): number {
    const assetTypes = Object.values(AssetType)
    const totalAssets = assetTypes.reduce((sum, type) => sum + Math.max(0, assets[type]), 0)

    if (totalAssets <= 0) return amount

    let remaining = amount

    // Calculate proportional withdrawals
    const withdrawals: Record<AssetType, number> = {} as Record<AssetType, number>

    for (const type of assetTypes) {
        const balance = Math.max(0, assets[type])
        if (balance > 0) {
            const proportion = balance / totalAssets
            const targetWithdrawal = amount * proportion
            withdrawals[type] = Math.min(targetWithdrawal, balance)
        } else {
            withdrawals[type] = 0
        }
    }

    // Apply withdrawals
    for (const type of assetTypes) {
        const withdrawal = withdrawals[type]
        assets[type] -= withdrawal
        remaining -= withdrawal
    }

    // If there's still remaining (due to rounding or insufficient proportional funds),
    // take from whatever is available
    if (remaining > 0.01) {
        for (const type of assetTypes) {
            if (remaining <= 0) break
            const available = Math.max(0, assets[type])
            const withdrawal = Math.min(remaining, available)
            assets[type] -= withdrawal
            remaining -= withdrawal
        }
    }

    return Math.max(0, remaining)
}

/**
 * Lowest growth first strategy: withdraw from assets with the lowest
 * growth rate first, before moving to higher growth rate assets.
 */
function drawdownLowestGrowthFirst(
    assets: AssetBalances,
    amount: number,
    growthRates: Record<AssetType, number>
): number {
    const assetTypes = Object.values(AssetType)

    // Sort asset types by growth rate (ascending)
    const sortedTypes = assetTypes
        .filter(type => assets[type] > 0)
        .sort((a, b) => (growthRates[a] || 0) - (growthRates[b] || 0))

    let remaining = amount

    for (const type of sortedTypes) {
        if (remaining <= 0) break
        const available = Math.max(0, assets[type])
        const withdrawal = Math.min(remaining, available)
        assets[type] -= withdrawal
        remaining -= withdrawal
    }

    return Math.max(0, remaining)
}
