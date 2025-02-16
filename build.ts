/**
 * Build script for MCP server local web search
 * This script handles the TypeScript compilation and bundling process
 */

import { build } from "bun";
import { spawnSync } from "child_process";
import { mkdir, writeFile } from "fs/promises";

async function main() {
  try {
    // Ensure dist directory exists
    await mkdir("dist", { recursive: true });

    // Build with Bun
    const result = await build({
      entrypoints: ["./src/index.ts"],
      outdir: "./dist",
      target: "node",
      format: "esm",
      minify: true,
      sourcemap: "external",
    });

    if (!result.success) {
      console.error("Build failed:", result.logs);
      process.exit(1);
    }

    // Create package.json for dist
    const distPackageJson = {
      "type": "module",
      "main": "index.js",
      "types": "index.d.ts",
    };

    await writeFile(
      "./dist/package.json",
      JSON.stringify(distPackageJson, null, 2)
    );

    // Generate type declarations
    const tsc = spawnSync("bun", ["tsc", "--emitDeclarationOnly"], {
      stdio: "inherit",
    });

    if (tsc.status !== 0) {
      console.error("Type declaration generation failed");
      process.exit(1);
    }

    console.log("Build completed successfully!");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

main(); 