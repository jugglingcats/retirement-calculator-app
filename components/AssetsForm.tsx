"use client"

import { useState } from "react"
import { Asset, AssetType, RetirementData } from "@/types"

interface Props {
    data: RetirementData
    setData: (data: RetirementData) => void
}

export default function AssetsForm({ data, setData }: Props) {
    const [newAsset, setNewAsset] = useState<Asset>({
        id: "",
        name: "",
        value: 0,
        category: AssetType.Pension,
        belongsToSpouse: false
    })

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingData, setEditingData] = useState<Asset | null>(null)

    const categories = [
        { value: AssetType.Pension, label: "Pension" },
        { value: AssetType.ISA, label: "ISA" },
        { value: AssetType.StocksAndShares, label: "Stocks & Shares" },
        { value: AssetType.Property, label: "Property" },
        { value: AssetType.Bonds, label: "Bonds" },
        { value: AssetType.Cash, label: "Cash" }
    ]

    const addAsset = (e: React.FormEvent) => {
        e.preventDefault()
        if (newAsset.name && newAsset.value > 0) {
            setData({
                ...data,
                assets: [...data.assets, { ...newAsset, id: Date.now().toString() }]
            })
            setNewAsset({ id: "", name: "", value: 0, category: AssetType.Pension, belongsToSpouse: false })
        }
    }

    const deleteAsset = (id: string) => {
        setData({
            ...data,
            assets: data.assets.filter(asset => asset.id !== id)
        })
    }

    const startEditing = (asset: Asset) => {
        setEditingId(asset.id)
        setEditingData({ ...asset })
    }

    const cancelEditing = () => {
        setEditingId(null)
        setEditingData(null)
    }

    const saveEditing = () => {
        if (editingData) {
            setData({
                ...data,
                assets: data.assets.map(asset => (asset.id === editingId ? editingData : asset))
            })
            setEditingId(null)
            setEditingData(null)
        }
    }

    const totalAssets = data.assets.reduce((sum, asset) => sum + asset.value, 0)

    return (
        <div className="flex flex-col gap-8">
            <form
                onSubmit={addAsset}
                className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
            >
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Asset Name</label>
                    <input
                        type="text"
                        placeholder="e.g., Company Pension"
                        value={newAsset.name}
                        onChange={e => setNewAsset({ ...newAsset, name: e.target.value })}
                        required
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Current Value (£)</label>
                    <input
                        type="number"
                        placeholder="50000"
                        value={newAsset.value || ""}
                        onChange={e => setNewAsset({ ...newAsset, value: parseFloat(e.target.value) || 0 })}
                        required
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Category</label>
                    <select
                        value={newAsset.category}
                        onChange={e => setNewAsset({ ...newAsset, category: e.target.value as AssetType })}
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors bg-white"
                    >
                        {categories.map(cat => (
                            <option key={cat.value} value={cat.value}>
                                {cat.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="md:col-span-3 flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="newAssetBelongsToSpouse"
                        checked={newAsset.belongsToSpouse || false}
                        onChange={e => setNewAsset({ ...newAsset, belongsToSpouse: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="newAssetBelongsToSpouse" className="text-sm font-medium text-gray-700">
                        Belongs to spouse
                    </label>
                </div>

                <button
                    type="submit"
                    className="md:col-span-3 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:-translate-y-0.5 transition-transform"
                >
                    Add Asset
                </button>
            </form>

            {data.assets.length > 0 && (
                <>
                    <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg text-white text-center">
                        <div className="text-sm opacity-90 mb-2">Total Assets</div>
                        <div className="text-3xl font-bold">£{totalAssets.toLocaleString()}</div>
                    </div>

                    <div className="flex flex-col gap-4">
                        {data.assets.map(asset => {
                            const isEditing = editingId === asset.id
                            const displayData = isEditing ? editingData! : asset

                            return (
                                <div
                                    key={asset.id}
                                    className="p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-indigo-500 transition-colors"
                                >
                                    {isEditing ? (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-medium text-gray-700">Asset Name</label>
                                                <input
                                                    type="text"
                                                    value={displayData.name}
                                                    onChange={e =>
                                                        setEditingData({ ...editingData!, name: e.target.value })
                                                    }
                                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-medium text-gray-700">
                                                    Current Value (£)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={displayData.value}
                                                    onChange={e =>
                                                        setEditingData({
                                                            ...editingData!,
                                                            value: parseFloat(e.target.value) || 0
                                                        })
                                                    }
                                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-medium text-gray-700">Category</label>
                                                <select
                                                    value={displayData.category}
                                                    onChange={e =>
                                                        setEditingData({
                                                            ...editingData!,
                                                            category: e.target.value as AssetType
                                                        })
                                                    }
                                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                                                >
                                                    {categories.map(cat => (
                                                        <option key={cat.value} value={cat.value}>
                                                            {cat.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="md:col-span-3 flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`editAssetBelongsToSpouse-${asset.id}`}
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
                                                    htmlFor={`editAssetBelongsToSpouse-${asset.id}`}
                                                    className="text-sm font-medium text-gray-700"
                                                >
                                                    Belongs to spouse
                                                </label>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center mb-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="font-semibold text-gray-900">{displayData.name}</div>
                                                <div className="text-sm text-gray-500 capitalize">
                                                    {displayData.category}
                                                </div>
                                            </div>
                                            <div className="font-semibold text-gray-900">
                                                £{displayData.value.toLocaleString()}
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
                                                    onClick={() => startEditing(asset)}
                                                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-semibold text-sm"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => deleteAsset(asset.id)}
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
                </>
            )}
        </div>
    )
}
