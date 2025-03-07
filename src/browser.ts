import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { chromium, type Page } from "playwright-core";
import { findBrowser } from "./find-browser";
import { domFetchAndEvaluate } from "./dom";

type BrowserOptions = {
  show?: boolean;
  browser?: string;
  proxy?: string;
  executablePath?: string;
  profilePath?: string;
};

export type BrowserMethods = {
  close: () => Promise<void>;
  withPage: <T>(fn: (page: Page) => T | Promise<T>) => Promise<T>;
  evaluateOnPage: <T extends any[], R>(
    url: string,
    fn: (window: Window, ...args: T) => R,
    fnArgs: T,
  ) => Promise<R | null>;
};

export const launchBrowser = async (
  options: BrowserOptions
): Promise<BrowserMethods> => {
  const userDataDir = options.profilePath
    ? path.dirname(options.profilePath)
    : path.join(os.tmpdir(), "local-web-search-user-dir-temp");

  // Create user data directory if it doesn't exist
  if (!fs.existsSync(userDataDir)) {
    const defaultPreferences = {
      plugins: {
        always_open_pdf_externally: true,
      },
    };

    const defaultProfileDir = path.join(userDataDir, "Default");
    fs.mkdirSync(defaultProfileDir, { recursive: true });

    fs.writeFileSync(
      path.join(defaultProfileDir, "Preferences"),
      JSON.stringify(defaultPreferences)
    );
  }

  // Launch browser with persistent context
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: options.executablePath || findBrowser(options.browser).executable,
    headless: !options.show,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-site-isolation-trials",
    ],
    proxy: options.proxy ? { server: options.proxy } : undefined,
  });

  return {
    close: async () => {
      await context.close();
    },
    withPage: async <T>(fn: (page: Page) => T | Promise<T>): Promise<T> => {
      const page = await context.newPage();
      try {
        await applyStealthTechniques(page);
        return await fn(page);
      } finally {
        await page.close();
      }
    },
    evaluateOnPage: async <T extends any[], R>(
      url: string,
      fn: (window: Window, ...args: T) => R,
      fnArgs: T,
    ): Promise<R | null> => {
      const page = await context.newPage();
      try {
        await applyStealthTechniques(page);
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });

        // Convert the function to a string to pass to evaluate
        const fnString = fn.toString();
        const argsString = JSON.stringify(fnArgs);

        // Use evaluate to run the function in the browser context
        const result = await page.evaluate(`
          (function() {
            const fn = ${fnString};
            const args = ${argsString};
            return fn(window, ...args);
          })()
        `);

        return result;
      } catch (error) {
        console.error(`Error evaluating on page ${url}:`, error);
        return null;
      } finally {
        await page.close();
      }
    }
  };
};

async function applyStealthTechniques(page: Page) {
  // Override navigator.webdriver
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });

    // Add other stealth techniques
    const originalQuery = window.navigator.permissions.query;
    // @ts-ignore
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );

    // Overwrite the `plugins` property to use a custom getter.
    Object.defineProperty(navigator, 'plugins', {
      // This just needs to have `length > 0` for the current purpose.
      get: () => [1, 2, 3, 4, 5],
    });

    // Overwrite the `languages` property to use a custom getter.
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });
}
