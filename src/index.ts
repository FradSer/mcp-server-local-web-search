#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { chromium } from 'playwright-core';

/**
 * Interface for search parameters
 */
interface SearchParams {
  query: string;
  excludeDomains?: string[];
  limit?: number;
  truncate?: number;
  show?: boolean;
  proxy?: string;
}

/**
 * Interface for search results
 */
type SearchResult = {
  title: string;
  url: string;
  content?: string;
};

/**
 * Get Google search URL with parameters
 */
function getSearchUrl(options: SearchParams) {
  const searchParams = new URLSearchParams({
    q: options.query,
    num: `${options.limit || 10}`,
    hl: 'zh-CN',
    gl: 'cn',
    start: '0',
  });

  // Exclude domains if specified
  if (options.excludeDomains && options.excludeDomains.length > 0) {
    const excludeSites = options.excludeDomains.map(domain => `-site:${domain}`).join(' ');
    searchParams.set('q', `${excludeSites} ${options.query}`);
  }

  return `https://www.google.com/search?${searchParams.toString()}`;
}

/**
 * Execute web search using browser
 */
async function executeWebSearch(params: SearchParams): Promise<SearchResult[]> {
  console.error('Starting search with params:', params);
  
  const browserType = chromium;
  let browser;
  try {
    browser = await browserType.launch({
      headless: !params.show,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      proxy: params.proxy ? {
        server: params.proxy
      } : undefined
    });
    console.error('Browser launched successfully');

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'zh-CN',
      geolocation: { longitude: 114.3162, latitude: 30.5815 }, // Wuhan coordinates
      permissions: ['geolocation']
    });
    console.error('Browser context created');
    
    const page = await context.newPage();
    console.error('New page created');

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    });
    
    const url = getSearchUrl(params);
    console.error('Navigating to URL:', url);
    
    const response = await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    
    if (!response) {
      throw new Error('Failed to get response from page');
    }
    
    console.error('Page loaded with status:', response.status());
    
    // Wait for search results to load and handle potential Google consent form
    await page.waitForLoadState('domcontentloaded');
    console.error('Page DOM content loaded');
    
    // Handle consent form if it appears
    const consentButton = await page.$('button[aria-label="同意使用 Cookie"]');
    if (consentButton) {
      console.error('Found consent button, clicking...');
      await consentButton.click();
      await page.waitForLoadState('networkidle');
    }
    
    // Wait for search results with increased timeout
    console.error('Waiting for search results...');
    const resultsPresent = await page.waitForSelector('.g', { timeout: 60000 })
      .then(() => true)
      .catch(() => {
        console.error('Failed to find .g selector');
        return false;
      });
      
    if (!resultsPresent) {
      console.error('No search results found after waiting');
      // Try alternative selectors
      const altSelectors = ['div[data-hveid]', 'div.yuRUbf', '#search'];
      for (const selector of altSelectors) {
        console.error(`Trying alternative selector: ${selector}`);
        const found = await page.$(selector);
        if (found) {
          console.error(`Found results with selector: ${selector}`);
          break;
        }
      }
      
      // Try to get page content for debugging
      const pageContent = await page.content();
      console.error('Page content:', pageContent.slice(0, 1000));
      
      // Take a screenshot for debugging
      if (params.show) {
        await page.screenshot({ path: 'debug-screenshot.png' });
        console.error('Screenshot saved as debug-screenshot.png');
      }
      
      return [];
    }
    
    const links = await page.evaluate(() => {
      const results: Array<{title: string, url: string}> = [];
      document.querySelectorAll('.g').forEach((el) => {
        const titleEl = el.querySelector('h3');
        const linkEl = el.querySelector('a');
        const url = linkEl?.getAttribute('href');
        
        if (titleEl && url && url.startsWith('http')) {
          results.push({
            title: titleEl.textContent || '',
            url: url
          });
        }
      });
      return results;
    });

    console.error('Found links:', links.length);
    if (!links || links.length === 0) {
      return [];
    }

    // Limit the number of results
    const limitedLinks = links.slice(0, params.limit || 10);
    console.error('Processing', limitedLinks.length, 'links');

    // Process each link to extract content
    const results = await Promise.all(
      limitedLinks.map(async (item, index) => {
        try {
          console.error(`Processing link ${index + 1}/${limitedLinks.length}: ${item.url}`);
          const page = await context.newPage();
          const response = await page.goto(item.url, { 
            timeout: 30000,
            waitUntil: 'networkidle'
          });
          
          if (!response) {
            throw new Error('Failed to get response');
          }
          
          console.error(`Link ${index + 1} loaded with status:`, response.status());
          const content = await page.evaluate(() => document.body.innerText);
          await page.close();
          return {
            ...item,
            content: params.truncate ? content.slice(0, params.truncate) : content
          } as SearchResult;
        } catch (error) {
          console.error(`Error visiting ${item.url}:`, error);
          return null;
        }
      })
    );

    const validResults = results.filter((result): result is SearchResult => result !== null);
    console.error('Successfully processed', validResults.length, 'results');
    
    // Close browser after all operations are complete
    await browser.close();
    console.error('Browser closed');
    
    return validResults;
  } catch (error) {
    console.error('Search error:', error);
    if (browser) {
      await browser.close();
      console.error('Browser closed after error');
    }
    return [];
  }
}

// Define the local web search tool
const LOCAL_WEB_SEARCH_TOOL: Tool = {
  name: "local_web_search",
  description: "Performs web search and returns results with title, URL and description.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query to find relevant content"
      },
      excludeDomains: {
        type: "array",
        items: {
          type: "string"
        },
        description: "List of domains to exclude from search results",
        default: []
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return (default: 100)",
        default: 100
      },
      truncate: {
        type: "number",
        description: "Maximum length of content to return per result (default: 4000)",
        default: 4000
      },
      show: {
        type: "boolean",
        description: "Show browser window for debugging (default: false)",
        default: false
      },
      proxy: {
        type: "string",
        description: "Proxy server to use for requests",
        default: ""
      }
    },
    required: ["query"]
  }
};

// Server implementation
const server = new Server(
  {
    name: "local-web-search",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

function isLocalWebSearchArgs(args: unknown): args is SearchParams {
  return (
    typeof args === "object" &&
    args !== null &&
    "query" in args &&
    typeof (args as { query: string }).query === "string"
  );
}

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [LOCAL_WEB_SEARCH_TOOL],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error("No arguments provided");
    }

    switch (name) {
      case "local_web_search": {
        if (!isLocalWebSearchArgs(args)) {
          throw new Error("Invalid arguments for local_web_search");
        }

        const results = await executeWebSearch(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ results })
            }
          ],
          isError: false,
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Run server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Local Web Search MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
