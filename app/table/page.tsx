"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { calculateProjection } from "@/lib/calculations"
import { DrawdownStrategy } from "@/lib/types"
import YearlyBreakdownSection from "@/components/YearlyBreakdownSection"
import { useRetirementData } from "@/hooks/useRetirementData"
import { deflateProjection } from "@/lib/deflate"

const STRATEGY_STORAGE_KEY = "retirement-calculator-drawdown-strategy"
const VALID_STRATEGIES: DrawdownStrategy[] = ["balanced", "lowest_growth_first", "tax_optimized"]
const STRATEGY_LABELS: Record<DrawdownStrategy, string> = {
    balanced: "Balanced",
    lowest_growth_first: "Lowest growth first",
    tax_optimized: "Tax optimised"
}

/**
 * Standalone full-page yearly-breakdown table. Avoids the constrained `max-w-7xl` page
 * container so the very wide table can use the entire viewport width without being
 * clipped. Reads the same retirement data from localStorage that the main calculator
 * uses, so opening this route in another tab shows a live snapshot of saved data.
 */
export default function StandaloneTablePage() {
    const [data, , loaded] = useRetirementData()

    const [strategy, setStrategy] = useState<DrawdownStrategy>("balanced")
    useEffect(() => {
        try {
            const saved = window.localStorage.getItem(STRATEGY_STORAGE_KEY)
            if (saved && VALID_STRATEGIES.includes(saved as DrawdownStrategy)) {
                setStrategy(saved as DrawdownStrategy)
            }
        } catch (error) {
            console.error("Failed to read drawdown strategy from localStorage:", error)
        }
    }, [])
    useEffect(() => {
        try {
            window.localStorage.setItem(STRATEGY_STORAGE_KEY, strategy)
        } catch (error) {
            console.error("Failed to save drawdown strategy to localStorage:", error)
        }
    }, [strategy])

    const projection = useMemo(() => {
        if (!loaded || !data.personal.dateOfBirth || data.assets.length === 0) return null
        const raw = calculateProjection(data, Infinity, strategy)
        return data.assumptions.showInTodaysMoney ? deflateProjection(raw, data.assumptions.inflationRate || 0) : raw
    }, [data, strategy, loaded])

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Link href="/projection" className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline">
                        ← Back to calculator
                    </Link>
                    <h1 className="text-xl font-semibold text-gray-900">Yearly Breakdown — Standalone</h1>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    Drawdown strategy:
                    <select
                        value={strategy}
                        onChange={e => setStrategy(e.target.value as DrawdownStrategy)}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
                    >
                        {VALID_STRATEGIES.map(s => (
                            <option key={s} value={s}>
                                {STRATEGY_LABELS[s]}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {!loaded ? (
                <div className="p-8 bg-white rounded-lg text-center text-gray-600">Loading…</div>
            ) : !projection ? (
                <div className="p-8 bg-white rounded-lg text-center text-gray-600">
                    Please complete the Personal Info and Assets sections in the{" "}
                    <Link href="/" className="text-indigo-600 hover:underline">
                        calculator
                    </Link>{" "}
                    to see the projection table.
                </div>
            ) : (
                <YearlyBreakdownSection
                    data={data}
                    projection={projection}
                    containerClassName="p-6 bg-white border-2 border-gray-200 rounded-lg"
                />
            )}
        </div>
    )
}
