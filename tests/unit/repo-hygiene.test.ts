import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("depo güvenliği", () => {
  it(".env dosyaları git'e girmez, sadece .env.example girer", () => {
    const gitignore = readFileSync(path.join(root, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^\.env\*$/m);
    expect(gitignore).toMatch(/^!\.env\.example$/m);
  });

  it(".env.example gerçek anahtar içermez", () => {
    const example = readFileSync(path.join(root, ".env.example"), "utf8");
    expect(example).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/); // JWT biçimli anahtar
    expect(example).not.toMatch(/sb_(secret|publishable)_[A-Za-z0-9_-]{10,}/);
  });

  it("gizli anahtar hiçbir NEXT_PUBLIC_ değişkeninde kullanılmaz", () => {
    const files = readdirSync(path.join(root, "src"), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
      .map((entry) => path.join(entry.parentPath, entry.name));
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content, file).not.toMatch(/NEXT_PUBLIC_\w*(SERVICE|SECRET)/);
      expect(content, file).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    }
  });

  it("migration dosyaları zaman damgalı ve sıralı adlandırılır", () => {
    const names = readdirSync(path.join(root, "supabase", "migrations")).filter((n) =>
      n.endsWith(".sql"),
    );
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    expect([...names].sort()).toEqual(names);
  });
});

describe("ortam dosyaları", () => {
  it("Next.js'in kendiliğinden okuyacağı prod/dev ortam dosyası yok", () => {
    // .env.production(.local) olsaydı `next build`/`next start` dev yerine prod'a bağlanırdı.
    const autoLoaded = [".env", ".env.production", ".env.production.local", ".env.development"];
    const present = readdirSync(root).filter((name) => autoLoaded.includes(name));
    expect(present).toEqual([]);
  });
});
