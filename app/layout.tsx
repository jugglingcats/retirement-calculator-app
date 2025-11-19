import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
    title: "Retirement Calculator | Plan Your Financial Future",
    description:
        "Comprehensive retirement planning tool with asset tracking, UK state pension, and market shock modeling",
    generator: "v0.app"
}

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en">
            <body className={geist.className}>
                {children}
                <Analytics />
            </body>
        </html>
    )
}
