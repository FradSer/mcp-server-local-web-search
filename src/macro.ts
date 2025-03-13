import fs from "node:fs"
import path from "node:path"

// const wrapModuleExports = (code: string) => {
//   return `(function(module){${code}\nreturn module.exports})({})`
// }

export const getReadabilityScript = async () => {
  try {
    // Try to use the local node_modules version if available
    const nodePath = path.join(process.cwd(), 'node_modules', '@mozilla', 'readability', 'Readability.js');
    if (fs.existsSync(nodePath)) {
      return fs.readFileSync(nodePath, 'utf-8');
    }

    // If not available, use a direct fetch from a CDN or GitHub
    const response = await fetch('https://raw.githubusercontent.com/mozilla/readability/main/Readability.js');
    if (response.ok) {
      return await response.text();
    }

    // Last resort - return a minimal implementation
    console.warn('Could not load Readability from any source, using minimal implementation');
    return `
      class Readability {
        constructor(doc) {
          this.doc = doc;
        }

        parse() {
          const title = this.doc.title || '';
          const content = this.doc.body ? this.doc.body.innerHTML : '';
          return { title, content };
        }
      }

      module.exports = { Readability };
    `;
  } catch (error) {
    console.error('Error loading Readability:', error);
    throw error;
  }
}
