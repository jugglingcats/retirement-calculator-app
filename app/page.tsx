"use client"

import { useState, useEffect } from "react"
import PersonalInfoForm from "@/components/PersonalInfoForm"
import AssetsForm from "@/components/AssetsForm"
import IncomeNeedsForm from "@/components/IncomeNeedsForm"
import RetirementIncomeForm from "@/components/RetirementIncomeForm"
import IncomeTaxForm from "@/components/IncomeTaxForm" // Import IncomeTaxForm component
import AssumptionsForm from "@/components/AssumptionsForm"
import ShocksForm from "@/components/ShocksForm"
import OneOffsForm from "@/components/OneOffsForm" // Import OneOffsForm component
import RetirementProjection from "@/components/RetirementProjection"

import { RetirementData } from "@/lib/types"

const STORAGE_KEY = "retirement-calculator-data"

export default function RetirementCalculator() {
    const [activeTab, setActiveTab] = useState(0)
    const [data, setData] = useState<RetirementData>({
        personal: {
            dateOfBirth: "",
            spouseDateOfBirth: "",
            retirementAge: 65
        },
        assets: [],
        incomeNeeds: [],
        retirementIncome: [],
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
        }, // Added default income tax settings
        shocks: [],
        oneOffs: []
    })

    useEffect(() => {
        const savedData = localStorage.getItem(STORAGE_KEY)
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData)
                if (!parsedData.retirementIncome) {
                    parsedData.retirementIncome = []
                }
                if (!parsedData.oneOffs) {
                    parsedData.oneOffs = []
                }
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
    }, [])

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }, [data])

    const tabs = [
        { name: "Personal Info", component: PersonalInfoForm },
        { name: "Assets", component: AssetsForm },
        { name: "Expenditure", component: IncomeNeedsForm },
        { name: "Retirement Income", component: RetirementIncomeForm },
        { name: "One Offs", component: OneOffsForm }, // Added One Offs tab
        { name: "Income Tax", component: IncomeTaxForm }, // Added Income Tax tab
        { name: "Assumptions", component: AssumptionsForm },
        { name: "Market Shocks", component: ShocksForm },
        { name: "Projection", component: RetirementProjection }
    ]

    const CurrentTabComponent = tabs[activeTab].component

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4 md:p-8">
            <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
                <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 md:p-8 text-center">
                    <h1 className="text-3xl md:text-4xl font-bold mb-2">Retirement Calculator</h1>
                    <p className="text-lg opacity-95">Plan your financial future with confidence</p>
                </header>

                <div className="p-4 md:p-8">
                    <div className="flex flex-wrap gap-2 border-b-2 border-gray-200 mb-6">
                        {tabs.map((tab, index) => (
                            <button
                                key={tab.name}
                                onClick={() => setActiveTab(index)}
                                className={`px-4 py-3 font-semibold transition-all rounded-t-lg ${
                                    activeTab === index
                                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                                        : "text-gray-600 hover:bg-gray-100"
                                }`}
                            >
                                {tab.name}
                            </button>
                        ))}
                    </div>

                    <div className="animate-in fade-in duration-300">
                        <CurrentTabComponent data={data} setData={setData} />
                    </div>
                </div>
            </div>
        </div>
    )
}
