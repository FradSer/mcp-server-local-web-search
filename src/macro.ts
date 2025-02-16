import fs from "node:fs"
import path from "node:path"

// const wrapModuleExports = (code: string) => {
//   return `(function(module){${code}\nreturn module.exports})({})`
// }

export const getReadabilityScript = async () => {
  const result = await Bun.build({
    entrypoints: ["./node_modules/@mozilla/readability/Readability.js"],
    format: "cjs",
    minify: true,
  })
  return result.outputs[0].text()
}
