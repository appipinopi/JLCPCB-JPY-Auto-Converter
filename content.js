const CACHE_TIME = 8 * 60 * 60 * 1000;

async function getRate() {
  const data = await chrome.storage.local.get(['apiKey', 'rate', 'timestamp']);
  const now = Date.now();

  if (!data.apiKey) {
    console.log("APIキーが設定されていません。拡張機能のオプションから設定してください。");
    return null;
  }

  // キャッシュが有効ならそれを使う
  if (data.rate && (now - data.timestamp < CACHE_TIME)) {
    return data.rate;
  }

  try {
    const res = await fetch(`https://api.forexrateapi.com/v1/latest?api_key=${data.apiKey}&base=USD&currencies=JPY`);
    const json = await res.json();
    if (!json.rates) throw new Error("API Error");
    
    const newRate = json.rates.JPY * 1.02; // 手数料2.0%
    await chrome.storage.local.set({ rate: newRate, timestamp: now });
    return newRate;
  } catch (e) {
    console.error("レート取得失敗:", e);
    return data.rate || 162.0; 
  }
}

function convertPrices(rate) {
  if (!rate) return;
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let n;
  while(n = walk.nextNode()) {
    const text = n.nodeValue;
    const newText = text.replace(/(?:US\s*)?\$?\s*(\d+\.\d+)\s*(?:ドル)?/g, (match, p1) => {
      const num = parseFloat(p1);
      const jpy = num * rate;
      const displayJpy = jpy < 10 ? jpy.toFixed(2) : Math.round(jpy).toLocaleString();
      return `¥${displayJpy} (${match.trim()})`;
    });
    if (text !== newText) n.nodeValue = newText;
  }
}

// 実行
getRate().then(rate => {
  if (rate) {
    convertPrices(rate);
    const observer = new MutationObserver(() => convertPrices(rate));
    observer.observe(document.body, { childList: true, subtree: true });
  }
});
