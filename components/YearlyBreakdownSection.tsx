"use client"

import { Fragment, useMemo, useState } from "react"
import { calculateProjection } from "@/lib/calculations"
import { RetirementData } from "@/lib/types"
import {
    BreakdownGroup,
    BreakdownRow,
    GROUP_LABELS,
    buildYearlyBreakdown,
    personLabel
} from "@/lib/yearlyExport"
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

const GROUP_ORDER: BreakdownGroup[] = ["assets", "income", "withdrawals", "expenses"]

const GROUP_BG: Record<BreakdownGroup, string> = {
    assets: "bg-blue-50",
    income: "bg-green-50",
    withdrawals: "bg-rose-50",
    expenses: "bg-amber-50"
}
const GROUP_TOTAL_BG: Record<BreakdownGroup, string> = {
    assets: "bg-blue-100",
    income: "bg-green-100",
    withdrawals: "bg-rose-100",
    expenses: "bg-amber-100"
}
const GROUP_HEADER_BG: Record<BreakdownGroup, string> = {
    assets: "bg-blue-200",
    income: "bg-green-200",
    withdrawals: "bg-rose-200",
    expenses: "bg-amber-200"
}

export default function YearlyBreakdownSection({ data, projection, containerClassName }: Props) {
    const [downloading, setDownloading] = useState(false)
    const breakdown = useMemo(() => buildYearlyBreakdown(data, projection), [data, projection])

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

    // Group rows by group, preserving order.
    const rowsByGroup: Record<BreakdownGroup, BreakdownRow[]> = {
        assets: [],
        income: [],
        withdrawals: [],
        expenses: []
    }
    for (const r of breakdown.rows) rowsByGroup[r.group].push(r)

    const renderRow = (row: BreakdownRow, key: string) => {
        const isTotal = !!row.isGroupTotal
        const baseBg = isTotal ? GROUP_TOTAL_BG[row.group] : GROUP_BG[row.group]
        return (
            <tr key={key} className={isTotal ? "border-t border-gray-300" : ""}>
                <td
                    className={`sticky left-0 z-10 px-2 py-1 whitespace-nowrap ${baseBg} ${
                        isTotal ? "font-semibold text-gray-900" : "text-gray-700"
                    }`}
                    style={{ minWidth: 180 }}
                >
                    {row.label}
                </td>
                <td
                    className={`sticky left-[180px] z-10 px-2 py-1 whitespace-nowrap text-xs ${baseBg} ${
                        isTotal ? "font-semibold text-gray-700" : "text-gray-500"
                    }`}
                    style={{ minWidth: 70 }}
                >
                    {row.person ? personLabel(row.person) : ""}
                </td>
                {row.values.map((v, i) => (
                    <td
                        key={i}
                        className={`px-2 py-1 text-right tabular-nums whitespace-nowrap ${
                            isTotal ? `${GROUP_TOTAL_BG[row.group]} font-semibold` : ""
                        }`}
                    >
                        {fmt(v)}
                    </td>
                ))}
            </tr>
        )
    }

    return (
        <div className={wrapperClass}>
            <div className="flex items-start justify-between mb-4 gap-4">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900">Yearly Breakdown</h3>
                    <p className="text-xs text-gray-500 mt-1">
                        One column per year, rows grouped into Income, Withdrawals and Expenses (taxes included).
                        Per-person lines are split into Me{breakdown.hasSpouse ? " and Partner" : ""} where applicable;
                        each group has a totals row. Values shown to 3 significant figures; the Excel download contains
                        exact figures with GBP formatting.
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
                        <tr className="bg-gray-100 text-gray-700">
                            <th
                                className="sticky left-0 z-20 bg-gray-100 text-left px-2 py-2 border-b"
                                style={{ minWidth: 180 }}
                            >
                                Item
                            </th>
                            <th
                                className="sticky left-[180px] z-20 bg-gray-100 text-left px-2 py-2 border-b"
                                style={{ minWidth: 70 }}
                            >
                                Person
                            </th>
                            {breakdown.years.map(y => (
                                <th
                                    key={`year-${y.year}`}
                                    className="text-right px-2 py-1 border-b whitespace-nowrap"
                                >
                                    <div>{y.year}</div>
                                    <div className="text-xs font-normal text-gray-500">
                                        Age {y.age}
                                        {breakdown.hasSpouse && y.spouseAge !== undefined ? ` / ${y.spouseAge}` : ""}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {GROUP_ORDER.map(group => {
                            const rows = rowsByGroup[group]
                            if (rows.length === 0) return null
                            return (
                                <Fragment key={`grp-${group}`}>
                                    <tr>
                                        <th
                                            className={`sticky left-0 z-20 ${GROUP_HEADER_BG[group]} text-left px-2 py-1 font-semibold text-gray-800 uppercase tracking-wide text-xs whitespace-nowrap`}
                                            colSpan={2}
                                        >
                                            {GROUP_LABELS[group]}
                                        </th>
                                        {breakdown.years.map((y, i) => (
                                            <th
                                                key={`grp-${group}-${i}-${y.year}`}
                                                className={`${GROUP_HEADER_BG[group]} px-2 py-1`}
                                            />
                                        ))}
                                    </tr>
                                    {rows.map((row, i) => renderRow(row, `${group}-${i}`))}
                                </Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}