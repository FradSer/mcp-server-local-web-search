#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Queue from "p-queue";
import { launchBrowser } from "./local-web-search/src/browser.js";
import { getSearchPageLinks } from "./local-web-search/src/extract.js";
import { getReadabilityScript } from "./local-web-search/src/macro.js" with { type: "macro" };
import { toMarkdown } from "./local-web-search/src/to-markdown.js";
import { shouldSkipDomain } from "./local-web-search/src/utils.js";


interface SearchResult {
  title: string;
  url: string;
  description?: string;
  content?: string;
}

interface SearchOptions {
  query: string;
  maxResults?: number;
  excludeDomains?: string[];
  truncate?: number;
}

function getSearchUrl(options: SearchOptions): string {
  const searchParams = new URLSearchParams({
    q: `${
      options.excludeDomains?.length
        ? `${options.excludeDomains.map(domain => `-site:${domain}`).join(" ")} `
        : ""
    }${options.query}`,
    num: `${options.maxResults || 10}`,
    udm: "14" // web tab
  });

  return `https://www.google.com/search?${searchParams.toString()}`;
}

async function search(query: string, limit: number = 10, excludeDomains: string[] = [], truncate?: number): Promise<SearchResult[]> {
  const browser = await launchBrowser({ type: "fake" });
  const queue = new Queue({ concurrency: 15 });
  const visitedUrls = new Set<string>();

  try {
    const url = getSearchUrl({ query, maxResults: limit, excludeDomains });
    let links = await browser.evaluateOnPage(url, getSearchPageLinks, []);
    
    links = links?.filter(link => {
      if (visitedUrls.has(link.url)) return false;
      visitedUrls.add(link.url);
      return !shouldSkipDomain(link.url);
    }) || [];

    if (!links || links.length === 0) {
      return [];
    }

    const readabilityScript = await getReadabilityScript();
    const results = await Promise.allSettled(
      links.map(link => 
        queue.add(async (): Promise<SearchResult> => {
          try {
            const result = await browser.evaluateOnPage(
              link.url,
              (window, readabilityScript) => {
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
                  .forEach(el => el.remove());

                const article = new Readability(document).parse();
                const content = article?.content || "";
                const title = document.title;

                return { content, title: article?.title || title };
              },
              [readabilityScript]
            );

            if (!result) {
              return {
                title: link.title || '',
                url: link.url || '',
              };
            }

            const content = toMarkdown(result.content);
            return {
              title: result.title || link.title || '',
              url: link.url || '',
              content: truncate ? content.slice(0, truncate) : content,
              description: content.slice(0, 200) // Short preview as description
            };
          } catch (error) {
            console.error(`Error fetching content for ${link.url}:`, error);
            return {
              title: link.title || '',
              url: link.url || '',
            };
          }
        })
      )
    );

    return results
      .filter((result): result is PromiseFulfilledResult<SearchResult> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);

  } finally {
    await browser.close();
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
      limit: {
        type: "number",
        description: "Maximum number of results to return (default: 20)",
        default: 20
      }
    },
    required: ["query"]
  }
};

// Type guard for search arguments
function isLocalWebSearchArgs(args: unknown): args is { query: string; limit?: number } {
  return (
    typeof args === "object" &&
    args !== null &&
    "query" in args &&
    typeof (args as { query: string }).query === "string"
  );
}

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

        const { query, limit = 10 } = args;
        const results = await search(query, limit);

        const formattedResults = results.map(result => 
          `Title: ${result.title}\nURL: ${result.url}${result.description ? `\nDescription: ${result.description}` : ''}`
        ).join('\n\n');

        return {
          content: [{ type: "text", text: formattedResults || "No results found" }],
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
