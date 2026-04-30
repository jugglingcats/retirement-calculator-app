"use client"

import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import PersonalInfoForm from "@/components/PersonalInfoForm"
import AssetsForm from "@/components/AssetsForm"
import IncomeNeedsForm from "@/components/IncomeNeedsForm"
import IncomeForm from "@/components/IncomeForm"
import IncomeTaxForm from "@/components/IncomeTaxForm"
import AssumptionsForm from "@/components/AssumptionsForm"
import ShocksForm from "@/components/ShocksForm"
import OneOffsForm from "@/components/OneOffsForm"
import RetirementProjection from "@/components/RetirementProjection"

import { exportSettings, readSettingsFile } from "@/lib/settings-json"
import { useRetirementData } from "@/hooks/useRetirementData"

interface TabDef {
    slug: string
    name: string
    component: React.ComponentType<any>
}

const tabs: TabDef[] = [
    { slug: "personal-info", name: "Personal Info", component: PersonalInfoForm },
    { slug: "assets", name: "Assets", component: AssetsForm },
    { slug: "expenditure", name: "Expenditure", component: IncomeNeedsForm },
    { slug: "income", name: "Income", component: IncomeForm },
    { slug: "one-offs", name: "One Offs", component: OneOffsForm },
    { slug: "income-tax", name: "Income Tax", component: IncomeTaxForm },
    { slug: "assumptions", name: "Assumptions", component: AssumptionsForm },
    { slug: "market-shocks", name: "Market Shocks", component: ShocksForm },
    { slug: "projection", name: "Projection", component: RetirementProjection }
]

const DEFAULT_SLUG = tabs[0].slug

export default function CalculatorPage({ params }: { params: Promise<{ slug?: string[] }> }) {
    const router = useRouter()
    const { slug: slugSegments } = use(params)
    const slug = slugSegments?.[0]
    // If the URL is unrecognised (or root), fall back to the default tab. We render the
    // default tab immediately for a smooth experience, and replace the URL so deep-links
    // and refreshes work cleanly.
    const matchedTab = tabs.find(t => t.slug === slug)
    const activeTab = matchedTab ?? tabs[0]

    useEffect(() => {
        if (!slug) {
            router.replace(`/${DEFAULT_SLUG}`)
        } else if (!matchedTab) {
            router.replace(`/${DEFAULT_SLUG}`)
        }
    }, [slug, matchedTab, router])

    const [data, setData] = useRetirementData()
    const CurrentTabComponent = activeTab.component

    const fileInputRef = useRef<HTMLInputElement>(null)
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!menuOpen) return
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [menuOpen])

    const handleExport = () => {
        try {
            exportSettings(data)
        } catch (error) {
            console.error("Failed to export settings:", error)
            alert("Failed to export settings.")
        } finally {
            setMenuOpen(false)
        }
    }

    const handleImportClick = () => {
        fileInputRef.current?.click()
        setMenuOpen(false)
    }

    const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        try {
            const imported = await readSettingsFile(file)
            setData(imported)
        } catch (error) {
            console.error("Failed to import settings:", error)
            alert("Failed to import settings: invalid JSON file.")
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = ""
            }
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4 md:p-8">
            <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
                <header className="relative bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 md:p-8 text-center">
                    <h1 className="text-3xl md:text-4xl font-bold mb-2">Retirement Calculator</h1>
                    <p className="text-lg opacity-95">Plan your financial future with confidence</p>
                    <div ref={menuRef} className="absolute top-4 right-4">
                        <button
                            type="button"
                            onClick={() => setMenuOpen(o => !o)}
                            aria-label="Open menu"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            className="p-2 rounded-lg hover:bg-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white/50"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="18" x2="21" y2="18" />
                            </svg>
                        </button>
                        {menuOpen && (
                            <div
                                role="menu"
                                className="absolute right-0 mt-2 w-48 bg-white text-gray-800 rounded-lg shadow-lg overflow-hidden z-10"
                            >
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={handleExport}
                                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
                                >
                                    Export Settings
                                </button>
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={handleImportClick}
                                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
                                >
                                    Import Settings
                                </button>
                            </div>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/json,.json"
                            onChange={handleImportFile}
                            className="hidden"
                        />
                    </div>
                </header>

                <div className="p-4 md:p-8">
                    <div className="flex flex-wrap gap-2 border-b-2 border-gray-200 mb-6">
                        {tabs.map(tab => {
                            const isActive = tab.slug === activeTab.slug
                            return (
                                <Link
                                    key={tab.slug}
                                    href={`/${tab.slug}`}
                                    className={`px-4 py-3 font-semibold transition-all rounded-t-lg ${
                                        isActive
                                            ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                                            : "text-gray-600 hover:bg-gray-100"
                                    }`}
                                >
                                    {tab.name}
                                </Link>
                            )
                        })}
                    </div>

                    <div className="animate-in fade-in duration-300">
                        <CurrentTabComponent data={data} setData={setData} />
                    </div>
                </div>
            </div>
        </div>
    )
}
