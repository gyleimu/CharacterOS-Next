/**
 * CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0 — shared product path defaults.
 *
 * The CLI and the local web product MUST agree on the default data root, or the
 * two surfaces would see different subjects. Both resolve it from THIS module
 * (compiled either from `src/` or `dist/`, both one level below the package).
 */

import { fileURLToPath } from "node:url";

export const PRODUCT_DEFAULT_DATA_ROOT_V0 = fileURLToPath(new URL("../.data", import.meta.url));

export const PRODUCT_DEFAULT_DATA_ROOT_ORIGIN_V0 = "built-in default (product/sandbox/.data)";
