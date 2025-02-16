import { Browser } from "happy-dom"
import * as undici from "undici"

export async function domFetchAndEvaluate<T, TArg extends any[]>(
  url: string,
  fn: (window: Window, ...args: TArg) => T,
  fnArgs: TArg,
  options: { proxy?: string },
): Promise<T | null> {
  const agentOptions: undici.Agent.Options = {
    connect: {
      // bypass SSL failures
      rejectUnauthorized: false,
    },
    maxRedirections: 5,
  }

  const res = await undici
    .fetch(url, {
      dispatcher: options.proxy
        ? new undici.ProxyAgent({
            ...agentOptions,
            uri: options.proxy,
          })
        : new undici.Agent({
            ...agentOptions,
          }),
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/237.84.2.178 Safari/537.36",
      },
    })
    .catch((err) => {
      console.error(err)
      return null
    })

  if (!res?.ok) {
    console.error(`failed to fetch ${url}, status: ${res?.status || "unknown"}`)
    return null
  }

  const contentType = res.headers.get("content-type")

  if (!contentType?.includes("text")) {
    return null
  }

  if (!contentType.includes("html")) {
    return null
  }

  const html = await res.text()

  const browser = new Browser({
    settings: {
      disableJavaScriptFileLoading: true,
      disableJavaScriptEvaluation: true,
      disableCSSFileLoading: true,
      timer: {
        maxTimeout: 3000,
        maxIntervalTime: 3000,
      },
    },
  })

  try {
    const page = browser.newPage()

    page.url = url
    page.content = html

    await page.waitUntilComplete()

    const result = fn(page.mainFrame.window as any, ...fnArgs)
    await browser.close()
    return result
  } catch (error) {
    await browser.close()
    console.error(url, error)
    return null
  }
}
