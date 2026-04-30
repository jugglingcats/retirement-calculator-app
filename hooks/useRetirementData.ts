"use client"

import { useEffect, useState } from "react"
import { RetirementData } from "@/lib/types"

const STORAGE_KEY = "retirement-calculator-data"

export const defaultRetirementData: RetirementData = {
    personal: {
        dateOfBirth: "",
        spouseDateOfBirth: "",
        retirementAge: 65
    },
    assets: [],
    incomeNeeds: [],
    incomeStreams: [],
    assumptions: {
        inflationRate: 2.5,
        categoryGrowthRates: {},
        investmentBalanceEnabled: true,
        investmentBalance: {
            initialEquityPercentage: 80,
            targetEquityPercentage: 50,
            yearsToTarget: 30
        }
    },
    incomeTax: {
        personalAllowance: 12570,
        higherRateThreshold: 50270
    },
    shocks: [],
    oneOffs: []
}

/**
 * Hook backing the calculator's RetirementData by localStorage. Each route can call this
 * independently; the data stays in sync via the storage key. We only persist after the
 * initial load completes so we don't overwrite saved data with the default during SSR/hydration.
 */
export function useRetirementData(): [RetirementData, (data: RetirementData) => void, boolean] {
    const [data, setData] = useState<RetirementData>(defaultRetirementData)
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        const savedData = localStorage.getItem(STORAGE_KEY)
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData)
                // Migrate legacy `retirementIncome` key to `incomeStreams`.
                if (parsedData.retirementIncome && !parsedData.incomeStreams) {
                    parsedData.incomeStreams = parsedData.retirementIncome
                    delete parsedData.retirementIncome
                }
                if (!parsedData.incomeStreams) parsedData.incomeStreams = []
                if (!parsedData.oneOffs) parsedData.oneOffs = []
                if (!parsedData.incomeTax) {
                    parsedData.incomeTax = {
                        personalAllowance: 12570,
                        higherRateThreshold: 50270
                    }
                }
                setData(parsedData)
            } catch (error) {
                console.error("Failed to parse saved data:", error)
            }
        }
        setLoaded(true)
    }, [])

    useEffect(() => {
        if (!loaded) return
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }, [data, loaded])

    return [data, setData, loaded]
}
