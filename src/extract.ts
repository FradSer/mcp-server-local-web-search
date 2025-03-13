// note: we can't import other code here but only types
// since this function runs in the browser

import type { SearchResult } from "./cli"

export function getSearchPageLinks() {
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
    // Google search results are in div elements with class 'g'
    const elements = document.querySelectorAll(".g")
    elements.forEach((element) => {
      const titleEl = element.querySelector("h3")
      const urlEl = element.querySelector("a")
      const url = urlEl?.getAttribute("href")

      if (!url || !isValidUrl(url)) return

      const item: SearchResult = {
        title: titleEl?.textContent || "",
        url,
      }

      if (!item.title || !item.url) return

      links.push(item)
    })
  } catch (error) {
    console.error(error)
  }

  return links
}
