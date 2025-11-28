"use client"

import {
    Area,
    AreaChart,
    Bar,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts"
import { calculateProjection } from "@/lib/calculations"
import type { DrawdownStrategy, RetirementData } from "@/types"
import { useState } from "react"

interface Props {
    data: RetirementData
}

export default function RetirementProjection({ data }: Props) {
    const [strategy, setStrategy] = useState<DrawdownStrategy>("balanced")

    if (!data.personal.dateOfBirth || data.assets.length === 0) {
        return (
            <div className="p-8 bg-gray-100 rounded-lg text-center text-gray-600">
                Please complete the Personal Info, Assets, and Income Needs sections to see your retirement projection.
            </div>
        )
    }

    const { yearlyData, runsOutAt, currentAssets } = calculateProjection(data, Infinity, strategy)
    const birthYear = new Date(data.personal.dateOfBirth).getFullYear()

    // Custom X-axis tick to render Year on first line and Age on second line
    const YearAgeTick = ({ x, y, payload }: { x: number; y: number; payload: { value: number } }) => {
        const year = payload.value
        const age = year - birthYear
        return (
            <g transform={`translate(${x},${y})`}>
                <text x={0} y={0} dy={0} textAnchor="middle" fill="#6b7280" fontSize={12}>
                    {year}
                </text>
                <text x={0} y={0} dy={14} textAnchor="middle" fill="#9ca3af" fontSize={11}>
                    Age {age}
                </text>
            </g>
        )
    }

    const getVariant = (): "success" | "warning" | "danger" => {
        if (!runsOutAt) return "success"
        const yearsRemaining = runsOutAt - new Date().getFullYear()
        if (yearsRemaining > 30) return "success"
        if (yearsRemaining > 15) return "warning"
        return "danger"
    }

    const variantColors = {
        success: "from-green-600 to-green-700",
        warning: "from-amber-500 to-amber-600",
        danger: "from-red-500 to-red-600"
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg text-white">
                    <div className="text-sm opacity-90 mb-2">Current Assets</div>
                    <div className="text-3xl font-bold">£{currentAssets.toLocaleString()}</div>
                </div>

                <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg text-white">
                    <div className="text-sm opacity-90 mb-2">Projected at Retirement</div>
                    <div className="text-3xl font-bold">
                        £
                        {Math.round(
                            yearlyData.find(d => d.age === data.personal.retirementAge)?.assets || 0
                        ).toLocaleString()}
                    </div>
                </div>

                {runsOutAt ? (
                    <div className={`p-6 bg-gradient-to-r ${variantColors[getVariant()]} rounded-lg text-white`}>
                        <div className="text-sm opacity-90 mb-2">Money Runs Out</div>
                        <div className="text-3xl font-bold">
                            Age {runsOutAt - new Date(data.personal.dateOfBirth).getFullYear()}
                        </div>
                    </div>
                ) : (
                    <div className="p-6 bg-gradient-to-r from-green-600 to-green-700 rounded-lg text-white">
                        <div className="text-sm opacity-90 mb-2">Projection Status</div>
                        <div className="text-3xl font-bold">Sustainable ✓</div>
                    </div>
                )}
            </div>

            {runsOutAt && (
                <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-lg text-amber-900">
                    <strong>Warning:</strong> Based on current projections, your funds may be depleted by year{" "}
                    {runsOutAt}. Consider adjusting your retirement age, reducing expenses, or increasing asset growth
                    rates.
                </div>
            )}

            <div className="p-6 bg-white border-2 border-gray-200 rounded-lg">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <h3 className="text-xl font-semibold text-gray-900">Asset Projection by Type</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">Drawdown Strategy:</span>
                        <div
                            className="inline-flex rounded-md shadow-sm border border-gray-200 overflow-hidden"
                            role="group"
                        >
                            <button
                                type="button"
                                className={`px-3 py-1.5 text-sm ${
                                    strategy === "balanced"
                                        ? "bg-indigo-600 text-white"
                                        : "bg-white text-gray-700 hover:bg-gray-50"
                                }`}
                                onClick={() => setStrategy("balanced")}
                                title="Withdraw proportionally from each asset class based on their relative sizes"
                            >
                                Balanced
                            </button>
                            <button
                                type="button"
                                className={`px-3 py-1.5 text-sm border-l border-gray-200 ${
                                    strategy === "lowest_growth_first"
                                        ? "bg-indigo-600 text-white"
                                        : "bg-white text-gray-700 hover:bg-gray-50"
                                }`}
                                onClick={() => setStrategy("lowest_growth_first")}
                                title="Draw from the asset class with the lowest growth rate first to preserve higher-growth assets"
                            >
                                Lowest growth first
                            </button>
                            <button
                                type="button"
                                className={`px-3 py-1.5 text-sm border-l border-gray-200 ${
                                    strategy === "tax_optimized"
                                        ? "bg-indigo-600 text-white"
                                        : "bg-white text-gray-700 hover:bg-gray-50"
                                }`}
                                onClick={() => setStrategy("tax_optimized")}
                                title="Draw from taxable assets up to the higher rate threshold, then use ISAs to avoid higher rate tax"
                            >
                                Tax optimised
                            </button>
                        </div>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={yearlyData} margin={{ top: 10, right: 20, left: 10, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="year"
                            stroke="#e5e7eb"
                            tick={(props: { x: number; y: number; payload: { value: number } }) => (
                                <YearAgeTick {...props} />
                            )}
                            tickMargin={14}
                            height={48}
                        />
                        <YAxis
                            stroke="#6b7280"
                            tick={{ fill: "#6b7280" }}
                            tickFormatter={value => `£${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                            labelFormatter={(label: any) => `Year ${label}`}
                            formatter={(value: number, name: string, item: any) => {
                                try {
                                    const dataKey: string | undefined = item?.dataKey
                                    const year: number | undefined = item?.payload?.year
                                    if (!dataKey || typeof year !== "number") {
                                        return [`£${Number(value || 0).toLocaleString()}`, name]
                                    }

                                    // Find current and previous data points by year
                                    // yearlyData is in closure scope
                                    const idx = yearlyData.findIndex(d => d.year === year)
                                    const prev = idx > 0 ? (yearlyData[idx - 1] as any) : null
                                    const curr = yearlyData[idx] as any
                                    const currVal = Number(curr?.[dataKey] || 0)
                                    const prevVal = Number(prev?.[dataKey] || 0)
                                    const delta = currVal - prevVal

                                    const sign = delta > 0 ? "+" : delta < 0 ? "-" : ""
                                    const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "•"
                                    const absDelta = Math.abs(delta)

                                    const valueText = `£${currVal.toLocaleString()}  (${arrow} ${sign}£${absDelta.toLocaleString()})`
                                    // Keep the asset type name visible as the second element
                                    return [valueText, name]
                                } catch {
                                    return [`£${Number(value || 0).toLocaleString()}`, name]
                                }
                            }}
                            contentStyle={{ background: "white", border: "2px solid #e5e7eb", borderRadius: "8px" }}
                        />
                        <Legend />
                        <Area
                            type="step"
                            alignmentBaseline="before-edge"
                            dataKey="cash"
                            stackId="1"
                            stroke="#10b981"
                            fill="#10b981"
                            name="Cash"
                        />
                        <Area
                            type="step"
                            alignmentBaseline="before-edge"
                            dataKey="isa"
                            stackId="1"
                            stroke="#6366f1"
                            fill="#6366f1"
                            name="ISA (Tax-Free)"
                        />
                        <Area
                            type="step"
                            alignmentBaseline="before-edge"
                            dataKey="pension"
                            stackId="1"
                            stroke="#8b5cf6"
                            fill="#8b5cf6"
                            name="Pension"
                        />
                        <Area
                            type="step"
                            alignmentBaseline="before-edge"
                            dataKey="property"
                            stackId="1"
                            stroke="#f59e0b"
                            fill="#f59e0b"
                            name="Property"
                        />
                    </AreaChart>
                </ResponsiveContainer>
                <p className="text-sm text-gray-600 mt-4">
                    {strategy === "tax_optimized" ? (
                        <>
                            <strong>Minimise higher-rate tax:</strong> Use ISA first up to the 40% threshold; then draw
                            taxable income in order Cash → Pension → Property.
                        </>
                    ) : (
                        <>
                            <strong>Lowest growth first:</strong> Draw from the asset class with the lowest assumed
                            growth rate first to preserve higher-growth assets.
                        </>
                    )}
                </p>
            </div>

            <div className="p-6 bg-white border-2 border-gray-200 rounded-lg">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Annual Income vs Expenditure</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={yearlyData} margin={{ top: 10, right: 20, left: 60, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="year" stroke="#6b7280" tick={{ fill: "#6b7280" }} />
                        <YAxis
                            stroke="#6b7280"
                            tick={{ fill: "#6b7280" }}
                            tickFormatter={value => `£${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                            labelFormatter={(label: any) => `Year ${label}`}
                            formatter={(value: number, name: string) => [
                                `£${Number(value || 0).toLocaleString()}`,
                                name || ""
                            ]}
                            contentStyle={{ background: "white", border: "2px solid #e5e7eb", borderRadius: "8px" }}
                        />
                        <Legend />
                        <Bar dataKey="statePension" stackId="income" fill="#34d399" name="State Pension" />
                        <Bar dataKey="retirementIncome" stackId="income" fill="#8b5cf6" name="Retirement Income" />
                        <Bar dataKey="assetWithdrawals" stackId="income" fill="#6366f1" name="Asset Withdrawals" />
                        <Line
                            type="monotone"
                            dataKey="expenditure"
                            stroke="#ef4444"
                            strokeWidth={2}
                            name="Expenditure"
                            dot={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="taxPayable"
                            stroke="#f97316"
                            strokeWidth={2}
                            name="Tax Payable"
                            dot={false}
                        />
                        <Line
                            type="monotone"
                            dataKey={(d: any) => (d.expenditure || 0) + (d.taxPayable || 0)}
                            stroke="#6b7280"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            name="Total (Exp + Tax)"
                            dot={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
