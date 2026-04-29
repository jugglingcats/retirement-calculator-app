// Format currency to 5 significant figures with thousand separators
export const formatGBP = (value: number, sig = 5) => {
    if (!isFinite(value) || value === 0) return "£0"
    const sign = value < 0 ? "-" : ""
    const abs = Math.abs(value)
    const digits = Math.floor(Math.log10(abs)) + 1
    const scalePow = Math.max(0, digits - sig)
    const scale = Math.pow(10, scalePow)
    const rounded = Math.round(abs / scale) * scale
    return `£${sign}${Math.trunc(rounded).toLocaleString()}`
}
