import fs from "node:fs"

export function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync("./local-web-search.json", "utf8"))
  } catch {
    return {}
  }
}
