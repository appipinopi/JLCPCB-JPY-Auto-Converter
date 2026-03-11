const API_KEY = '94e217a3a1b0395b058c8bc83aef1920';
const CACHE_TIME = 8 * 60 * 60 * 1000;

async function getRate() {
  const data = await chrome.storage.local.get(['rate', 'timestamp']);
  const now = Date.now();

  if (data.rate && (now - data.timestamp < CACHE_TIME)) {
    return data.rate;
  }

  try {
    const res = await fetch(`https://api.forexrateapi.com/v1/latest?api_key=${API_KEY}&base=USD&currencies=JPY`);
    const json = await res.json();
    const newRate = json.rates.JPY * 1.02; // 手数料2%込
    await chrome.storage.local.set({ rate: newRate, timestamp: now });
    return newRate;
  } catch (e) {
    return data.rate || 162.0; // 失敗時は前回のキャッシュか固定値
  }
}

function convertPrices(rate) {
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let n;
  while(n = walk.nextNode()) {
    const text = n.nodeValue;
    // $0.00 や 0.00ドル の形式を正規表現で探す
    const newText = text.replace(/(?:US\s*)?\$?\s*(\d+\.\d+)\s*(?:ドル)?/g, (match, p1) => {
      const num = parseFloat(p1);
      const jpy = num * rate;
      const displayJpy = jpy < 10 ? jpy.toFixed(2) : Math.round(jpy).toLocaleString();
      return `¥${displayJpy} (${match.trim()})`;
    });
    if (text !== newText) n.nodeValue = newText;
  }
}

// ページ読み込み時と、動的な変化（スクロール等）に対応
getRate().then(rate => {
  convertPrices(rate);
  
  // JLCPCBは動的に要素が増えるため、監視を続ける
  const observer = new MutationObserver(() => convertPrices(rate));
  observer.observe(document.body, { childList: true, subtree: true });
});
