"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
    value: number | undefined | null
    onChange: (value: number) => void
    /** If true, parses with parseInt instead of parseFloat */
    integer?: boolean
    /** Value to emit when input is left blank (default: 0). Pass undefined to emit nothing on blur. */
    fallback?: number
}

/**
 * A numeric input that uses type="text" (with inputMode="decimal") so that users can type
 * intermediate values like "-", ".", or clear the field before entering a new number.
 * Avoids the React controlled-input issue where type="number" resets "-" to "" on each keystroke.
 */
export function NumericInput({
    value,
    onChange,
    integer = false,
    fallback = 0,
    className,
    onBlur,
    ...props
}: NumericInputProps) {
    const parse = (s: string) => (integer ? parseInt(s, 10) : parseFloat(s))

    const formatValue = (v: number | undefined | null): string => {
        if (v === undefined || v === null || (typeof v === "number" && isNaN(v))) return ""
        return String(v)
    }

    const [text, setText] = useState<string>(() => formatValue(value))

    // Keep display in sync when value changes externally (e.g. reset after save)
    const externalValueRef = useRef(value)
    useEffect(() => {
        if (externalValueRef.current !== value) {
            externalValueRef.current = value
            const currentParsed = parse(text)
            // Only overwrite if the text doesn't already represent the new value
            if (currentParsed !== value) {
                setText(formatValue(value))
            }
        }
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value
        setText(raw)
        // Allow intermediate states: empty, lone "-", lone "."
        if (raw === "" || raw === "-" || raw === ".") return
        const parsed = parse(raw)
        if (!isNaN(parsed)) {
            onChange(parsed)
        }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const raw = e.target.value
        if (raw === "" || raw === "-" || raw === ".") {
            onChange(fallback)
            setText(fallback === 0 ? "" : String(fallback))
        }
        onBlur?.(e)
    }

    return (
        <input
            type="text"
            inputMode={integer ? "numeric" : "decimal"}
            value={text}
            onChange={handleChange}
            onBlur={handleBlur}
            className={cn(className)}
            {...props}
        />
    )
}
