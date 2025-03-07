import { homedir } from "os";
import { join } from "path";

/**
 * This script is used to setup the config file for the desktop app.
 */

const CONFIG_PATH = join(
  homedir(),
  "Library/Application Support/Claude/claude_desktop_config.json"
);

let config = { mcpServers: {} };

try {
  config = await Bun.file(CONFIG_PATH).json();
} catch {
  // Config doesn't exist yet, use default empty config
}

// Get absolute paths
const bunPath = process.argv[0]; // Current bun executable
const serverPath = join(import.meta.dir, "./src/index.ts");

// Update config
config.mcpServers = {
  ...config.mcpServers,
  "local-web-search": {
    command: bunPath,
    args: [serverPath],
  },
};

// Write updated config
await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2));

console.log(
  "\x1b[32m✨ Successfully added local-web-search server to Claude MCP config! 🎉\x1b[0m"
);
console.log(CONFIG_PATH.replace(homedir(), "~"));
