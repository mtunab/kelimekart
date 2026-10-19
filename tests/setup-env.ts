import { config } from "dotenv";

// Testler yalnızca DEV ortamının bilgilerini okur; prod dosyası (.env.prod.local) asla yüklenmez.
config({ path: ".env.local", quiet: true });
