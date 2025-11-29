"use client"

import { RetirementData } from "@/lib/types"

interface Props {
    data: RetirementData
    setData: (data: RetirementData) => void
}

export default function AssumptionsForm({ data, setData }: Props) {
    const categories = ["pension", "stocks", "property", "bonds", "cash", "other"]

    const updateInflation = (value: number) => {
        setData({
            ...data,
            assumptions: {
                ...data.assumptions,
                inflationRate: value
            }
        })
    }

    const updateTaxBandIncreaseRate = (value: number | undefined) => {
        setData({
            ...data,
            assumptions: {
                ...data.assumptions,
                taxBandIncreaseRate: value
            }
        })
    }

    const updateCategoryRate = (category: string, rate: number) => {
        setData({
            ...data,
            assumptions: {
                ...data.assumptions,
                categoryGrowthRates: {
                    ...data.assumptions.categoryGrowthRates,
                    [category]: rate
                }
            }
        })
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

    const updateInvestmentBalance = (
        field: "initialEquityPercentage" | "targetEquityPercentage" | "yearsToTarget",
        value: number
    ) => {
        setData({
            ...data,
            assumptions: {
                ...data.assumptions,
                investmentBalance: {
                    initialEquityPercentage: data.assumptions.investmentBalance?.initialEquityPercentage ?? 80,
                    targetEquityPercentage: data.assumptions.investmentBalance?.targetEquityPercentage ?? 50,
                    yearsToTarget: data.assumptions.investmentBalance?.yearsToTarget ?? 30,
                    [field]: value
                }
            }
        })
    }

    return (
        <div className="flex flex-col gap-8 max-w-4xl">
            <div className="p-6 bg-gray-50 rounded-lg border-2 border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Inflation Rate</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="font-semibold text-gray-700">Assumed Annual Inflation Rate (%)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={data.assumptions.inflationRate}
                            onChange={e => updateInflation(parseFloat(e.target.value) || 0)}
                            className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        <p className="text-sm text-gray-500">
                            Historical UK inflation average is around 2-3%. This affects your purchasing power over
                            time.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="font-semibold text-gray-700">Tax Band Increase Rate (%)</label>
                        <input
                            type="number"
                            step="0.1"
                            placeholder={`${data.assumptions.inflationRate}`}
                            value={
                                typeof data.assumptions.taxBandIncreaseRate === "number"
                                    ? data.assumptions.taxBandIncreaseRate
                                    : ""
                            }
                            onChange={e =>
                                updateTaxBandIncreaseRate(
                                    e.target.value === "" ? undefined : parseFloat(e.target.value)
                                )
                            }
                            className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        <p className="text-sm text-gray-500">
                            How quickly the personal allowance and higher-rate threshold increase each year. Leave blank
                            to match the inflation rate.
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-gray-50 rounded-lg border-2 border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Growth Rate Assumptions</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Set expected annual growth rates for each asset category. These are real returns (above inflation).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map(category => (
                        <div key={category} className="flex flex-col gap-2">
                            <label className="font-semibold text-gray-700 capitalize">{category} (%)</label>
                            <input
                                type="number"
                                step="0.1"
                                placeholder="5.0"
                                value={data.assumptions.categoryGrowthRates[category] || ""}
                                onChange={e => updateCategoryRate(category, parseFloat(e.target.value) || 0)}
                                className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-6 bg-gray-50 rounded-lg border-2 border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Bed and ISA</h3>
                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="bedAndISA"
                        checked={data.assumptions.bedAndISAEnabled || false}
                        onChange={e => updateBedAndISA(e.target.checked)}
                        className="w-5 h-5 text-indigo-600 border-2 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="bedAndISA" className="font-semibold text-gray-700">
                        Enable Bed and ISA
                    </label>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                    When enabled, the projection will simulate the Bed and ISA process from age 55. Each year, up to
                    £20,000 per person is transferred tax-free from pension to ISA (25% of £80,000 crystallised).
                </p>
            </div>

            <div className="p-6 bg-gray-50 rounded-lg border-2 border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Investment lifestyling</h3>
                <div className="flex items-center gap-3 mb-3">
                    <input
                        type="checkbox"
                        id="investmentBalanceEnabled"
                        checked={data.assumptions.investmentBalanceEnabled ?? true}
                        onChange={e => updateInvestmentBalanceEnabled(e.target.checked)}
                        className="w-5 h-5 text-indigo-600 border-2 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="investmentBalanceEnabled" className="font-semibold text-gray-700">
                        Enable investment lifestyling (ISA equity/bond glide path)
                    </label>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                    Configure how ISA investments shift from equities to bonds after retirement.
                </p>
                {!(data.assumptions.investmentBalanceEnabled ?? true) && (
                    <p className="text-sm text-gray-500 mb-2">
                        Disabled — ISA will use the Stocks growth rate without blending.
                    </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="font-semibold text-gray-700">Initial equity percentage (%)</label>
                        <input
                            type="number"
                            step="1"
                            min={0}
                            max={100}
                            value={data.assumptions.investmentBalance?.initialEquityPercentage ?? ""}
                            onChange={e =>
                                updateInvestmentBalance("initialEquityPercentage", parseFloat(e.target.value) || 0)
                            }
                            disabled={!(data.assumptions.investmentBalanceEnabled ?? true)}
                            className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="font-semibold text-gray-700">Target equity percentage (%)</label>
                        <input
                            type="number"
                            step="1"
                            min={0}
                            max={100}
                            value={data.assumptions.investmentBalance?.targetEquityPercentage ?? ""}
                            onChange={e =>
                                updateInvestmentBalance("targetEquityPercentage", parseFloat(e.target.value) || 0)
                            }
                            disabled={!(data.assumptions.investmentBalanceEnabled ?? true)}
                            className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="font-semibold text-gray-700">Years to target</label>
                        <input
                            type="number"
                            step="1"
                            min={0}
                            value={data.assumptions.investmentBalance?.yearsToTarget ?? ""}
                            onChange={e => updateInvestmentBalance("yearsToTarget", parseInt(e.target.value) || 0)}
                            disabled={!(data.assumptions.investmentBalanceEnabled ?? true)}
                            className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>
                </div>
            </div>

            <div className="p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Recommended Rates</h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                    <strong>Conservative estimates:</strong>
                    <br />
                    Pension: 4-5% | Stocks: 6-8% | Property: 3-4% | Bonds: 2-3% | Cash: 0-1%
                </p>
            </div>
        </div>
    )
}
