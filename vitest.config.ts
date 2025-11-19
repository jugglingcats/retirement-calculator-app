import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
    // Avoid ESM-only plugins in Vitest config; set alias directly instead
    resolve: {
        alias: {
            "@": path.resolve(process.cwd(), "./")
        }
    },
    test: {
        environment: "node",
        globals: true,
        setupFiles: [],
        coverage: {
            provider: "v8",
            reportsDirectory: "./coverage"
        }
    }
})
