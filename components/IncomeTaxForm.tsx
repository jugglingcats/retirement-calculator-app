"use client"

import { RetirementData, TaxSettings } from "@/lib/types"

interface Props {
    data: RetirementData
    setData: (data: RetirementData) => void
}

export default function IncomeTaxForm({ data, setData }: Props) {
    const updateIncomeTax = (updates: Partial<TaxSettings>) => {
        setData({
            ...data,
            incomeTax: {
                ...data.incomeTax,
                ...updates
            }
        })
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">UK Income Tax Settings</h2>
                <p className="text-gray-600 mb-6">
                    Configure tax thresholds for optimal drawdown calculations. These values are used to calculate your
                    tax liability in retirement. By default, these thresholds increase at the same rate as inflation but
                    you can change this in the Assumptions tab.
                </p>
                <p className="text-gray-600 mb-6">
                    Your tax liability changes according to the drawdown strategy you select on the Projection tab and
                    whether you enabled Bed and ISA.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Personal Allowance (£)</label>
                    <input
                        type="number"
                        value={data.incomeTax.personalAllowance}
                        onChange={e => updateIncomeTax({ personalAllowance: Number(e.target.value) })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="12570"
                    />
                    <p className="text-sm text-gray-500 mt-1">Tax-free income allowance (2024/25: £12,570)</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Higher Rate Threshold (£)</label>
                    <input
                        type="number"
                        value={data.incomeTax.higherRateThreshold}
                        onChange={e => updateIncomeTax({ higherRateThreshold: Number(e.target.value) })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="50270"
                    />
                    <p className="text-sm text-gray-500 mt-1">Income above this is taxed at 40% (2024/25: £50,270)</p>
                </div>
            </div>
        </div>
    )
}
