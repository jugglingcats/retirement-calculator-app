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
import { useMemo, useState } from "react"
import { DrawdownStrategy, RetirementData } from "@/lib/types"

interface Props {
    data: RetirementData
    setData: (data: RetirementData) => void
}

export default function RetirementProjection({ data, setData }: Props) {
    const [strategy, setStrategy] = useState<DrawdownStrategy>("balanced")

    if (!data.personal.dateOfBirth || data.assets.length === 0) {
        return (
            <div className="p-8 bg-gray-100 rounded-lg text-center text-gray-600">
                Please complete the Personal Info, Assets, and Income Needs sections to see your retirement projection.
            </div>
        )
    }

    const updateBedAndISA = (enabled: boolean) => {
        setData({
            ...data,
            assumptions: {
                ...data.assumptions,
                bedAndISAEnabled: enabled
            }
        })
    }

    const updateInvestmentBalanceEnabled = (enabled: boolean) => {
        setData({
            ...data,
            assumptions: {
                ...data.assumptions,
                investmentBalanceEnabled: enabled
            }
        })
    }

    // Precompute projections for all strategies so the Y-axis can use a fixed scale
    const projections = useMemo(() => {
        return {
            balanced: calculateProjection(data, Infinity, "balanced"),
            lowest_growth_first: calculateProjection(data, Infinity, "lowest_growth_first"),
            tax_optimized: calculateProjection(data, Infinity, "tax_optimized")
        } as Record<DrawdownStrategy, ReturnType<typeof calculateProjection>>
    }, [data])

    // Use the currently selected strategy's results for most UI elements
    const { yearlyData, runsOutAt, currentAssets } = projections[strategy]

    // Compute the fixed Y-axis max as the largest total assets across all strategies and years
    const fixedYAxisMax = useMemo(() => {
        const maxFrom = (arr: typeof yearlyData) => (arr.length ? Math.max(...arr.map(d => d.assets || 0)) : 0)
        const m1 = maxFrom(projections.balanced.yearlyData)
        const m2 = maxFrom(projections.lowest_growth_first.yearlyData)
        const m3 = maxFrom(projections.tax_optimized.yearlyData)
        const max = Math.max(0, m1, m2, m3)
        // Add a small headroom to avoid clipping the top of the stacked areas
        return Math.ceil(max * 1.05)
    }, [projections, yearlyData])
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

    // Format currency to 5 significant figures with thousand separators
    const formatGBP = (value: number, sig = 5) => {
        if (!isFinite(value) || value === 0) return "£0"
        const sign = value < 0 ? "-" : ""
        const abs = Math.abs(value)
        const digits = Math.floor(Math.log10(abs)) + 1
        const scalePow = Math.max(0, digits - sig)
        const scale = Math.pow(10, scalePow)
        const rounded = Math.round(abs / scale) * scale
        return `£${sign}${Math.trunc(rounded).toLocaleString()}`
    }

    // Custom tooltip for the Asset Projection chart so we can include Total assets
    const AssetTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || payload.length === 0) return null
        const year: number = label
        const idx = yearlyData.findIndex(d => d.year === year)
        const prev = idx > 0 ? (yearlyData[idx - 1] as any) : null
        const curr = yearlyData[idx] as any

        const total = Number(curr?.assets || 0)
        const totalPrev = Number(prev?.assets || 0)
        const totalDelta = total - totalPrev
        const totalArrow = totalDelta > 0 ? "▲" : totalDelta < 0 ? "▼" : "•"
        const totalSign = totalDelta > 0 ? "+" : totalDelta < 0 ? "-" : ""
        const totalAbs = Math.abs(totalDelta)

        return (
            <div
                style={{
                    background: "white",
                    border: "2px solid #e5e7eb",
                    borderRadius: 8,
                    padding: 10,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                }}
            >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Year {year}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {payload.map((item: any) => {
                        const key = item?.dataKey as string
                        const name = item?.name as string
                        const color = item?.color as string
                        const currVal = Number(curr?.[key] || 0)
                        const prevVal = Number(prev?.[key] || 0)
                        const delta = currVal - prevVal
                        const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "•"
                        const sign = delta > 0 ? "+" : delta < 0 ? "-" : ""
                        const absDelta = Math.abs(delta)
                        return (
                            <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span
                                    style={{
                                        width: 10,
                                        height: 10,
                                        background: color,
                                        borderRadius: 2,
                                        display: "inline-block"
                                    }}
                                />
                                <span style={{ color: "#374151" }}>{name}</span>
                                <span style={{ marginLeft: "auto", color: "#111827" }}>
                                    {formatGBP(currVal)}{" "}
                                    <span style={{ color: "#6b7280" }}>
                                        ({arrow} {sign}
                                        {formatGBP(absDelta)})
                                    </span>
                                </span>
                            </div>
                        )
                    })}
                </div>
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb", display: "flex", gap: 8 }}>
                    <strong style={{ color: "#111827" }}>Total assets</strong>
                    <span style={{ marginLeft: "auto", color: "#111827" }}>
                        {formatGBP(total)}{" "}
                        <span style={{ color: "#6b7280" }}>
                            ({totalArrow} {totalSign}
                            {formatGBP(totalAbs)})
                        </span>
                    </span>
                </div>
            </div>
        )
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
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="bedAndISAProjection"
                                checked={data.assumptions.bedAndISAEnabled || false}
                                onChange={e => updateBedAndISA(e.target.checked)}
                                className="w-5 h-5 text-indigo-600 border-2 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <label htmlFor="bedAndISAProjection" className="text-sm text-gray-700">
                                Bed and ISA
                            </label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="investmentBalanceProjection"
                                checked={data.assumptions.investmentBalanceEnabled ?? true}
                                onChange={e => updateInvestmentBalanceEnabled(e.target.checked)}
                                className="w-5 h-5 text-indigo-600 border-2 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <label htmlFor="investmentBalanceProjection" className="text-sm text-gray-700">
                                Investment lifestyling
                            </label>
                        </div>
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
                        <defs>
                            {/* Hatch pattern for crystallised pension - same colour as pension but hatched */}
                            <pattern
                                id="pensionHatch"
                                patternUnits="userSpaceOnUse"
                                width="6"
                                height="6"
                                patternTransform="rotate(45)"
                            >
                                <rect width="6" height="6" fill="#a855f7" opacity="0.15" />
                                <line x1="0" y1="0" x2="0" y2="6" stroke="#a855f7" strokeWidth="2" opacity="0.6" />
                            </pattern>
                        </defs>
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
                            domain={[0, fixedYAxisMax]}
                        />
                        <Tooltip content={<AssetTooltip />} />
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
                            dataKey="stocks"
                            stackId="1"
                            stroke="#0ea5e9"
                            fill="#0ea5e9"
                            name="Stocks"
                        />
                        <Area
                            type="step"
                            alignmentBaseline="before-edge"
                            dataKey="isa"
                            stackId="1"
                            stroke="#1d4ed8"
                            fill="#1d4ed8"
                            name="ISAs"
                        />
                        <Area
                            type="step"
                            alignmentBaseline="before-edge"
                            dataKey="pensionCrystallised"
                            stackId="1"
                            stroke="#a855f7"
                            fill="url(#pensionHatch)"
                            name="Pension (crystallised)"
                        />
                        <Area
                            type="step"
                            alignmentBaseline="before-edge"
                            dataKey="pension"
                            stackId="1"
                            stroke="#a855f7"
                            fill="#a855f7"
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
                        <defs>
                            {/* Subtle hatch pattern to indicate unfavourable outflows without overpowering */}
                            <pattern
                                id="withdrawHatch"
                                patternUnits="userSpaceOnUse"
                                width="6"
                                height="6"
                                patternTransform="rotate(45)"
                            >
                                <rect width="6" height="6" fill="#9a3412" opacity="0.12" />
                                <line x1="0" y1="0" x2="0" y2="6" stroke="#9a3412" strokeWidth="2" opacity="0.45" />
                            </pattern>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="year" stroke="#6b7280" tick={{ fill: "#6b7280" }} />
                        <YAxis
                            stroke="#6b7280"
                            tick={{ fill: "#6b7280" }}
                            tickFormatter={value => `£${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                            labelFormatter={(label: any) => `Year ${label}`}
                            formatter={(value: number, name: string) => [formatGBP(Number(value || 0)), name || ""]}
                            contentStyle={{ background: "white", border: "2px solid #e5e7eb", borderRadius: "8px" }}
                        />
                        <Legend />
                        <Bar dataKey="statePension" stackId="income" fill="#34d399" name="State Pension" />
                        <Bar dataKey="retirementIncome" stackId="income" fill="#8b5cf6" name="Retirement Income" />
                        <Bar
                            dataKey="assetWithdrawals"
                            stackId="income"
                            fill="url(#withdrawHatch)"
                            stroke="#9a3412"
                            name="Asset Drawdown"
                        />
                        <Bar dataKey="shortfall" stackId="income" fill="#ef4444" name="Shortfall" />
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
