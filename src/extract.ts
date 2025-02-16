// note: we can't import other code here but only types
// since this function runs in the browser

import type { SearchResult } from "./cli"

export function getSearchPageLinks(window: Window) {
  const links: SearchResult[] = []
  const document = window.document

  const isValidUrl = (url: string) => {
    try {
      new URL(url)
      return true
    } catch (error) {
      return false
    }
  }

  try {
    // DuckDuckGo HTML search results are in .links_main elements
    const elements = document.querySelectorAll(".links_main")
    elements.forEach((element) => {
      const titleEl = element.querySelector(".links_main a")
      const url = titleEl?.getAttribute("href")

      if (!url || !isValidUrl(url)) return

      const item: SearchResult = {
        title: titleEl?.textContent?.trim() || "",
        url: url.startsWith("/") ? `https://duckduckgo.com${url}` : url,
      }

      if (!item.title || !item.url) return

      links.push(item)
    })
  } catch (error) {
    console.error(error)
  }

  return links
}
