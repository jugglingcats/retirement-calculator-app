"use client"

import { useState } from "react"
import { Debt, RetirementData } from "@/lib/types"
import { NumericInput } from "@/components/ui/numeric-input"
import { monthsToRepay, payoffDate } from "@/lib/debt"

interface Props {
    data: RetirementData
    setData: (data: RetirementData) => void
}

const emptyDebt = (): Omit<Debt, "id"> => ({
    name: "",
    balance: 0,
    aprPercent: 0,
    monthlyRepayment: 0,
    enabled: true
})

function formatDuration(months: number): string {
    if (!isFinite(months)) return "never (repayment ≤ interest)"
    if (months <= 0) return "—"
    const years = Math.floor(months / 12)
    const rem = months % 12
    const parts: string[] = []
    if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`)
    if (rem > 0) parts.push(`${rem} month${rem === 1 ? "" : "s"}`)
    return parts.join(", ") || "0 months"
}

function formatDate(d: Date | null): string {
    if (!d) return "—"
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" })
}

function PayoffSummary({
    balance,
    aprPercent,
    monthlyRepayment
}: {
    balance: number
    aprPercent: number
    monthlyRepayment: number
}) {
    if (!balance || !monthlyRepayment) {
        return <span className="text-gray-400 text-sm">Enter balance and monthly repayment to see end date</span>
    }
    const months = monthsToRepay(balance, aprPercent, monthlyRepayment)
    const endDate = payoffDate(balance, aprPercent, monthlyRepayment)
    if (!isFinite(months)) {
        return (
            <span className="text-red-600 text-sm">
                Monthly repayment doesn&apos;t cover interest — debt would never be repaid.
            </span>
        )
    }
    return (
        <span className="text-sm text-gray-700">
            <strong className="text-gray-900">End date:</strong> {formatDate(endDate)}
            <span className="text-gray-500"> · {formatDuration(months)} remaining</span>
        </span>
    )
}

export default function DebtsForm({ data, setData }: Props) {
    const debts = data.debts ?? []
    const [newDebt, setNewDebt] = useState<Omit<Debt, "id">>(emptyDebt())
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingData, setEditingData] = useState<Debt | null>(null)

    const updateDebts = (next: Debt[]) => setData({ ...data, debts: next })

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newDebt.name || newDebt.balance <= 0) return
        updateDebts([...debts, { ...newDebt, id: Date.now().toString() }])
        setNewDebt(emptyDebt())
    }

    const handleToggle = (id: string) =>
        updateDebts(debts.map(d => (d.id === id ? { ...d, enabled: d.enabled === false } : d)))
    const handleRemove = (id: string) => updateDebts(debts.filter(d => d.id !== id))
    const startEditing = (d: Debt) => {
        setEditingId(d.id)
        setEditingData({ ...d })
    }
    const cancelEditing = () => {
        setEditingId(null)
        setEditingData(null)
    }
    const saveEditing = () => {
        if (!editingData) return
        updateDebts(debts.map(d => (d.id === editingId ? editingData : d)))
        setEditingId(null)
        setEditingData(null)
    }

    return (
        <div className="flex flex-col gap-8">
            <p className="text-gray-600 text-sm">
                Add debts such as mortgages, loans or credit cards. Interest is compounded monthly at the APR you
                specify, and the fixed monthly repayment is applied each month. Debt repayments are funded as part of
                your annual expenditure, and the outstanding balance is shown as a negative figure under Starting Assets
                in the yearly breakdown.
            </p>

            <form
                onSubmit={handleAdd}
                className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
            >
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Description</label>
                    <input
                        type="text"
                        placeholder="e.g., Mortgage"
                        value={newDebt.name}
                        onChange={e => setNewDebt({ ...newDebt, name: e.target.value })}
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        required
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Outstanding Balance (£)</label>
                    <NumericInput
                        value={newDebt.balance}
                        onChange={v => setNewDebt({ ...newDebt, balance: v })}
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">APR (%)</label>
                    <input
                        type="number"
                        step="0.01"
                        value={newDebt.aprPercent || ""}
                        onChange={e => setNewDebt({ ...newDebt, aprPercent: parseFloat(e.target.value) || 0 })}
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        required
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Monthly Repayment (£)</label>
                    <NumericInput
                        value={newDebt.monthlyRepayment}
                        onChange={v => setNewDebt({ ...newDebt, monthlyRepayment: v })}
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>
                <div className="md:col-span-4">
                    <PayoffSummary
                        balance={newDebt.balance}
                        aprPercent={newDebt.aprPercent}
                        monthlyRepayment={newDebt.monthlyRepayment}
                    />
                </div>
                <button
                    type="submit"
                    className="md:col-span-4 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:-translate-y-0.5 transition-transform"
                >
                    Add Debt
                </button>
            </form>

            {debts.length > 0 && (
                <div className="flex flex-col gap-4">
                    {debts.map(debt => {
                        const isEditing = editingId === debt.id
                        const display = isEditing ? editingData! : debt
                        const enabled = debt.enabled !== false
                        return (
                            <div
                                key={debt.id}
                                className={`p-6 border-2 rounded-lg transition-colors ${
                                    enabled
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
                                                value={display.name}
                                                onChange={e =>
                                                    setEditingData({ ...editingData!, name: e.target.value })
                                                }
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium text-gray-700">Balance (£)</label>
                                            <NumericInput
                                                value={display.balance}
                                                onChange={v => setEditingData({ ...editingData!, balance: v })}
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium text-gray-700">APR (%)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={display.aprPercent}
                                                onChange={e =>
                                                    setEditingData({
                                                        ...editingData!,
                                                        aprPercent: parseFloat(e.target.value) || 0
                                                    })
                                                }
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium text-gray-700">
                                                Monthly Repayment (£)
                                            </label>
                                            <NumericInput
                                                value={display.monthlyRepayment}
                                                onChange={v => setEditingData({ ...editingData!, monthlyRepayment: v })}
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="md:col-span-4">
                                            <PayoffSummary
                                                balance={display.balance}
                                                aprPercent={display.aprPercent}
                                                monthlyRepayment={display.monthlyRepayment}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center mb-4">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={enabled}
                                                onChange={() => handleToggle(debt.id)}
                                                className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded"
                                            />
                                            <div className="font-semibold text-gray-900">{debt.name}</div>
                                        </div>
                                        <div className="font-semibold text-red-600">
                                            £{debt.balance.toLocaleString()}
                                        </div>
                                        <div className="text-gray-700">{debt.aprPercent}% APR</div>
                                        <div className="text-gray-700">
                                            £{debt.monthlyRepayment.toLocaleString()}/mo
                                        </div>
                                        <div className="text-sm text-gray-700">
                                            <PayoffSummary
                                                balance={debt.balance}
                                                aprPercent={debt.aprPercent}
                                                monthlyRepayment={debt.monthlyRepayment}
                                            />
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
                                                onClick={() => startEditing(debt)}
                                                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-semibold text-sm"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleRemove(debt.id)}
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
