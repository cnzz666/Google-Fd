addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const DEFAULT_UA = "Mozilla/5.0 (Linux; Android 9; V1901A Build/P00610) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.200 Mobile Safari/537.36 VivoBrowser/29.3.3.0";

// 悬浮状态栏注入逻辑（采用点击穿透技术，防止阻挡或干扰 reCAPTCHA 验证）
const statusBarInjection = `
(function() {
  function injectBar() {
    if (document.getElementById('__GOOGLE_MIRROR_STATUS_BAR__')) return;
    const bar = document.createElement('div');
    bar.id = '__GOOGLE_MIRROR_STATUS_BAR__';
    bar.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:30px;line-height:30px;background:#202124;color:#f1f3f4;text-align:center;font-size:12px;z-index:2147483647;box-shadow:0 2px 5px rgba(0,0,0,0.2);user-select:none;font-family:sans-serif;font-weight:bold;pointer-events:none;opacity:0.95;border-bottom:1px solid #3c4043;';
    bar.innerHTML = '<span style="pointer-events:auto;">Google镜像站 g.sakcn.icu提供知识搜索，请勿用于违法用途。</span>';
    document.body.appendChild(bar);
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    injectBar();
  } else {
    window.addEventListener('DOMContentLoaded', injectBar);
  }
})();
`;

// 控制台主页模板
const configPageHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google镜像</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f6f9; color: #333; padding: 20px; display: flex; flex-direction: column; align-items: center; }
        .card { background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); width: 100%; max-width: 500px; margin-top: 40px; }
        h1 { font-size: 20px; color: #1a73e8; text-align: center; margin-bottom: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; font-size: 13px; font-weight: bold; margin-bottom: 6px; color: #5f6368; }
        input[type="text"], select, textarea { width: 100%; padding: 10px; border: 1px solid #dadce0; border-radius: 6px; font-size: 14px; background: #fafafa; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #1a73e8; background: #fff; }
        textarea { resize: vertical; height: 60px; font-family: monospace; font-size: 12px; }
        button { width: 100%; padding: 12px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; transition: background 0.2s; margin-top: 10px; }
        button:hover { background: #1557b0; }
        .tips { max-width: 500px; margin-top: 25px; font-size: 13px; color: #70757a; line-height: 1.6; }
        .tips strong { color: #d93025; }
    </style>
</head>
<body>
<div class="card">
    <h1>Google镜像</h1>
    <div class="form-group">
        <label>1. 选择反代方向</label>
        <select id="targetNode">
            <option value="google.com.hk">google.com.hk (最稳定)</option>
            <option value="google.com">google.com</option>
            <option value="ipv4.google.com">ipv4.google.com</option>
            <option value="ipv6.google.com">ipv6.google.com</option>
        </select>
    </div>
    <div class="form-group">
        <label>2. 自定义 User-Agent 注入</label>
        <input type="text" id="uaInput" value="${DEFAULT_UA}">
    </div>
    <div class="form-group">
        <label>3. 语言与地域修改 (Accept-Language)</label>
        <select id="langInput">
            <option value="zh-CN,zh;q=0.9,en;q=0.8">zh-CN (简体中文)</option>
            <option value="zh-TW,zh;q=0.9,en;q=0.8">zh-TW (繁体中文)</option>
            <option value="en-US,en;q=0.9">en-US (美式英文)</option>
        </select>
    </div>
    <div class="form-group">
        <label>4. 全局 Cookie 预注入</label>
        <textarea id="cookieInput" placeholder="可留空，或填入预设的谷歌身份凭证 Cookie..."></textarea>
    </div>
    <button onclick="saveAndGo()">进入 Google</button>
</div>
<div class="tips">
    <p>💡 <strong>使用须知：</strong> 本站提供合法的学术研究与公网知识检索代理，请勿用于任何违反当地法律法规的用途。</p>
</div>
<script>
function saveAndGo() {
    const node = document.getElementById('targetNode').value;
    const ua = document.getElementById('uaInput').value.trim();
    const lang = document.getElementById('langInput').value;
    const cookieInject = document.getElementById('cookieInput').value.trim();

    const exp = "; expires=" + new Date(Date.now() + 30*24*60*60*1000).toUTCString() + "; path=/";
    document.cookie = "__PROXY_TARGET_NODE__=" + encodeURIComponent(node) + exp;
    document.cookie = "__CF_PROXY_UA__=" + encodeURIComponent(ua) + exp;
    document.cookie = "__CF_PROXY_LANG__=" + encodeURIComponent(lang) + exp;
    document.cookie = "__CF_PROXY_INJECT_COOKIE__=" + encodeURIComponent(cookieInject) + exp;

    window.location.href = "/";
}
function loadSaved() {
    const getC = (k) => { var m = RegExp(k + "=[^;]+").exec(document.cookie); return m ? decodeURIComponent(m[0].replace(/^[^=]+./, "")) : ""; };
    if(getC("__PROXY_TARGET_NODE__")) document.getElementById('targetNode').value = getC("__PROXY_TARGET_NODE__");
    if(getC("__CF_PROXY_UA__")) document.getElementById('uaInput').value = getC("__CF_PROXY_UA__");
    if(getC("__CF_PROXY_LANG__")) document.getElementById('langInput').value = getC("__CF_PROXY_LANG__");
    if(getC("__CF_PROXY_INJECT_COOKIE__")) document.getElementById('cookieInput').value = getC("__CF_PROXY_INJECT_COOKIE__");
}
loadSaved();
</script>
</body>
</html>
`;

async function handleRequest(request) {
  const url = new URL(request.url);
  const cookieHeader = request.headers.get('Cookie') || "";

  // 基础系统路径过滤
  if (url.pathname === "/favicon.ico") return fetch("https://www.google.com/favicon.ico");
  if (url.pathname === "/robots.txt") return new Response("User-Agent: *\nDisallow: /", { headers: { "Content-Type": "text/plain" } });
  if (url.pathname === "/__config__") return new Response(configPageHTML, { headers: { "Content-Type": "text/html;charset=utf-8" } });

  // 提取配置状态
  let targetNode = getCookieValue("__PROXY_TARGET_NODE__", cookieHeader);
  let customUA = getCookieValue("__CF_PROXY_UA__", cookieHeader) || DEFAULT_UA;
  let customLang = getCookieValue("__CF_PROXY_LANG__", cookieHeader) || "zh-CN,zh;q=0.9,en;q=0.8";
  let customCookie = getCookieValue("__CF_PROXY_INJECT_COOKIE__", cookieHeader) || "";

  // 首次访问或未配置时引导至控制台
  if (!targetNode && url.pathname === "/") {
    return new Response(configPageHTML, { headers: { "Content-Type": "text/html;charset=utf-8" } });
  }
  if (!targetNode) targetNode = "google.com.hk"; // 隐式缺省配置

  // 核心上游目标构建
  let upstreamHost = targetNode;
  let upstreamPathname = url.pathname;

  // 针对静态资产加速域名(gstatic)做子路径特征提取，确保不脱离单域名代理范畴
  if (url.pathname.startsWith("/__gstatic__/")) {
    upstreamHost = "www.gstatic.com";
    upstreamPathname = url.pathname.replace("/__gstatic__/", "/");
  }

  const targetURL = new URL(`https://${upstreamHost}${upstreamPathname}${url.search}`);

  // 严格安全锁：拒绝非谷歌授信域名的代理请求
  const lowerHost = targetURL.host.toLowerCase();
  const isGoogleDomain = lowerHost.endsWith('google.com') || 
                         lowerHost.endsWith('google.com.hk') || 
                         lowerHost.endsWith('gstatic.com') || 
                         lowerHost.endsWith('googleusercontent.com') ||
                         lowerHost.endsWith('ggpht.com');

  if (!isGoogleDomain) {
    return new Response("<h1>403 Forbidden</h1><hr><p>该镜像站仅被允许代理 Google 相关授信服务域。</p>", {
      status: 403,
      headers: { "Content-Type": "text/html;charset=utf-8" }
    });
  }

  // 构造并清洗请求头
  let newHeaders = new Headers();
  request.headers.forEach((value, key) => {
    let rewrittenVal = value.replaceAll(url.origin, `https://${targetNode}`);
    newHeaders.set(key, rewrittenVal);
  });

  // 指纹重塑注入
  newHeaders.set("User-Agent", customUA);
  newHeaders.set("Accept-Language", customLang);
  newHeaders.set("Host", upstreamHost);

  if (customCookie) {
    let currentCookies = newHeaders.get("Cookie") || "";
    newHeaders.set("Cookie", currentCookies ? `${currentCookies}; ${customCookie}` : customCookie);
  }

  // 发起上游请求
  const response = await fetch(new Request(targetURL, {
    method: request.method,
    headers: newHeaders,
    body: request.body,
    redirect: "manual"
  }));

  // 处理 3xx 重定向冲突
  if (response.status >= 300 && response.status < 400) {
    let location = response.headers.get("Location");
    if (location) {
      let absoluteLocation = new URL(location, targetURL.href);
      let redirectUrl = absoluteLocation.href
        .replaceAll(`https://${targetNode}`, url.origin)
        .replaceAll(`https://www.google.com`, url.origin)
        .replaceAll(`https://google.com.hk`, url.origin)
        .replaceAll(`https://www.gstatic.com`, `${url.origin}/__gstatic__`);
      
      let redirectHeaders = new Headers(response.headers);
      redirectHeaders.set("Location", redirectUrl);
      return new Response(null, { status: response.status, headers: redirectHeaders });
    }
  }

  // 处理响应体文本映射与动态注入
  const contentType = response.headers.get("Content-Type") || "";
  let responseInit = { status: response.status, headers: new Headers(response.headers) };
  
  // 移除安全策略响应头，保障代理资源加载连贯性
  responseInit.headers.delete("Content-Security-Policy");
  responseInit.headers.delete("X-Frame-Options");

  if (contentType.includes("text/html") || contentType.includes("application/json") || contentType.includes("application/javascript")) {
    let text = await response.text();

    // 动态静态资源映射规则转换
    text = text.replaceAll(`https://${targetNode}`, url.origin)
               .replaceAll(`https://www.google.com`, url.origin)
               .replaceAll(`https://google.com.hk`, url.origin)
               .replaceAll(`https://www.gstatic.com`, `${url.origin}/__gstatic__`);

    // 如果为 HTML 文档，则注入防遮挡型状态栏
    if (contentType.includes("text/html")) {
      const headIndex = text.indexOf("<head>");
      if (headIndex !== -1) {
        text = text.substring(0, headIndex + 6) + `<script>${statusBarInjection}</script>` + text.substring(headIndex + 6);
      } else {
        text = text + `<script>${statusBarInjection}</script>`;
      }
    }

    return new Response(text, responseInit);
  }

  return new Response(response.body, responseInit);
}

function getCookieValue(name, cookies) {
  let matches = RegExp(name + "=[^;]+").exec(cookies);
  return matches ? decodeURIComponent(matches[0].replace(/^[^=]+./, "")) : "";
}