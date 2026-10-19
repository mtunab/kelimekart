import { createRequire } from "node:module";
import { config } from "dotenv";

// Testler yalnızca DEV ortamının bilgilerini okur; prod dosyası (.env.prod.local) asla yüklenmez.
config({ path: ".env.local", quiet: true });

// Ev ağındaki aralıklı DNS hatalarına karşı (yalnızca testlerde).
createRequire(import.meta.url)("../scripts/flaky-network.cjs");
