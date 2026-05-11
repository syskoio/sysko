import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export const dashboardAssetsPath: string = resolve(here, "..", "dist-client");
