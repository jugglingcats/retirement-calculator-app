"use client"

import { useState } from "react"
import { IncomeStream, RetirementData } from "@/lib/types"
import { NumericInput } from "@/components/ui/numeric-input"

interface Props {
    data: RetirementData
    setData: (data: RetirementData) => void
}

const emptyIncome = (): IncomeStream => ({
    id: "",
    description: "",
    annualAmount: 0,
    startYear: undefined,
    endYear: undefined,
    endsAtRetirement: false,
    enabled: true,
    inflationAdjusted: true,
    growthRate: undefined,
    belongsToSpouse: false
})

export default function IncomeForm({ data, setData }: Props) {
    const [newIncome, setNewIncome] = useState<IncomeStream>(emptyIncome())

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingData, setEditingData] = useState<IncomeStream | null>(null)

    const currentYear = new Date().getFullYear()

    const addIncome = (e: React.FormEvent) => {
        e.preventDefault()
        if (newIncome.description && newIncome.annualAmount > 0) {
            setData({
                ...data,
                incomeStreams: [...data.incomeStreams, { ...newIncome, id: Date.now().toString() }]
            })
            setNewIncome(emptyIncome())
        }
    }

    const toggleEnabled = (id: string) => {
        setData({
            ...data,
            incomeStreams: data.incomeStreams.map(income =>
                income.id === id ? { ...income, enabled: !income.enabled } : income
            )
        })
    }

    const deleteIncome = (id: string) => {
        setData({
            ...data,
            incomeStreams: data.incomeStreams.filter(income => income.id !== id)
        })
    }

    const startEditing = (income: IncomeStream) => {
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
                incomeStreams: data.incomeStreams.map(income => (income.id === editingId ? editingData : income))
            })
            setEditingId(null)
            setEditingData(null)
        }
    }

    return (
        <div className="flex flex-col gap-8">
            <p className="text-gray-600 text-sm">
                Define income streams across your working life and retirement: salaries, defined-benefit pensions,
                annuities, rental income, and so on. Enter the annual amount in today&apos;s money. Starting year is
                optional and defaults to the current year. Tick &quot;Ends at retirement&quot; for pre-retirement income
                (e.g. salary) — its end year is computed automatically from the retirement year.
            </p>

            <form
                onSubmit={addIncome}
                className="grid grid-cols-1 md:grid-cols-6 gap-4 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
            >
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Description</label>
                    <input
                        type="text"
                        placeholder="e.g., Salary, Company Pension"
                        value={newIncome.description}
                        onChange={e => setNewIncome({ ...newIncome, description: e.target.value })}
                        required
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Annual Amount (£)</label>
                    <NumericInput
                        placeholder="25000"
                        value={newIncome.annualAmount || null}
                        onChange={v => setNewIncome({ ...newIncome, annualAmount: v })}
                        required
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Starting Year (optional)</label>
                    <input
                        type="number"
                        placeholder={`${currentYear}`}
                        value={newIncome.startYear ?? ""}
                        onChange={e =>
                            setNewIncome({
                                ...newIncome,
                                startYear: e.target.value ? parseInt(e.target.value) : undefined
                            })
                        }
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Ending Year (optional)</label>
                    <input
                        type="number"
                        placeholder={newIncome.endsAtRetirement ? "At retirement" : "Never ends"}
                        value={newIncome.endsAtRetirement ? "" : newIncome.endYear ?? ""}
                        disabled={newIncome.endsAtRetirement}
                        onChange={e =>
                            setNewIncome({
                                ...newIncome,
                                endYear: e.target.value ? parseInt(e.target.value) : undefined
                            })
                        }
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
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

                <div className="md:col-span-6 flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="newIncomeEndsAtRetirement"
                            checked={newIncome.endsAtRetirement || false}
                            onChange={e =>
                                setNewIncome({
                                    ...newIncome,
                                    endsAtRetirement: e.target.checked,
                                    // Clear any explicit endYear when enabling — it will be
                                    // derived from the retirement year at projection time.
                                    endYear: e.target.checked ? undefined : newIncome.endYear
                                })
                            }
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="newIncomeEndsAtRetirement" className="text-sm font-medium text-gray-700">
                            Ends at retirement
                        </label>
                    </div>

                    <div className="flex items-center gap-2">
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
                </div>

                <button
                    type="submit"
                    className="md:col-span-6 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:-translate-y-0.5 transition-transform"
                >
                    Add Income Stream
                </button>
            </form>

            {data.incomeStreams.length > 0 && (
                <div className="flex flex-col gap-4">
                    {data.incomeStreams.map(income => {
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
                                            <NumericInput
                                                value={displayData.annualAmount}
                                                onChange={v =>
                                                    setEditingData({
                                                        ...editingData!,
                                                        annualAmount: v
                                                    })
                                                }
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium text-gray-700">
                                                Starting Year (optional)
                                            </label>
                                            <input
                                                type="number"
                                                placeholder={`${currentYear}`}
                                                value={displayData.startYear ?? ""}
                                                onChange={e =>
                                                    setEditingData({
                                                        ...editingData!,
                                                        startYear: e.target.value
                                                            ? parseInt(e.target.value)
                                                            : undefined
                                                    })
                                                }
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium text-gray-700">Ending Year</label>
                                            <input
                                                type="number"
                                                placeholder={
                                                    displayData.endsAtRetirement ? "At retirement" : "Never ends"
                                                }
                                                value={
                                                    displayData.endsAtRetirement ? "" : displayData.endYear ?? ""
                                                }
                                                disabled={displayData.endsAtRetirement}
                                                onChange={e =>
                                                    setEditingData({
                                                        ...editingData!,
                                                        endYear: e.target.value ? parseInt(e.target.value) : undefined
                                                    })
                                                }
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400"
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
                                        <div className="md:col-span-5 flex flex-wrap items-center gap-6">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`editIncomeEndsAtRetirement-${income.id}`}
                                                    checked={displayData.endsAtRetirement || false}
                                                    onChange={e =>
                                                        setEditingData({
                                                            ...editingData!,
                                                            endsAtRetirement: e.target.checked,
                                                            endYear: e.target.checked
                                                                ? undefined
                                                                : editingData!.endYear
                                                        })
                                                    }
                                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                                />
                                                <label
                                                    htmlFor={`editIncomeEndsAtRetirement-${income.id}`}
                                                    className="text-sm font-medium text-gray-700"
                                                >
                                                    Ends at retirement
                                                </label>
                                            </div>
                                            <div className="flex items-center gap-2">
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
                                                {displayData.startYear ?? currentYear} -{" "}
                                                {displayData.endsAtRetirement
                                                    ? "Retirement"
                                                    : displayData.endYear || "Ongoing"}
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
                                        <div className="flex flex-wrap gap-2 items-start">
                                            {displayData.endsAtRetirement && (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                    Ends at retirement
                                                </span>
                                            )}
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
                <h3 className="font-semibold text-blue-900 mb-2">About Income Streams</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Model income before and after retirement (salary, pensions, annuities, rentals…)</li>
                    <li>• Amounts are in today&apos;s money</li>
                    <li>• Set a custom growth rate or use inflation adjustment</li>
                    <li>• Tick &quot;Ends at retirement&quot; for pre-retirement income — the end year is computed from the retirement year</li>
                    <li>• Specify an explicit ending year for fixed-term income (e.g. term annuities)</li>
                    <li>• Use the checkbox to enable/disable income sources in your calculations</li>
                    <li>• UK State Pension is calculated separately based on your personal info</li>
                </ul>
            </div>
        </div>
    )
}
