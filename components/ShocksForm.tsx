"use client"

import { useState } from "react"
import { MarketShock, RetirementData } from "@/lib/types"

interface Props {
    data: RetirementData
    setData: (data: RetirementData) => void
}

export default function ShocksForm({ data, setData }: Props) {
    const [newShock, setNewShock] = useState<MarketShock>({
        id: "",
        year: new Date().getFullYear() + 1,
        impactPercent: -20,
        description: ""
    })

    const addShock = (e: React.FormEvent) => {
        e.preventDefault()
        if (newShock.year && newShock.impactPercent !== 0) {
            setData({
                ...data,
                shocks: [...data.shocks, { ...newShock, id: Date.now().toString() }]
            })
            setNewShock({
                id: "",
                year: new Date().getFullYear() + 1,
                impactPercent: -20,
                description: ""
            })
        }
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
                    {data.shocks.map(shock => (
                        <div
                            key={shock.id}
                            className="p-6 bg-white border-2 border-red-200 rounded-lg hover:border-red-400 transition-colors grid grid-cols-1 md:grid-cols-4 gap-4 items-center"
                        >
                            <div className="flex flex-col gap-1 md:col-span-2">
                                <div className="font-semibold text-gray-900">{shock.description || "Market Event"}</div>
                                <div className="text-sm text-gray-500">Year: {shock.year}</div>
                            </div>
                            <div
                                className={`font-semibold ${shock.impactPercent > 0 ? "text-green-600" : "text-red-600"}`}
                            >
                                {shock.impactPercent > 0 ? "+" : ""}
                                {shock.impactPercent}%
                            </div>
                            <button
                                onClick={() => deleteShock(shock.id)}
                                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors font-semibold text-sm"
                            >
                                Delete
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
