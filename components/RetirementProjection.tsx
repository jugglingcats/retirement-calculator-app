"use client"

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    AreaChart
} from "recharts"
import { calculateProjection } from "@/lib/calculations"
import type { RetirementData } from "@/types"

interface Props {
    data: RetirementData
}

export default function RetirementProjection({ data }: Props) {
    const projection = calculateProjection(data)

    if (!projection) {
        return (
            <div className="p-8 bg-gray-100 rounded-lg text-center text-gray-600">
                Please complete the Personal Info, Assets, and Income Needs sections to see your retirement projection.
            </div>
        )
    }

    const { yearlyData, runsOutAt, currentAssets } = projection

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
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    Asset Projection by Type (Intelligent Drawdown)
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={yearlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="year" stroke="#6b7280" tick={{ fill: "#6b7280" }} />
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
                        <Area type="monotone" dataKey="cash" stackId="1" stroke="#10b981" fill="#10b981" name="Cash" />
                        <Area
                            type="monotone"
                            dataKey="isa"
                            stackId="1"
                            stroke="#6366f1"
                            fill="#6366f1"
                            name="ISA (Tax-Free)"
                        />
                        <Area
                            type="monotone"
                            dataKey="pension"
                            stackId="1"
                            stroke="#8b5cf6"
                            fill="#8b5cf6"
                            name="Pension"
                        />
                        <Area
                            type="monotone"
                            dataKey="property"
                            stackId="1"
                            stroke="#f59e0b"
                            fill="#f59e0b"
                            name="Property"
                        />
                    </AreaChart>
                </ResponsiveContainer>
                <p className="text-sm text-gray-600 mt-4">
                    <strong>Intelligent Drawdown:</strong> Cash withdrawn first → ISA used to avoid higher rate tax
                    (40%) → Pension → Property (least liquid)
                </p>
            </div>

            <div className="p-6 bg-white border-2 border-gray-200 rounded-lg">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Annual Income vs Expenditure</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={yearlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="year" stroke="#6b7280" tick={{ fill: "#6b7280" }} />
                        <YAxis
                            stroke="#6b7280"
                            tick={{ fill: "#6b7280" }}
                            tickFormatter={value => `£${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                            formatter={(value: number) => [`£${value.toLocaleString()}`, ""]}
                            contentStyle={{ background: "white", border: "2px solid #e5e7eb", borderRadius: "8px" }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} name="Total Income" />
                        <Line
                            type="monotone"
                            dataKey="retirementIncome"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            name="Retirement Income"
                            dot={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="statePension"
                            stroke="#34d399"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            name="State Pension"
                            dot={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="expenditure"
                            stroke="#ef4444"
                            strokeWidth={2}
                            name="Expenditure"
                        />
                        <Line
                            type="monotone"
                            dataKey="taxPayable"
                            stroke="#f97316"
                            strokeWidth={2}
                            strokeDasharray="3 3"
                            name="Tax Payable"
                            dot={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
