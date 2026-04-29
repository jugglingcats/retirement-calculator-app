"use client"

import { useMemo, useState } from "react"
import { calculateProjection } from "@/lib/calculations"
import { AssetPoolType, RetirementData } from "@/lib/types"
import { buildYearlyExportTable } from "@/lib/yearlyExport"
import { ASSET_LABELS } from "@/lib/yearlyView"
import { downloadYearlyExcel } from "@/lib/yearlyExcelExport"
import { formatGBP } from "@/components/util"

interface Props {
    data: RetirementData
    projection: ReturnType<typeof calculateProjection>
    /**
     * Optional override for the wrapper element's className. When provided it replaces the
     * default constrained card styling — used by the standalone full-width table route.
     */
    containerClassName?: string
}

export default function YearlyBreakdownSection({ data, projection, containerClassName }: Props) {
    const [downloading, setDownloading] = useState(false)
    const table = useMemo(() => buildYearlyExportTable(data, projection), [data, projection])

    const handleDownload = async () => {
        try {
            setDownloading(true)
            await downloadYearlyExcel(data, projection)
        } catch (err) {
            console.error("Failed to generate Excel export:", err)
        } finally {
            setDownloading(false)
        }
    }

    const fmt = (v: number) => (v === 0 ? <span className="text-gray-300">—</span> : formatGBP(v))

    const wrapperClass = containerClassName ?? "p-6 bg-white border-2 border-gray-200 rounded-lg"

    return (
        <div className={wrapperClass}>
            <div className="flex items-start justify-between mb-4 gap-4">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900">Yearly Breakdown</h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Two rows per year (Me / Partner): initial position at the start of the year, income by source,
                        household expenditure, and withdrawals broken down by asset pool. Values shown to 3 significant
                        figures; the Excel download contains exact figures with GBP formatting.
                    </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                    <a
                        href="/table"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                    >
                        Open standalone ↗
                    </a>
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={downloading}
                        className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {downloading ? "Preparing…" : "Download Excel"}
                    </button>
                </div>
            </div>

            <div className="overflow-auto">
                <table className="min-w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-gray-700">
                            <th className="text-left px-2 py-2 border-b" rowSpan={2}>
                                Year
                            </th>
                            <th className="text-left px-2 py-2 border-b" rowSpan={2}>
                                Person
                            </th>
                            {table.visibleAssetTypes.length > 0 && (
                                <th
                                    className="text-center px-2 py-2 border-b bg-blue-50"
                                    colSpan={table.visibleAssetTypes.length + 1}
                                >
                                    Initial position
                                </th>
                            )}
                            <th className="text-center px-2 py-2 border-b bg-green-50" colSpan={3}>
                                Income
                            </th>
                            <th className="text-center px-2 py-2 border-b bg-amber-50" colSpan={4}>
                                Expenditure
                            </th>
                            <th className="text-right px-2 py-2 border-b bg-violet-50" rowSpan={2}>
                                Net Income − Expenditure
                            </th>
                            {table.visibleAssetTypes.length > 0 && (
                                <th
                                    className="text-center px-2 py-2 border-b bg-rose-50"
                                    colSpan={table.visibleAssetTypes.length + 1}
                                >
                                    Withdrawals
                                </th>
                            )}
                        </tr>
                        <tr className="bg-gray-50 text-gray-700 text-xs">
                            {table.visibleAssetTypes.map(t => (
                                <th key={`init-${t}`} className="text-right px-2 py-1 border-b bg-blue-50">
                                    {ASSET_LABELS[t]}
                                </th>
                            ))}
                            {table.visibleAssetTypes.length > 0 && (
                                <th className="text-right px-2 py-1 border-b bg-blue-50">Total</th>
                            )}
                            <th className="text-right px-2 py-1 border-b bg-green-50">State Pension</th>
                            <th className="text-right px-2 py-1 border-b bg-green-50">Other</th>
                            <th className="text-right px-2 py-1 border-b bg-green-50">Total</th>
                            <th className="text-right px-2 py-1 border-b bg-amber-50">Spending</th>
                            <th className="text-right px-2 py-1 border-b bg-amber-50">Income Tax</th>
                            <th className="text-right px-2 py-1 border-b bg-amber-50">CGT</th>
                            <th className="text-right px-2 py-1 border-b bg-amber-50">Total</th>
                            {table.visibleAssetTypes.map(t => (
                                <th key={`wd-${t}`} className="text-right px-2 py-1 border-b bg-rose-50">
                                    {ASSET_LABELS[t]}
                                </th>
                            ))}
                            {table.visibleAssetTypes.length > 0 && (
                                <th className="text-right px-2 py-1 border-b bg-rose-50">Total</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row, idx) => {
                            const isYearStart = row.poolIndex === AssetPoolType.PRIMARY
                            return (
                                <tr
                                    key={`${row.year}-${row.poolIndex}`}
                                    className={`${
                                        Math.floor(idx / 2) % 2 === 0 ? "bg-white" : "bg-gray-50"
                                    } ${isYearStart && idx > 0 ? "border-t-2 border-gray-200" : ""}`}
                                >
                                    <td className="px-2 py-1 text-gray-800 whitespace-nowrap">
                                        {isYearStart ? row.year : ""}
                                    </td>
                                    <td className="px-2 py-1 text-gray-700 whitespace-nowrap">{row.personLabel}</td>
                                    {table.visibleAssetTypes.map(t => (
                                        <td
                                            key={`init-${row.year}-${row.poolIndex}-${t}`}
                                            className="px-2 py-1 text-right tabular-nums whitespace-nowrap"
                                        >
                                            {fmt(row.initial[t] || 0)}
                                        </td>
                                    ))}
                                    {table.visibleAssetTypes.length > 0 && (
                                        <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap font-medium">
                                            {fmt(row.initialTotal)}
                                        </td>
                                    )}
                                    <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                                        {fmt(row.statePension)}
                                    </td>
                                    <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                                        {fmt(row.otherIncome)}
                                    </td>
                                    <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap font-medium">
                                        {fmt(row.incomeTotal)}
                                    </td>
                                    <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                                        {isYearStart ? fmt(row.expenditure) : ""}
                                    </td>
                                    <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                                        {isYearStart ? fmt(row.tax) : ""}
                                    </td>
                                    <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                                        {isYearStart ? fmt(row.cgt) : ""}
                                    </td>
                                    <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap font-medium">
                                        {isYearStart ? fmt(row.expenditureTotal) : ""}
                                    </td>
                                    <td
                                        className={`px-2 py-1 text-right tabular-nums whitespace-nowrap font-medium ${
                                            isYearStart && row.netIncomeExpenditure < 0
                                                ? "text-red-600"
                                                : isYearStart && row.netIncomeExpenditure > 0
                                                  ? "text-green-700"
                                                  : ""
                                        }`}
                                    >
                                        {isYearStart ? fmt(row.netIncomeExpenditure) : ""}
                                    </td>
                                    {table.visibleAssetTypes.map(t => (
                                        <td
                                            key={`wd-${row.year}-${row.poolIndex}-${t}`}
                                            className="px-2 py-1 text-right tabular-nums whitespace-nowrap"
                                        >
                                            {fmt(row.withdrawals[t] || 0)}
                                        </td>
                                    ))}
                                    {table.visibleAssetTypes.length > 0 && (
                                        <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap font-medium">
                                            {fmt(row.withdrawalsTotal)}
                                        </td>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
