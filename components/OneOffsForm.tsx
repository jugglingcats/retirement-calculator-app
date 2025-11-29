"use client"

import { useState } from "react"
import { OneOff, RetirementData } from "@/lib/types"

interface OneOffsFormProps {
    data: RetirementData
    setData: (data: RetirementData) => void
}

export default function OneOffsForm({ data, setData }: OneOffsFormProps) {
    const [newOneOff, setNewOneOff] = useState<Omit<OneOff, "id">>({
        description: "",
        amount: 0,
        age: 65,
        enabled: true,
        belongsToSpouse: false
    })

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingData, setEditingData] = useState<OneOff | null>(null)

    const handleAddOneOff = (e: React.FormEvent) => {
        e.preventDefault()
        if (newOneOff.description && newOneOff.amount !== 0) {
            const oneOffToAdd: OneOff = {
                ...newOneOff,
                id: Date.now().toString()
            }
            setData({
                ...data,
                oneOffs: [...(data.oneOffs || []), oneOffToAdd]
            })
            setNewOneOff({
                description: "",
                amount: 0,
                age: 65,
                enabled: true,
                belongsToSpouse: false
            })
        }
    }

    const startEditing = (oneOff: OneOff) => {
        setEditingId(oneOff.id)
        setEditingData({ ...oneOff })
    }

    const cancelEditing = () => {
        setEditingId(null)
        setEditingData(null)
    }

    const saveEditing = () => {
        if (editingData) {
            setData({
                ...data,
                oneOffs: (data.oneOffs || []).map(oneOff => (oneOff.id === editingId ? editingData : oneOff))
            })
            setEditingId(null)
            setEditingData(null)
        }
    }

    const handleToggleEnabled = (id: string) => {
        setData({
            ...data,
            oneOffs: (data.oneOffs || []).map(oneOff =>
                oneOff.id === id ? { ...oneOff, enabled: !oneOff.enabled } : oneOff
            )
        })
    }

    const handleRemoveOneOff = (id: string) => {
        setData({
            ...data,
            oneOffs: (data.oneOffs || []).filter(oneOff => oneOff.id !== id)
        })
    }

    return (
        <div className="flex flex-col gap-8">
            <p className="text-gray-600 text-sm">
                Add one-time expenses (e.g., gifting money) or windfalls (e.g., inheritance). Use negative amounts for
                expenses and positive amounts for windfalls. All amounts are adjusted for inflation.
            </p>

            <form
                onSubmit={handleAddOneOff}
                className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
            >
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Description</label>
                    <input
                        type="text"
                        placeholder="e.g., Gift to children, Inheritance"
                        value={newOneOff.description}
                        onChange={e => setNewOneOff({ ...newOneOff, description: e.target.value })}
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        required
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Amount (£)</label>
                    <input
                        type="number"
                        placeholder="50000 or -50000"
                        value={newOneOff.amount || ""}
                        onChange={e => setNewOneOff({ ...newOneOff, amount: parseFloat(e.target.value) || 0 })}
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        step="1000"
                        required
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Age</label>
                    <input
                        type="number"
                        placeholder="70"
                        value={newOneOff.age || ""}
                        onChange={e => setNewOneOff({ ...newOneOff, age: parseInt(e.target.value) || 65 })}
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        required
                    />
                </div>
                <div className="md:col-span-3 flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="newOneOffBelongsToSpouse"
                        checked={newOneOff.belongsToSpouse || false}
                        onChange={e => setNewOneOff({ ...newOneOff, belongsToSpouse: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="newOneOffBelongsToSpouse" className="text-sm font-medium text-gray-700">
                        Belongs to spouse
                    </label>
                </div>
                <button
                    type="submit"
                    className="md:col-span-3 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:-translate-y-0.5 transition-transform"
                >
                    Add One-Off Event
                </button>
            </form>

            {(data.oneOffs || []).length > 0 && (
                <div className="flex flex-col gap-4">
                    {(data.oneOffs || []).map(oneOff => {
                        const isEditing = editingId === oneOff.id
                        const displayData = isEditing ? editingData! : oneOff

                        return (
                            <div
                                key={oneOff.id}
                                className={`p-6 border-2 rounded-lg transition-colors ${
                                    oneOff.enabled
                                        ? "bg-white border-gray-200 hover:border-indigo-500"
                                        : "bg-gray-100 border-gray-300 opacity-60"
                                }`}
                            >
                                {isEditing ? (
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                        <div className="flex flex-col gap-2 md:col-span-2">
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
                                            <label className="text-sm font-medium text-gray-700">Amount (£)</label>
                                            <input
                                                type="number"
                                                value={displayData.amount}
                                                onChange={e =>
                                                    setEditingData({
                                                        ...editingData!,
                                                        amount: parseFloat(e.target.value) || 0
                                                    })
                                                }
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                step="1000"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium text-gray-700">Age</label>
                                            <input
                                                type="number"
                                                value={displayData.age}
                                                onChange={e =>
                                                    setEditingData({
                                                        ...editingData!,
                                                        age: parseInt(e.target.value) || 65
                                                    })
                                                }
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="md:col-span-4 flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id={`editOneOffBelongsToSpouse-${oneOff.id}`}
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
                                                htmlFor={`editOneOffBelongsToSpouse-${oneOff.id}`}
                                                className="text-sm font-medium text-gray-700"
                                            >
                                                Belongs to spouse
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center mb-4">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={oneOff.enabled}
                                                onChange={() => handleToggleEnabled(oneOff.id)}
                                                className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded"
                                            />
                                            <div className="font-semibold text-gray-900">{displayData.description}</div>
                                        </div>
                                        <div
                                            className={`font-semibold ${displayData.amount >= 0 ? "text-green-600" : "text-red-600"}`}
                                        >
                                            £{displayData.amount.toLocaleString()}
                                        </div>
                                        <div className="text-gray-700">At age {displayData.age}</div>
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
                                                onClick={() => startEditing(oneOff)}
                                                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-semibold text-sm"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleRemoveOneOff(oneOff.id)}
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
