"use client"

import { useState } from "react"
import { RetirementData, RetirementIncome } from "@/lib/types"

interface Props {
    data: RetirementData
    setData: (data: RetirementData) => void
}

export default function RetirementIncomeForm({ data, setData }: Props) {
    const [newIncome, setNewIncome] = useState<RetirementIncome>({
        id: "",
        description: "",
        annualAmount: 0,
        startYear: new Date().getFullYear(),
        endYear: undefined,
        enabled: true,
        inflationAdjusted: true,
        growthRate: undefined,
        belongsToSpouse: false
    })

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingData, setEditingData] = useState<RetirementIncome | null>(null)

    const addIncome = (e: React.FormEvent) => {
        e.preventDefault()
        if (newIncome.description && newIncome.annualAmount > 0) {
            setData({
                ...data,
                retirementIncome: [...data.retirementIncome, { ...newIncome, id: Date.now().toString() }]
            })
            setNewIncome({
                id: "",
                description: "",
                annualAmount: 0,
                startYear: new Date().getFullYear(),
                endYear: undefined,
                enabled: true,
                inflationAdjusted: true,
                growthRate: undefined,
                belongsToSpouse: false
            })
        }
    }

    const toggleEnabled = (id: string) => {
        setData({
            ...data,
            retirementIncome: data.retirementIncome.map(income =>
                income.id === id ? { ...income, enabled: !income.enabled } : income
            )
        })
    }

    const toggleInflation = (id: string) => {
        setData({
            ...data,
            retirementIncome: data.retirementIncome.map(income =>
                income.id === id ? { ...income, inflationAdjusted: !income.inflationAdjusted } : income
            )
        })
    }

    const updateIncome = (id: string, field: keyof RetirementIncome, value: any) => {
        setData({
            ...data,
            retirementIncome: data.retirementIncome.map(income =>
                income.id === id ? { ...income, [field]: value } : income
            )
        })
    }

    const deleteIncome = (id: string) => {
        setData({
            ...data,
            retirementIncome: data.retirementIncome.filter(income => income.id !== id)
        })
    }

    const startEditing = (income: RetirementIncome) => {
        setEditingId(income.id)
        setEditingData({ ...income })
    }

    const cancelEditing = () => {
        setEditingId(null)
        setEditingData(null)
    }

    const saveEditing = () => {
        if (editingData) {
            setData({
                ...data,
                retirementIncome: data.retirementIncome.map(income => (income.id === editingId ? editingData : income))
            })
            setEditingId(null)
            setEditingData(null)
        }
    }

    return (
        <div className="flex flex-col gap-8">
            <p className="text-gray-600 text-sm">
                Define benefit pensions, annuities, and other guaranteed income sources. Enter the annual amount in
                today&apos;s money and specify when it starts. You can choose whether each income should increase with
                inflation or use a custom growth rate. You can also estimate the year when the income will end.
            </p>

            <form
                onSubmit={addIncome}
                className="grid grid-cols-1 md:grid-cols-6 gap-4 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
            >
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Description</label>
                    <input
                        type="text"
                        placeholder="e.g., Company Pension"
                        value={newIncome.description}
                        onChange={e => setNewIncome({ ...newIncome, description: e.target.value })}
                        required
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Annual Amount (£)</label>
                    <input
                        type="number"
                        placeholder="25000"
                        value={newIncome.annualAmount || ""}
                        onChange={e => setNewIncome({ ...newIncome, annualAmount: parseFloat(e.target.value) || 0 })}
                        required
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Starting Year</label>
                    <input
                        type="number"
                        placeholder="2030"
                        value={newIncome.startYear || ""}
                        onChange={e =>
                            setNewIncome({
                                ...newIncome,
                                startYear: parseInt(e.target.value) || new Date().getFullYear()
                            })
                        }
                        required
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Ending Year (optional)</label>
                    <input
                        type="number"
                        placeholder="Never ends"
                        value={newIncome.endYear || ""}
                        onChange={e =>
                            setNewIncome({
                                ...newIncome,
                                endYear: e.target.value ? parseInt(e.target.value) : undefined
                            })
                        }
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Growth Rate (%) (optional)</label>
                    <input
                        type="number"
                        placeholder="Use inflation"
                        value={newIncome.growthRate ?? ""}
                        onChange={e =>
                            setNewIncome({
                                ...newIncome,
                                growthRate: e.target.value ? parseFloat(e.target.value) : undefined
                            })
                        }
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        step="0.1"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Inflation Adjusted</label>
                    <div className="flex items-center h-full">
                        <input
                            type="checkbox"
                            checked={newIncome.inflationAdjusted}
                            onChange={e => setNewIncome({ ...newIncome, inflationAdjusted: e.target.checked })}
                            className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-sm text-gray-600">Rises with inflation</span>
                    </div>
                </div>

                <div className="md:col-span-6 flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="newIncomeBelongsToSpouse"
                        checked={newIncome.belongsToSpouse || false}
                        onChange={e => setNewIncome({ ...newIncome, belongsToSpouse: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="newIncomeBelongsToSpouse" className="text-sm font-medium text-gray-700">
                        Belongs to partner
                    </label>
                </div>

                <button
                    type="submit"
                    className="md:col-span-6 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:-translate-y-0.5 transition-transform"
                >
                    Add Retirement Income
                </button>
            </form>

            {data.retirementIncome.length > 0 && (
                <div className="flex flex-col gap-4">
                    {data.retirementIncome.map(income => {
                        const isEditing = editingId === income.id
                        const displayData = isEditing ? editingData! : income

                        return (
                            <div
                                key={income.id}
                                className={`p-6 border-2 rounded-lg transition-all ${
                                    income.enabled
                                        ? "bg-white border-gray-200 hover:border-indigo-500"
                                        : "bg-gray-50 border-gray-300 opacity-60"
                                }`}
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <input
                                        type="checkbox"
                                        checked={income.enabled}
                                        onChange={() => toggleEnabled(income.id)}
                                        disabled={isEditing}
                                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                                    />
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={displayData.description}
                                            onChange={e =>
                                                setEditingData({ ...editingData!, description: e.target.value })
                                            }
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        />
                                    ) : (
                                        <div className="flex-1 font-semibold text-gray-900">
                                            {displayData.description}
                                        </div>
                                    )}
                                </div>

                                {isEditing ? (
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium text-gray-700">
                                                Annual Amount (£)
                                            </label>
                                            <input
                                                type="number"
                                                value={displayData.annualAmount}
                                                onChange={e =>
                                                    setEditingData({
                                                        ...editingData!,
                                                        annualAmount: parseFloat(e.target.value) || 0
                                                    })
                                                }
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium text-gray-700">Starting Year</label>
                                            <input
                                                type="number"
                                                value={displayData.startYear}
                                                onChange={e =>
                                                    setEditingData({
                                                        ...editingData!,
                                                        startYear: parseInt(e.target.value) || new Date().getFullYear()
                                                    })
                                                }
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium text-gray-700">Ending Year</label>
                                            <input
                                                type="number"
                                                placeholder="Never ends"
                                                value={displayData.endYear || ""}
                                                onChange={e =>
                                                    setEditingData({
                                                        ...editingData!,
                                                        endYear: e.target.value ? parseInt(e.target.value) : undefined
                                                    })
                                                }
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium text-gray-700">Growth Rate (%)</label>
                                            <input
                                                type="number"
                                                placeholder="Use inflation"
                                                value={displayData.growthRate ?? ""}
                                                onChange={e =>
                                                    setEditingData({
                                                        ...editingData!,
                                                        growthRate: e.target.value
                                                            ? parseFloat(e.target.value)
                                                            : undefined
                                                    })
                                                }
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                step="0.1"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium text-gray-700">
                                                Inflation Adjusted
                                            </label>
                                            <div className="flex items-center h-full">
                                                <input
                                                    type="checkbox"
                                                    checked={displayData.inflationAdjusted}
                                                    onChange={e =>
                                                        setEditingData({
                                                            ...editingData!,
                                                            inflationAdjusted: e.target.checked
                                                        })
                                                    }
                                                    className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="md:col-span-5 flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id={`editIncomeBelongsToSpouse-${income.id}`}
                                                checked={displayData.belongsToSpouse || false}
                                                onChange={e =>
                                                    setEditingData({
                                                        ...editingData!,
                                                        belongsToSpouse: e.target.checked
                                                    })
                                                }
                                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                            />
                                            <label
                                                htmlFor={`editIncomeBelongsToSpouse-${income.id}`}
                                                className="text-sm font-medium text-gray-700"
                                            >
                                                Belongs to partner
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Annual Amount</label>
                                            <div className="font-semibold text-gray-900">
                                                £{displayData.annualAmount.toLocaleString()}/year
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Period</label>
                                            <div className="text-sm text-gray-700">
                                                {displayData.startYear} - {displayData.endYear || "Ongoing"}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Growth Rate</label>
                                            <div className="text-sm text-gray-700">
                                                {displayData.growthRate !== undefined
                                                    ? `${displayData.growthRate}% p.a.`
                                                    : "Uses inflation"}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Inflation</label>
                                            <div className="text-sm text-gray-700">
                                                {displayData.inflationAdjusted ? "Adjusted" : "Fixed"}
                                            </div>
                                        </div>
                                        <div>
                                            {displayData.belongsToSpouse && (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                    Spouse
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    {isEditing ? (
                                        <>
                                            <button
                                                onClick={saveEditing}
                                                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors font-semibold text-sm"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={cancelEditing}
                                                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors font-semibold text-sm"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => startEditing(income)}
                                                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-semibold text-sm"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => deleteIncome(income.id)}
                                                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors font-semibold text-sm"
                                            >
                                                Delete
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">About Retirement Income</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Enter defined benefit pensions, annuities, or other guaranteed income</li>
                    <li>• Amounts are in today&apos;s money</li>
                    <li>• Set a custom growth rate or use inflation adjustment</li>
                    <li>• Specify an ending year if the income will cease (e.g., term annuities)</li>
                    <li>• Use the checkbox to enable/disable income sources in your calculations</li>
                    <li>• UK State Pension is calculated separately based on your personal info</li>
                </ul>
            </div>
        </div>
    )
}
