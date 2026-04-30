"use client"

import { RetirementData } from "@/lib/types"

interface Props {
    data: RetirementData
    setData: (data: RetirementData) => void
}

export default function PersonalInfoForm({ data, setData }: Props) {
    const updatePersonal = (field: string, value: string | number | boolean | undefined) => {
        setData({
            ...data,
            personal: {
                ...data.personal,
                [field]: value
            }
        })
    }

    const includePartner = data.personal.includePartner ?? Boolean(data.personal.spouseDateOfBirth)
    const spouseRetirementAge = data.personal.spouseRetirementAge ?? data.personal.retirementAge

    const toggleIncludePartner = (checked: boolean) => {
        setData({
            ...data,
            personal: {
                ...data.personal,
                includePartner: checked,
                // Default the partner's retirement age to the primary's the first time the
                // box is checked so the input has a sensible value.
                spouseRetirementAge:
                    data.personal.spouseRetirementAge ?? (checked ? data.personal.retirementAge : undefined)
            }
        })
    }

    return (
        <form onSubmit={e => e.preventDefault()} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Primary column */}
                <div className="flex flex-col gap-6">
                    <h3 className="font-semibold text-gray-900 text-lg">Your details</h3>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="dob" className="font-semibold text-gray-700">
                            Your Date of Birth
                        </label>
                        <input
                            id="dob"
                            type="date"
                            value={data.personal.dateOfBirth}
                            onChange={e => updatePersonal("dateOfBirth", e.target.value)}
                            className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        <p className="text-sm text-gray-500">
                            Used to calculate your current age and UK state pension eligibility
                        </p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="retirementAge" className="font-semibold text-gray-700">
                            Desired Retirement Age
                        </label>
                        <input
                            id="retirementAge"
                            type="number"
                            min="50"
                            max="80"
                            value={data.personal.retirementAge}
                            onChange={e => updatePersonal("retirementAge", parseInt(e.target.value))}
                            className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        <p className="text-sm text-gray-500">The age at which you plan to retire</p>
                    </div>
                </div>

                {/* Partner column */}
                <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="includePartner"
                            checked={includePartner}
                            onChange={e => toggleIncludePartner(e.target.checked)}
                            className="w-5 h-5 text-indigo-600 border-2 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="includePartner" className="font-semibold text-gray-900 text-lg">
                            Include partner details
                        </label>
                    </div>

                    {includePartner && (
                        <>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="spouseDob" className="font-semibold text-gray-700">
                                    Partner Date of Birth
                                </label>
                                <input
                                    id="spouseDob"
                                    type="date"
                                    value={data.personal.spouseDateOfBirth}
                                    onChange={e => updatePersonal("spouseDateOfBirth", e.target.value)}
                                    className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                                <p className="text-sm text-gray-500">
                                    Used to calculate your partner's age and UK state pension eligibility
                                </p>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label htmlFor="spouseRetirementAge" className="font-semibold text-gray-700">
                                    Partner's Desired Retirement Age
                                </label>
                                <input
                                    id="spouseRetirementAge"
                                    type="number"
                                    min="50"
                                    max="80"
                                    value={spouseRetirementAge}
                                    onChange={e =>
                                        updatePersonal("spouseRetirementAge", parseInt(e.target.value))
                                    }
                                    className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                                <p className="text-sm text-gray-500">
                                    The age at which your partner plans to retire
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </form>
    )
}