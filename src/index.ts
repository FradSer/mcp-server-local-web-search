#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { launchBrowser, type BrowserMethods } from "./browser.js";
import { getSearchPageLinks } from "./extract.js";
import { getReadabilityScript } from "./macro.js";
import { toMarkdown } from "./to-markdown.js";

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
interface SearchResult {
  title: string;
  url: string;
  content?: string;
}

/**
 * Get Google search URL with parameters
 */
function getSearchUrl(options: SearchParams) {
  const searchParams = new URLSearchParams({
    q: `${
      options.excludeDomains && options.excludeDomains.length > 0
        ? `${options.excludeDomains.map((domain) => `-site:${domain}`).join(" ")} `
        : ""
    }${options.query}`,
    num: `${options.limit || 10}`,
  });

  // web tab
  searchParams.set("udm", "14");

  return `https://www.google.com/search?${searchParams.toString()}`;
}

/**
 * Execute web search using browser
 */
async function executeWebSearch(params: SearchParams): Promise<SearchResult[]> {
  const browser = await launchBrowser({
    show: params.show,
    proxy: params.proxy,
  });

  try {
    const url = getSearchUrl(params);
    const links = await browser.withPage(async (page) => {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
      });
      return await page.evaluate(getSearchPageLinks);
    });

    if (!links || links.length === 0) {
      return [];
    }

    // Limit the number of results
    const limitedLinks = links.slice(0, params.limit || 10);

    // Process each link to extract content
    const results = await Promise.all(
      limitedLinks.map((item) => visitLink(browser, item.url, params.truncate))
    );

    return results.filter((result): result is SearchResult => result !== null);
  } finally {
    await browser.close();
  }
}

/**
 * Visit a link and extract content
 */
async function visitLink(
  browser: BrowserMethods,
  url: string,
  truncate?: number
): Promise<SearchResult | null> {
  try {
    const result = await browser.withPage(async (page) => {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Use Readability to extract the main content
      const readabilityScript = await getReadabilityScript();
      return await page.evaluate(
        ([readabilityScript, truncateLength]) => {
          const Readability = new Function(
            "module",
            `${readabilityScript}\nreturn module.exports`
          )({});

          const document = window.document;
          const selectorsToRemove = [
            "script,noscript,style,link,svg,img,video,iframe,canvas",
            ".reflist", // wikipedia refs
          ];
          document
            .querySelectorAll(selectorsToRemove.join(","))
            .forEach((el) => el.remove());

          const article = new Readability(document).parse();
          const content = article?.content || "";
          const title = document.title;

          return {
            content: truncateLength ? content.slice(0, truncateLength) : content,
            title: article?.title || title,
          };
        },
        [readabilityScript, truncate]
      );
    });

    if (!result) return null;

    const content = toMarkdown(result.content);
    return { ...result, url, content };
  } catch (error) {
    console.error(`Error visiting ${url}:`, error);
    return null;
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
        description: "Maximum number of results to return (default: 5)",
        default: 5
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
