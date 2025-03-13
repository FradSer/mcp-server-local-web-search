# mcp-server-local-web-search

![](https://img.shields.io/badge/A%20FRAD%20PRODUCT-WIP-yellow) [![Twitter Follow](https://img.shields.io/twitter/follow/FradSer?style=social)](https://twitter.com/FradSer)

An MCP server for performing local web searches. This server provides tools to search and extract content from web pages through the Model Context Protocol.

## Features

- Perform web searches with customizable result limits
- Extract and process content from web pages
- Return structured results with titles, URLs, and descriptions
- Support for content truncation and domain filtering
- Clean content extraction using Readability
- Headless browser operation for improved performance

## Installation

To install dependencies:

```bash
bun install
```

## Setup

Run the setup script to configure the MCP server:

```bash
bun run setup.ts
```

This will add the server to your Claude MCP configuration.

### Available Tools

1. `local_web_search`
   - Performs web search and returns results with title, URL and description
   - Parameters:
     - `query`: Search query to find relevant content (required)
     - `excludeDomains`: List of domains to exclude from search results (default: [])
     - `limit`: Maximum number of results to return (default: 5)
     - `truncate`: Maximum length of content to return per result (default: 4000)
     - `show`: Show browser window for debugging (default: false)
     - `proxy`: Proxy server to use for requests (optional)

## Requirements

- [Bun](https://bun.sh) runtime
- Node.js TypeScript support

## Development

This project uses:

- [Bun](https://bun.sh) as the JavaScript runtime
- [TypeScript](https://www.typescriptlang.org/) for type safety
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk) for server implementation
- [@egoist/local-web-search](https://github.com/egoist/local-web-search/) for web search (using playwright-core)
- [Readability](https://github.com/mozilla/readability) for content extraction

## Contributors
- [egoist](https://github.com/egoist) - Original local web search author
- [FradSer](https://github.com/FradSer) - Original author
- [TheSethRose](https://github.com/TheSethRose) - Playwright integration and performance improvements

## License

MIT License

This project was created using `bun init` in bun v1.2.2. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
