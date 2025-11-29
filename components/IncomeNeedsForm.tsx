"use client"

import { useState } from "react"
import { IncomeNeed, RetirementData } from "@/lib/types"

interface Props {
    data: RetirementData
    setData: (data: RetirementData) => void
}

export default function IncomeNeedsForm({ data, setData }: Props) {
    const [newNeed, setNewNeed] = useState<IncomeNeed>({
        id: "",
        description: "",
        annualAmount: 0,
        startingAge: undefined
    })

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingData, setEditingData] = useState<IncomeNeed | null>(null)

    const addNeed = (e: React.FormEvent) => {
        e.preventDefault()
        if (newNeed.description && newNeed.annualAmount > 0) {
            setData({
                ...data,
                incomeNeeds: [...data.incomeNeeds, { ...newNeed, id: Date.now().toString() }]
            })
            setNewNeed({ id: "", description: "", annualAmount: 0, startingAge: undefined })
        }
    }

    const deleteNeed = (id: string) => {
        setData({
            ...data,
            incomeNeeds: data.incomeNeeds.filter(need => need.id !== id)
        })
    }

    const startEditing = (need: IncomeNeed) => {
        setEditingId(need.id)
        setEditingData({ ...need })
    }

    const cancelEditing = () => {
        setEditingId(null)
        setEditingData(null)
    }

    const saveEditing = () => {
        if (editingData) {
            setData({
                ...data,
                incomeNeeds: data.incomeNeeds.map(need => (need.id === editingId ? editingData : need))
            })
            setEditingId(null)
            setEditingData(null)
        }
    }

    return (
        <div className="flex flex-col gap-8">
            <p className="text-gray-600 text-sm">
                Define your income needs <b>after tax</b> at different stages of retirement. Each entry shows the annual
                amount needed in today&apos;s money net of any tax, which will be automatically adjusted for inflation.
                If you don&apos;t specify a starting age, it will default to your retirement age. Often people's needs
                decrease slightly as they get older.
            </p>

            <form
                onSubmit={addNeed}
                className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
            >
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Description</label>
                    <input
                        type="text"
                        placeholder="e.g., Basic living expenses"
                        value={newNeed.description}
                        onChange={e => setNewNeed({ ...newNeed, description: e.target.value })}
                        required
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Annual Amount (£ today&apos;s value)</label>
                    <input
                        type="number"
                        placeholder="30000"
                        value={newNeed.annualAmount || ""}
                        onChange={e => setNewNeed({ ...newNeed, annualAmount: parseFloat(e.target.value) || 0 })}
                        required
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">
                        Starting Age (defaults to retirement age)
                    </label>
                    <input
                        type="number"
                        placeholder={data.personal.retirementAge?.toString() || "65"}
                        value={newNeed.startingAge || ""}
                        onChange={e =>
                            setNewNeed({
                                ...newNeed,
                                startingAge: e.target.value ? parseInt(e.target.value) : undefined
                            })
                        }
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <button
                    type="submit"
                    className="md:col-span-3 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:-translate-y-0.5 transition-transform"
                >
                    Add Income Need
                </button>
            </form>

            {data.incomeNeeds.length > 0 && (
                <div className="flex flex-col gap-4">
                    {[...data.incomeNeeds]
                        .sort(
                            (a, b) =>
                                (a.startingAge || data.personal.retirementAge) -
                                (b.startingAge || data.personal.retirementAge)
                        )
                        .map(need => {
                            const displayAge = need.startingAge || data.personal.retirementAge || 65
                            const isEditing = editingId === need.id
                            const displayData = isEditing ? editingData! : need

                            return (
                                <div
                                    key={need.id}
                                    className="p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-indigo-500 transition-colors"
                                >
                                    {isEditing ? (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-medium text-gray-700">Description</label>
                                                <input
                                                    type="text"
                                                    value={displayData.description}
                                                    onChange={e =>
                                                        setEditingData({ ...editingData!, description: e.target.value })
                                                    }
                                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
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
                                                <label className="text-sm font-medium text-gray-700">
                                                    Starting Age
                                                </label>
                                                <input
                                                    type="number"
                                                    value={displayData.startingAge || ""}
                                                    onChange={e =>
                                                        setEditingData({
                                                            ...editingData!,
                                                            startingAge: e.target.value
                                                                ? parseInt(e.target.value)
                                                                : undefined
                                                        })
                                                    }
                                                    placeholder={data.personal.retirementAge?.toString() || "65"}
                                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center mb-4">
                                            <div className="flex flex-col gap-1 md:col-span-2">
                                                <div className="font-semibold text-gray-900">
                                                    {displayData.description}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    Starting at age {displayAge}
                                                    {!displayData.startingAge && " (retirement age)"}
                                                </div>
                                            </div>
                                            <div className="font-semibold text-gray-900">
                                                £{displayData.annualAmount.toLocaleString()}/year
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
                                                    onClick={() => startEditing(need)}
                                                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-semibold text-sm"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => deleteNeed(need.id)}
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
        </div>
    )
}
