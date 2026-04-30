"use client"

import { RetirementData } from "@/lib/types"
import { NumericInput } from "@/components/ui/numeric-input"

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

    const updateAnnualISAAllowance = (value: number | undefined) => {
        setData({
            ...data,
            assumptions: {
                ...data.assumptions,
                annualISAAllowance: value
            }
        })
    }

    const updateCGTAllowance = (value: number | undefined) => {
        setData({
            ...data,
            assumptions: {
                ...data.assumptions,
                cgtAllowance: value
            }
        })
    }

    const updateCGTRate = (value: number | undefined) => {
        setData({
            ...data,
            assumptions: {
                ...data.assumptions,
                cgtRate: value
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
                    When enabled, the projection will simulate the Bed and ISA process. Each year, up to the annual ISA
                    allowance per person is moved into the ISA — first by transferring taxable stocks (within the CGT
                    allowance, gifting between spouses where helpful), then from age 55 by crystallising pension to take
                    the 25% tax-free lump sum.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="flex flex-col gap-2">
                        <label className="font-semibold text-gray-700">Annual ISA Allowance per person (£)</label>
                        <input
                            type="number"
                            step="100"
                            min={0}
                            placeholder="20000"
                            value={data.assumptions.annualISAAllowance ?? ""}
                            onChange={e =>
                                updateAnnualISAAllowance(e.target.value === "" ? undefined : parseFloat(e.target.value))
                            }
                            className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        <p className="text-sm text-gray-500">
                            Maximum amount each person can move into their ISA per tax year. Default is £20,000.
                        </p>
                    </div>
                </div>
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
                        <NumericInput
                            integer
                            min={0}
                            value={data.assumptions.investmentBalance?.yearsToTarget ?? null}
                            onChange={v => updateInvestmentBalance("yearsToTarget", v)}
                            disabled={!(data.assumptions.investmentBalanceEnabled ?? true)}
                            className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>
                </div>
            </div>

            <div className="p-6 bg-gray-50 rounded-lg border-2 border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Capital Gains Tax</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Configure Capital Gains Tax settings for stocks and bonds withdrawals.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="font-semibold text-gray-700">Annual CGT Allowance (£)</label>
                        <input
                            type="number"
                            step="100"
                            min={0}
                            placeholder="3000"
                            value={data.assumptions.cgtAllowance ?? ""}
                            onChange={e =>
                                updateCGTAllowance(e.target.value === "" ? undefined : parseFloat(e.target.value))
                            }
                            className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        <p className="text-sm text-gray-500">
                            Tax-free allowance for capital gains each year. Default is £3,000.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="font-semibold text-gray-700">CGT Rate (%)</label>
                        <input
                            type="number"
                            step="1"
                            min={0}
                            max={100}
                            placeholder="18"
                            value={data.assumptions.cgtRate ?? ""}
                            onChange={e =>
                                updateCGTRate(e.target.value === "" ? undefined : parseFloat(e.target.value))
                            }
                            className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        <p className="text-sm text-gray-500">
                            Tax rate applied to gains above the allowance. Default is 18%.
                        </p>
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
