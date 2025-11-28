import { AssetPool, AssetPoolType } from "@/lib/types"
import { OneOff } from "@/types"

export function applyOneOffs(
    assetPools: [AssetPool, AssetPool],
    oneOffs: OneOff[],
    ages: number[],
    inflationMultiplier: number
) {
    const [age, spouseAge] = ages
    oneOffs?.forEach(oneOff => {
        if (!oneOff.enabled) {
            return
        }
        const adjustedAmount = oneOff.amount * inflationMultiplier
        if (oneOff.belongsToSpouse && spouseAge === oneOff.age) {
            assetPools[AssetPoolType.SPOUSE].cash += adjustedAmount
        } else if (age === oneOff.age) {
            assetPools[AssetPoolType.PRIMARY].cash += adjustedAmount
        }
    })
}
