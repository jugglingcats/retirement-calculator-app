import ExcelJS from "exceljs"
import { buildYearlyExportTable, YearlyExportRow, YearlyExportTable } from "@/lib/yearlyExport"
import { ASSET_LABELS } from "@/lib/yearlyView"
import { AssetPoolType, AssetType, ProjectionResult, RetirementData } from "@/lib/types"

const GBP_FORMAT = "[$£-809]#,##0;[Red]-[$£-809]#,##0"

interface ColumnSpec {
    header: string
    group: "meta" | "initial" | "income" | "expenditure" | "net" | "withdrawals"
    width: number
    /** When defined, the column is rendered as currency. */
    currency?: boolean
    /** Extracts the value for the column from a row. */
    value: (row: YearlyExportRow) => number | string
}

function buildColumns(table: YearlyExportTable): ColumnSpec[] {
    const cols: ColumnSpec[] = [
        { header: "Year", group: "meta", width: 8, value: r => r.year },
        { header: "Age", group: "meta", width: 6, value: r => r.age },
        { header: "Person", group: "meta", width: 10, value: r => r.personLabel }
    ]

    for (const type of table.visibleAssetTypes) {
        cols.push({
            header: `Initial: ${ASSET_LABELS[type as AssetType]}`,
            group: "initial",
            width: 18,
            currency: true,
            value: r => r.initial[type] || 0
        })
    }
    cols.push({
        header: "Initial: Total",
        group: "initial",
        width: 18,
        currency: true,
        value: r => r.initialTotal
    })

    cols.push({
        header: "Income: State Pension",
        group: "income",
        width: 20,
        currency: true,
        value: r => r.statePension
    })
    cols.push({
        header: "Income: Other Income",
        group: "income",
        width: 22,
        currency: true,
        value: r => r.otherIncome
    })
    cols.push({
        header: "Income: Total",
        group: "income",
        width: 16,
        currency: true,
        value: r => r.incomeTotal
    })

    cols.push({
        header: "Expenditure (household)",
        group: "expenditure",
        width: 22,
        currency: true,
        value: r => r.expenditure
    })
    cols.push({
        header: "Income Tax",
        group: "expenditure",
        width: 14,
        currency: true,
        value: r => r.tax
    })
    cols.push({
        header: "CGT",
        group: "expenditure",
        width: 12,
        currency: true,
        value: r => r.cgt
    })
    cols.push({
        header: "Expenditure: Total",
        group: "expenditure",
        width: 18,
        currency: true,
        value: r => r.expenditureTotal
    })

    cols.push({
        header: "Net Income − Expenditure",
        group: "net",
        width: 22,
        currency: true,
        value: r => r.netIncomeExpenditure
    })

    for (const type of table.visibleAssetTypes) {
        cols.push({
            header: `Withdraw: ${ASSET_LABELS[type as AssetType]}`,
            group: "withdrawals",
            width: 18,
            currency: true,
            value: r => r.withdrawals[type] || 0
        })
    }
    cols.push({
        header: "Withdraw: Total",
        group: "withdrawals",
        width: 18,
        currency: true,
        value: r => r.withdrawalsTotal
    })

    return cols
}

const GROUP_COLORS: Record<ColumnSpec["group"], string> = {
    meta: "FFE5E7EB", // gray-200
    initial: "FFDBEAFE", // blue-100
    income: "FFDCFCE7", // green-100
    expenditure: "FFFEF3C7", // amber-100
    net: "FFEDE9FE", // violet-100
    withdrawals: "FFFFE4E6" // rose-100
}

const GROUP_HEADER_LABELS: Record<ColumnSpec["group"], string> = {
    meta: "",
    initial: "Initial position (start of year)",
    income: "Income",
    expenditure: "Expenditure",
    net: "Net",
    withdrawals: "Withdrawals"
}

function applyHeaderStyle(cell: ExcelJS.Cell, color: string) {
    cell.font = { bold: true }
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } }
    cell.border = {
        top: { style: "thin", color: { argb: "FF9CA3AF" } },
        bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
        left: { style: "thin", color: { argb: "FFD1D5DB" } },
        right: { style: "thin", color: { argb: "FFD1D5DB" } }
    }
}

export async function buildYearlyWorkbook(data: RetirementData, projection: ProjectionResult): Promise<Blob> {
    const table = buildYearlyExportTable(data, projection)
    const columns = buildColumns(table)

    const workbook = new ExcelJS.Workbook()
    workbook.creator = "Retirement Calculator"
    workbook.created = new Date()

    const sheet = workbook.addWorksheet("Yearly Projection", {
        views: [{ state: "frozen", xSplit: 3, ySplit: 2 }]
    })

    // Set column widths
    sheet.columns = columns.map((c, i) => ({ key: `c${i}`, width: c.width }))

    // Group header row (row 1): merges contiguous columns within the same group.
    const groupRow = sheet.addRow(columns.map(c => GROUP_HEADER_LABELS[c.group]))
    groupRow.height = 22
    let i = 0
    while (i < columns.length) {
        let j = i
        while (j + 1 < columns.length && columns[j + 1].group === columns[i].group) j++
        if (j > i) {
            sheet.mergeCells(1, i + 1, 1, j + 1)
        }
        applyHeaderStyle(groupRow.getCell(i + 1), GROUP_COLORS[columns[i].group])
        i = j + 1
    }

    // Column header row (row 2)
    const headerRow = sheet.addRow(columns.map(c => c.header))
    headerRow.height = 36
    columns.forEach((c, idx) => applyHeaderStyle(headerRow.getCell(idx + 1), GROUP_COLORS[c.group]))

    // Data rows
    table.rows.forEach((row, rIdx) => {
        const values = columns.map(c => c.value(row))
        const xlRow = sheet.addRow(values)
        const isYearStart = row.poolIndex === AssetPoolType.PRIMARY
        columns.forEach((c, idx) => {
            const cell = xlRow.getCell(idx + 1)
            if (c.currency) {
                cell.numFmt = GBP_FORMAT
                cell.alignment = { horizontal: "right" }
            } else if (c.header === "Year" || c.header === "Age") {
                cell.alignment = { horizontal: "center" }
            }
            // Subtle banding by year (every two rows).
            const banded = Math.floor(rIdx / 2) % 2 === 1
            if (banded) {
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFF9FAFB" }
                }
            }
            // Top border between years.
            if (isYearStart && rIdx > 0) {
                cell.border = {
                    ...(cell.border || {}),
                    top: { style: "thin", color: { argb: "FFD1D5DB" } }
                }
            }
        })
    })

    // Auto filter on the column header row.
    sheet.autoFilter = {
        from: { row: 2, column: 1 },
        to: { row: 2, column: columns.length }
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
