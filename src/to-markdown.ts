import Turndown from "turndown"
import { gfm } from "turndown-plugin-gfm"
import { stripHTML } from "./utils"

const turndown = new Turndown({
  codeBlockStyle: "fenced",
})
turndown.use(gfm)

export function toMarkdown(html: string) {
  return stripHTML(turndown.turndown(html))
}
