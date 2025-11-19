"use client"

import type { RetirementData } from "@/types"

interface Props {
    data: RetirementData
    setData: (data: RetirementData) => void
}

export default function PersonalInfoForm({ data, setData }: Props) {
    const updatePersonal = (field: string, value: string | number) => {
        setData({
            ...data,
            personal: {
                ...data.personal,
                [field]: value
            }
        })
    }

    return (
        <form onSubmit={e => e.preventDefault()} className="flex flex-col gap-6 max-w-2xl">
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
                <label htmlFor="spouseDob" className="font-semibold text-gray-700">
                    Spouse Date of Birth (Optional)
                </label>
                <input
                    id="spouseDob"
                    type="date"
                    value={data.personal.spouseDateOfBirth}
                    onChange={e => updatePersonal("spouseDateOfBirth", e.target.value)}
                    className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <p className="text-sm text-gray-500">Include UK state pension for your spouse</p>
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
        </form>
    )
}
