import ExcelJS from "exceljs"
import {
    BreakdownGroup,
    BreakdownRow,
    GROUP_LABELS,
    YearlyBreakdown,
    buildYearlyBreakdown,
    personLabel
} from "@/lib/yearlyExport"
import { ProjectionResult, RetirementData } from "@/lib/types"

const GBP_FORMAT = "[$£-809]#,##0;[Red]-[$£-809]#,##0"

const GROUP_ORDER: BreakdownGroup[] = ["assets", "income", "withdrawals", "expenses"]

// ARGB fills for the row label/value cells.
const GROUP_FILL: Record<BreakdownGroup, string> = {
    assets: "FFDBEAFE", // blue-100
    income: "FFDCFCE7", // green-100
    withdrawals: "FFFFE4E6", // rose-100
    expenses: "FFFEF3C7" // amber-100
}
const GROUP_TOTAL_FILL: Record<BreakdownGroup, string> = {
    assets: "FFBFDBFE", // blue-200
    income: "FFBBF7D0", // green-200
    withdrawals: "FFFECDD3", // rose-200
    expenses: "FFFDE68A" // amber-200
}
const GROUP_HEADER_FILL: Record<BreakdownGroup, string> = {
    assets: "FF93C5FD", // blue-300
    income: "FF86EFAC", // green-300
    withdrawals: "FFFDA4AF", // rose-300
    expenses: "FFFCD34D" // amber-300
}

function setCurrencyCell(cell: ExcelJS.Cell, value: number, fill?: string, bold = false) {
    cell.value = value
    cell.numFmt = GBP_FORMAT
    cell.alignment = { horizontal: "right" }
    if (bold) cell.font = { bold: true }
    if (fill) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } }
    }
}

function setLabelCell(cell: ExcelJS.Cell, text: string, fill: string, bold = false) {
    cell.value = text
    cell.alignment = { horizontal: "left", vertical: "middle" }
    if (bold) cell.font = { bold: true }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } }
}

export async function buildYearlyWorkbook(data: RetirementData, projection: ProjectionResult): Promise<Blob> {
    const breakdown: YearlyBreakdown = buildYearlyBreakdown(data, projection)
    const yearCount = breakdown.years.length

    const workbook = new ExcelJS.Workbook()
    workbook.creator = "Retirement Calculator"
    workbook.created = new Date()

    const sheet = workbook.addWorksheet("Yearly Projection", {
        views: [{ state: "frozen", xSplit: 2, ySplit: 2 }]
    })

    // Column widths: Item, Person, then one per year.
    sheet.columns = [
        { key: "label", width: 26 },
        { key: "person", width: 10 },
        ...breakdown.years.map((_, i) => ({ key: `y${i}`, width: 14 }))
    ]

    // ---- Header rows (2 rows: year, age) ----
    const yearRow = sheet.addRow(["Item", "Person", ...breakdown.years.map(y => y.year)])
    yearRow.height = 20
    const ageRow = sheet.addRow([
        "",
        "",
        ...breakdown.years.map(y => {
            const ages = breakdown.hasSpouse && y.spouseAge !== undefined ? `${y.age} / ${y.spouseAge}` : `${y.age}`
            return `Age ${ages}`
        })
    ])
    ageRow.height = 16

    const headerFill = "FFE5E7EB" // gray-200
    for (let c = 1; c <= 2 + yearCount; c++) {
        const yc = yearRow.getCell(c)
        yc.font = { bold: true }
        yc.alignment = { horizontal: c <= 2 ? "left" : "right", vertical: "middle" }
        yc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerFill } }
        yc.border = { bottom: { style: "thin", color: { argb: "FF9CA3AF" } } }

        const ac = ageRow.getCell(c)
        ac.font = { italic: true, color: { argb: "FF6B7280" } }
        ac.alignment = { horizontal: c <= 2 ? "left" : "right", vertical: "middle" }
        ac.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } }
        ac.border = { bottom: { style: "thin", color: { argb: "FF9CA3AF" } } }
    }
    sheet.mergeCells(1, 1, 2, 1)
    sheet.mergeCells(1, 2, 2, 2)

    // ---- Group rows ----
    const rowsByGroup: Record<BreakdownGroup, BreakdownRow[]> = {
        assets: [],
        income: [],
        withdrawals: [],
        expenses: []
    }
    for (const r of breakdown.rows) rowsByGroup[r.group].push(r)

    for (const group of GROUP_ORDER) {
        const rows = rowsByGroup[group]
        if (rows.length === 0) continue

        // Group header row spanning all columns.
        const headerRow = sheet.addRow([GROUP_LABELS[group]])
        headerRow.height = 20
        sheet.mergeCells(headerRow.number, 1, headerRow.number, 2 + yearCount)
        const hCell = headerRow.getCell(1)
        hCell.value = GROUP_LABELS[group]
        hCell.font = { bold: true }
        hCell.alignment = { horizontal: "left", vertical: "middle" }
        hCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_HEADER_FILL[group] } }

        for (const row of rows) {
            const isTotal = !!row.isGroupTotal
            const fill = isTotal ? GROUP_TOTAL_FILL[group] : GROUP_FILL[group]
            const xlRow = sheet.addRow([])
            setLabelCell(xlRow.getCell(1), row.label, fill, isTotal)
            setLabelCell(xlRow.getCell(2), row.person ? personLabel(row.person) : "", fill, isTotal)
            for (let i = 0; i < yearCount; i++) {
                setCurrencyCell(xlRow.getCell(3 + i), row.values[i] || 0, fill, isTotal)
            }
            if (isTotal) {
                for (let c = 1; c <= 2 + yearCount; c++) {
                    const cell = xlRow.getCell(c)
                    cell.border = {
                        ...(cell.border || {}),
                        top: { style: "thin", color: { argb: "FF9CA3AF" } }
                    }
                }
            }
        }
    }

    const buffer = await workbook.xlsx.writeBuffer()
    return new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    })
}

export async function downloadYearlyExcel(
    data: RetirementData,
    projection: ProjectionResult,
    fileName = "retirement-projection.xlsx"
): Promise<void> {
    const blob = await buildYearlyWorkbook(data, projection)
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}