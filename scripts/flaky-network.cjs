/**
 * SADECE TEST/GELİŞTİRME: kararsız ev ağına karşı iki önlem (DNS hafızası + fetch yeniden deneme).
 * Ev modemi DNS sorgularını ara ara reddettiğinde (ENOTFOUND / EAI_AGAIN) testler
 * rastgele düşmesin diye, daha önce başarıyla çözülmüş adresi tekrar kullanır.
 * Üretimde (Vercel) yüklenmez; yalnızca vitest kurulumu ve Playwright sunucusu yükler.
 */
const dns = require("node:dns");

const originalLookup = dns.lookup;
const cache = new Map();

function patchedLookup(hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  const opts = typeof options === "number" ? { family: options } : options || {};
  const key = `${hostname}|${opts.family || 0}|${opts.all ? 1 : 0}`;

  originalLookup.call(dns, hostname, opts, (error, address, family) => {
    if (!error) {
      cache.set(key, [address, family]);
      return callback(null, address, family);
    }
    const cached = cache.get(key);
    if (cached && (error.code === "ENOTFOUND" || error.code === "EAI_AGAIN")) {
      return callback(null, cached[0], cached[1]);
    }
    return callback(error, address, family);
  });
}

dns.lookup = patchedLookup;

/**
 * Ağ hatasında (bağlantı kurulamadı / zaman aşımı) fetch isteğini birkaç kez yeniden dener.
 * Sunucudan cevap gelmişse (HTTP hata kodu dahil) yeniden denemez.
 * Gövdesi akış (stream) olan istekler yeniden denenemez; onlara dokunmaz.
 */
const originalFetch = globalThis.fetch;
if (originalFetch && !originalFetch.__kkRetry) {
  const retryingFetch = async (input, init) => {
    const body = init && init.body;
    const replayable =
      body === undefined ||
      body === null ||
      typeof body === "string" ||
      body instanceof URLSearchParams;
    const isRequestWithBody =
      typeof Request !== "undefined" && input instanceof Request && input.body;
    if (!replayable || isRequestWithBody) return originalFetch(input, init);

    let lastError;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await originalFetch(input, init);
      } catch (error) {
        if (init && init.signal && init.signal.aborted) throw error;
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
    throw lastError;
  };
  retryingFetch.__kkRetry = true;
  globalThis.fetch = retryingFetch;
}
