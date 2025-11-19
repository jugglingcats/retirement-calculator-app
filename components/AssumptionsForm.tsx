"use client"

import type { RetirementData } from "@/types"

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

    return (
        <div className="flex flex-col gap-8 max-w-4xl">
            <div className="p-6 bg-gray-50 rounded-lg border-2 border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Inflation Rate</h3>
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
                        Historical UK inflation average is around 2-3%. This affects your purchasing power over time.
                    </p>
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
