import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

// Does content/<collection>/ hold at least one entry (one folder per entry)? A site that removed
// the demo articles and publishes none yet keeps the collection on with an empty folder: the specs
// that need real entries skip, and must be rewritten for the site's own entries once it has some.
export function hasEntries(collection: string): boolean {
    const root = path.join(process.cwd(), "content", collection);
    return existsSync(root) && readdirSync(root, { withFileTypes: true }).some((d) => d.isDirectory());
}
