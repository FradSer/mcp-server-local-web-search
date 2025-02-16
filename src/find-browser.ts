import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { BrowserNotFoundError } from "./error"

interface Browser {
  name: string
  executable: {
    win32: string
    darwin: string
  }
  userDataDir: {
    win32: string
    darwin: string
  }
}

const HOME_DIR = os.homedir()

const browsers: Browser[] = [
  {
    name: "Brave",
    executable: {
      win32:
        "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
      darwin: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    },
    userDataDir: {
      win32: `${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\User Data`,
      darwin: `${HOME_DIR}/Library/Application Support/BraveSoftware/Brave-Browser`,
    },
  },
  {
    name: "Chromium",
    executable: {
      win32: "C:\\Program Files\\Chromium\\Application\\chrome.exe",
      darwin: "/Applications/Chromium.app/Contents/MacOS/Chromium",
    },
    userDataDir: {
      win32: `${process.env.LOCALAPPDATA}\\Chromium\\User Data`,
      darwin: `${HOME_DIR}/Library/Application Support/Chromium`,
    },
  },
  {
    name: "Google Chrome Canary",
    executable: {
      win32:
        "C:\\Program Files\\Google\\Chrome Canary\\Application\\chrome.exe",
      darwin:
        "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    },
    userDataDir: {
      win32: `${process.env.LOCALAPPDATA}\\Google\\Chrome Canary\\User Data`,
      darwin: `${HOME_DIR}/Library/Application Support/Google/Chrome Canary`,
    },
  },
  {
    name: "Google Chrome",
    executable: {
      win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
    userDataDir: {
      win32: `${process.env.LOCALAPPDATA}\\Google\\Chrome\\User Data`,
      darwin: `${HOME_DIR}/Library/Application Support/Google/Chrome`,
    },
  },
  {
    name: "Microsoft Edge Canary",
    executable: {
      win32:
        "C:\\Program Files (x86)\\Microsoft\\Edge Canary\\Application\\msedge.exe",
      darwin:
        "/Applications/Microsoft Edge Canary.app/Contents/MacOS/Microsoft Edge Canary",
    },
    userDataDir: {
      win32: `${process.env.LOCALAPPDATA}\\Microsoft\\Edge Canary\\User Data`,
      darwin: `${HOME_DIR}/Library/Application Support/Microsoft Edge Canary`,
    },
  },
  {
    name: "Microsoft Edge",
    executable: {
      win32:
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      darwin: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    },
    userDataDir: {
      win32: `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\User Data`,
      darwin: `${HOME_DIR}/Library/Application Support/Microsoft Edge`,
    },
  },
]

export function findBrowser(name?: string) {
  const platform = process.platform

  if (platform !== "darwin" && platform !== "win32") {
    throw new BrowserNotFoundError("Unsupported platform: " + platform)
  }

  const browser = name
    ? browsers.find(
        (b) => b.name === name && fs.existsSync(b.executable[platform]),
      )
    : browsers.find((browser) => fs.existsSync(browser.executable[platform]))

  if (!browser) {
    if (name) {
      throw new BrowserNotFoundError(`Cannot find browser: ${name}`)
    }

    throw new BrowserNotFoundError(
      "Cannot find a chrome-based browser on your system, please install one of: Chrome, Edge, Brave",
    )
  }

  return {
    executable: browser.executable[platform],
    userDataDir: browser.userDataDir[platform],
  }
}

export function getBrowserProfiles(browserName?: string) {
  const browser = findBrowser(browserName)

  const profileInfo: {
    [profileName: string]: {
      name: string
    }
  } = JSON.parse(
    fs.readFileSync(path.join(browser.userDataDir, "Local State"), "utf8"),
  ).profile.info_cache

  const profiles: { displayName: string; path: string }[] = []

  for (const profileName in profileInfo) {
    const profilePath = path.join(browser.userDataDir, profileName)
    const profileDisplayName = profileInfo[profileName].name

    profiles.push({
      displayName: profileDisplayName,
      path: profilePath,
    })
  }

  return profiles
}
