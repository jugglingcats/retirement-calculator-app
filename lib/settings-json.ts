import { RetirementData } from "@/lib/types"

export const exportSettings = (data: RetirementData) => {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    a.download = `retirement-settings-${timestamp}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

export const parseSettings = (text: string): RetirementData => {
    const parsed = JSON.parse(text) as Partial<RetirementData> & { retirementIncome?: unknown }
    if (!parsed || typeof parsed !== "object" || !parsed.personal) {
        throw new Error("Invalid settings file")
    }
    // Migrate legacy `retirementIncome` key to `incomeStreams`.
    const incomeStreams =
        parsed.incomeStreams ?? (parsed.retirementIncome as RetirementData["incomeStreams"] | undefined) ?? []
    return {
        personal: parsed.personal as RetirementData["personal"],
        assets: parsed.assets ?? [],
        incomeNeeds: parsed.incomeNeeds ?? [],
        incomeStreams,
        assumptions: parsed.assumptions ?? {
            inflationRate: 2.5,
            categoryGrowthRates: {},
            investmentBalanceEnabled: true,
            investmentBalance: {
                initialEquityPercentage: 80,
                targetEquityPercentage: 50,
                yearsToTarget: 30
            }
        },
        incomeTax: parsed.incomeTax ?? {
            personalAllowance: 12570,
            higherRateThreshold: 50270
        },
        shocks: parsed.shocks ?? [],
        oneOffs: parsed.oneOffs ?? [],
        debts: parsed.debts ?? []
    }
}

export const readSettingsFile = (file: File): Promise<RetirementData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => {
            try {
                const text = String(e.target?.result ?? "")
                resolve(parseSettings(text))
            } catch (error) {
                reject(error)
            }
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsText(file)
    })
}
