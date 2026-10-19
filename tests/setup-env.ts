import { config } from "dotenv";

// Testler yalnızca DEV ortamının bilgilerini okur; prod dosyası (.env.production.local) asla yüklenmez.
config({ path: ".env.local", quiet: true });
