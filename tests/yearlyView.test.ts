import { describe, it, expect } from "vitest"
import { AssetPoolType, AssetType, PoolYear, YearlyDatapoint } from "@/lib/types"
import {
    addPools,
    emptyAssetPool,
    emptyPoolYear,
    endPosition,
    householdYearly,
    householdYearlySeries,
    sumPool
} from "@/lib/yearlyView"

function makePool(overrides: Partial<PoolYear> = {}): PoolYear {
    return {
        ...emptyPoolYear(),
        ...overrides
    }
}

function makeDatapoint(primary: PoolYear, spouse: PoolYear, extras: Partial<YearlyDatapoint> = {}): YearlyDatapoint {
    return {
        year: 2030,
        age: 60,
        pools: [primary, spouse],
        expenditure: 0,
        shortfall: 0,
        ...extras
    }
}

describe("yearlyView", () => {
    describe("emptyAssetPool / sumPool / addPools", () => {
        it("emptyAssetPool returns all zeros for every AssetType", () => {
            const p = emptyAssetPool()
            for (const t of Object.values(AssetType)) {
                expect(p[t]).toBe(0)
            }
            expect(sumPool(p)).toBe(0)
        })

        it("sumPool sums all asset values", () => {
            const p = emptyAssetPool()
            p[AssetType.Cash] = 100
            p[AssetType.ISA] = 50
            p[AssetType.Pension] = 25
            expect(sumPool(p)).toBe(175)
        })

        it("addPools adds two pools field by field without mutation", () => {
            const a = emptyAssetPool()
            a[AssetType.Cash] = 100
            const b = emptyAssetPool()
            b[AssetType.Cash] = 50
            b[AssetType.ISA] = 30

            const c = addPools(a, b)

            expect(c[AssetType.Cash]).toBe(150)
            expect(c[AssetType.ISA]).toBe(30)
            // originals untouched
            expect(a[AssetType.Cash]).toBe(100)
            expect(b[AssetType.Cash]).toBe(50)
        })
    })

    describe("endPosition", () => {
        it("derives end-of-year balances from initialPosition - withdrawals", () => {
            const initial = emptyAssetPool()
            initial[AssetType.Cash] = 1000
            initial[AssetType.ISA] = 5000
            initial[AssetType.Pension] = 10000

            const withdrawals = emptyAssetPool()
            withdrawals[AssetType.Cash] = 200
            withdrawals[AssetType.Pension] = 3000

            const p = makePool({ initialPosition: initial, withdrawals })
            const ep = endPosition(p)

            expect(ep[AssetType.Cash]).toBe(800)
            expect(ep[AssetType.ISA]).toBe(5000)
            expect(ep[AssetType.Pension]).toBe(7000)
        })

        it("can produce negative balances when withdrawals exceed the initial position", () => {
            const initial = emptyAssetPool()
            initial[AssetType.Cash] = 100

            const withdrawals = emptyAssetPool()
            withdrawals[AssetType.Cash] = 250

            const ep = endPosition(makePool({ initialPosition: initial, withdrawals }))
            expect(ep[AssetType.Cash]).toBe(-150)
        })
    })

    describe("householdYearly", () => {
        it("combines per-pool balances and clamps each balance at zero", () => {
            const primaryInit = emptyAssetPool()
            primaryInit[AssetType.Cash] = 5000
            primaryInit[AssetType.ISA] = 2000

            const primaryWd = emptyAssetPool()
            primaryWd[AssetType.Cash] = 1000

            const spouseInit = emptyAssetPool()
            spouseInit[AssetType.Cash] = 3000
            spouseInit[AssetType.ISA] = 1000

            const primary = makePool({ initialPosition: primaryInit, withdrawals: primaryWd })
            const spouse = makePool({ initialPosition: spouseInit })

            const hh = householdYearly(makeDatapoint(primary, spouse))

            // primary cash end = 5000 - 1000 = 4000; spouse cash end = 3000 -> total 7000
            expect(hh.cash).toBe(7000)
            expect(hh.isa).toBe(3000)
            expect(hh.assets).toBe(10000)
            // unused asset types are zero
            expect(hh.pension).toBe(0)
            expect(hh.property).toBe(0)
        })

        it("clamps a single asset at zero when one pool would go negative", () => {
            const primaryInit = emptyAssetPool()
            primaryInit[AssetType.Cash] = 100
            const primaryWd = emptyAssetPool()
            primaryWd[AssetType.Cash] = 250 // cash overdrawn by 150 in primary pool

            const primary = makePool({ initialPosition: primaryInit, withdrawals: primaryWd })
            const spouse = makePool() // all zero

            const hh = householdYearly(makeDatapoint(primary, spouse))
            // Combined end cash = -150 -> clamped to 0
            expect(hh.cash).toBe(0)
            expect(hh.assets).toBe(0)
        })

        it("sums income across pools and exposes both statePension and otherIncome", () => {
            const primary = makePool({
                income: { statePension: 11502, otherIncome: 2000 }
            })
            const spouse = makePool({
                income: { statePension: 5000, otherIncome: 1000 }
            })

            const hh = householdYearly(makeDatapoint(primary, spouse))

            expect(hh.statePension).toBe(11502 + 5000)
            expect(hh.otherIncome).toBe(2000 + 1000)
            expect(hh.income).toBe(11502 + 5000 + 2000 + 1000)
        })

        it("sums withdrawals, tax and CGT across both pools", () => {
            const primaryWd = emptyAssetPool()
            primaryWd[AssetType.Cash] = 200
            primaryWd[AssetType.ISA] = 100
            const primary = makePool({ withdrawals: primaryWd, tax: 50, cgtPayable: 10 })

            const spouseWd = emptyAssetPool()
            spouseWd[AssetType.Cash] = 75
            const spouse = makePool({ withdrawals: spouseWd, tax: 25, cgtPayable: 5 })

            const hh = householdYearly(makeDatapoint(primary, spouse))

            expect(hh.assetWithdrawals).toBe(200 + 100 + 75)
            expect(hh.taxPayable).toBe(75)
            expect(hh.cgtPayable).toBe(15)
        })

        it("carries year, age, expenditure and shortfall through unchanged", () => {
            const yd = makeDatapoint(makePool(), makePool(), {
                year: 2042,
                age: 72,
                expenditure: 30000,
                shortfall: 1234
            })
            const hh = householdYearly(yd)

            expect(hh.year).toBe(2042)
            expect(hh.age).toBe(72)
            expect(hh.expenditure).toBe(30000)
            expect(hh.shortfall).toBe(1234)
        })

        it("primary pool is read at index AssetPoolType.PRIMARY", () => {
            const primary = makePool({ income: { statePension: 1000, otherIncome: 0 } })
            const spouse = makePool({ income: { statePension: 0, otherIncome: 0 } })

            const yd = makeDatapoint(primary, spouse)
            // Sanity: index 0 is primary
            expect(yd.pools[AssetPoolType.PRIMARY]).toBe(primary)
            expect(yd.pools[AssetPoolType.SPOUSE]).toBe(spouse)
            expect(householdYearly(yd).statePension).toBe(1000)
        })
    })

    describe("householdYearlySeries", () => {
        it("maps a list of YearlyDatapoint into a list of HouseholdYearly entries", () => {
            const yd1 = makeDatapoint(makePool(), makePool(), { year: 2030, age: 60 })
            const yd2 = makeDatapoint(makePool(), makePool(), { year: 2031, age: 61 })

            const series = householdYearlySeries([yd1, yd2])
            expect(series).toHaveLength(2)
            expect(series[0].year).toBe(2030)
            expect(series[1].year).toBe(2031)
        })
    })
})
