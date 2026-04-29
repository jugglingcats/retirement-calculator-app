"use client"

import { useState } from "react"
import { MarketShock, RetirementData } from "@/lib/types"

interface Props {
    data: RetirementData
    setData: (data: RetirementData) => void
}

export default function ShocksForm({ data, setData }: Props) {
    const [newShock, setNewShock] = useState<Omit<MarketShock, "id">>({
        year: new Date().getFullYear() + 1,
        impactPercent: -20,
        description: "",
        enabled: true
    })

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingData, setEditingData] = useState<MarketShock | null>(null)

    const addShock = (e: React.FormEvent) => {
        e.preventDefault()
        if (newShock.year && newShock.impactPercent !== 0) {
            const shockToAdd: MarketShock = {
                ...newShock,
                id: Date.now().toString()
            }
            setData({
                ...data,
                shocks: [...data.shocks, shockToAdd]
            })
            setNewShock({
                year: new Date().getFullYear() + 1,
                impactPercent: -20,
                description: "",
                enabled: true
            })
        }
    }

    const startEditing = (shock: MarketShock) => {
        setEditingId(shock.id)
        setEditingData({ ...shock })
    }

    const cancelEditing = () => {
        setEditingId(null)
        setEditingData(null)
    }

    const saveEditing = () => {
        if (editingData) {
            setData({
                ...data,
                shocks: data.shocks.map(shock => (shock.id === editingId ? editingData : shock))
            })
            setEditingId(null)
            setEditingData(null)
        }
    }

    const handleToggleEnabled = (id: string) => {
        setData({
            ...data,
            shocks: data.shocks.map(shock =>
                shock.id === id ? { ...shock, enabled: shock.enabled === false ? true : false } : shock
            )
        })
    }

    const deleteShock = (id: string) => {
        setData({
            ...data,
            shocks: data.shocks.filter(shock => shock.id !== id)
        })
    }

    return (
        <div className="flex flex-col gap-8">
            <p className="text-gray-600 text-sm">
                Model potential market crashes or windfalls. For example, a -30% shock in 2030 would simulate a
                recession. You can also model positive shocks like inheritances or property sales.
            </p>

            <form
                onSubmit={addShock}
                className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
            >
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Year</label>
                    <input
                        type="number"
                        min={new Date().getFullYear()}
                        max={new Date().getFullYear() + 50}
                        value={newShock.year}
                        onChange={e => setNewShock({ ...newShock, year: parseInt(e.target.value) })}
                        required
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Impact (%)</label>
                    <input
                        type="number"
                        step="1"
                        placeholder="-20"
                        value={newShock.impactPercent || ""}
                        onChange={e => setNewShock({ ...newShock, impactPercent: parseFloat(e.target.value) || 0 })}
                        required
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Description (Optional)</label>
                    <input
                        type="text"
                        placeholder="e.g., Market crash"
                        value={newShock.description}
                        onChange={e => setNewShock({ ...newShock, description: e.target.value })}
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <button
                    type="submit"
                    className="md:col-span-3 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:-translate-y-0.5 transition-transform"
                >
                    Add Market Shock
                </button>
            </form>

            {data.shocks.length > 0 && (
                <div className="flex flex-col gap-4">
                    {data.shocks.map(shock => {
                        const isEditing = editingId === shock.id
                        const displayData = isEditing ? editingData! : shock
                        const isEnabled = shock.enabled !== false

                        return (
                            <div
                                key={shock.id}
                                className={`p-6 border-2 rounded-lg transition-colors ${
                                    isEnabled
                                        ? "bg-white border-red-200 hover:border-red-400"
                                        : "bg-gray-100 border-gray-300 opacity-60"
                                }`}
                            >
                                {isEditing ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium text-gray-700">Description</label>
                                            <input
                                                type="text"
                                                value={displayData.description || ""}
                                                onChange={e =>
                                                    setEditingData({ ...editingData!, description: e.target.value })
                                                }
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium text-gray-700">Impact (%)</label>
                                            <input
                                                type="number"
                                                step="1"
                                                value={displayData.impactPercent}
                                                onChange={e =>
                                                    setEditingData({
                                                        ...editingData!,
                                                        impactPercent: parseFloat(e.target.value) || 0
                                                    })
                                                }
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium text-gray-700">Year</label>
                                            <input
                                                type="number"
                                                value={displayData.year}
                                                onChange={e =>
                                                    setEditingData({
                                                        ...editingData!,
                                                        year: parseInt(e.target.value) || displayData.year
                                                    })
                                                }
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center mb-4">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={isEnabled}
                                                onChange={() => handleToggleEnabled(shock.id)}
                                                className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded"
                                            />
                                            <div className="font-semibold text-gray-900">
                                                {displayData.description || "Market Event"}
                                            </div>
                                        </div>
                                        <div
                                            className={`font-semibold ${displayData.impactPercent > 0 ? "text-green-600" : "text-red-600"}`}
                                        >
                                            {displayData.impactPercent > 0 ? "+" : ""}
                                            {displayData.impactPercent}%
                                        </div>
                                        <div className="text-gray-700">In {displayData.year}</div>
                                        <div />
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
                                                onClick={() => startEditing(shock)}
                                                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-semibold text-sm"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => deleteShock(shock.id)}
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
