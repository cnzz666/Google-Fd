addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  thisProxyServerUrlHttps = `${url.protocol}//${url.hostname}/`;
  thisProxyServerUrl_hostOnly = url.host;
  event.respondWith(handleRequest(event.request))
})

const str = "/";
const lastVisitProxyCookie = "__PROXY_VISITEDSITE__";
const replaceUrlObj = "__location__yproxy__";

var thisProxyServerUrlHttps;
var thisProxyServerUrl_hostOnly;

// 默认提供的 Vivo 稳定 UA
const DEFAULT_UA = "Mozilla/5.0 (Linux; Android 9; V1901A Build/P00610) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.200 Mobile Safari/537.36 VivoBrowser/29.3.3.0";

// 常驻状态栏注入脚本
const statusBarInjection = `
(function() {
  function injectBar() {
    if (document.getElementById('__GOOGLE_MIRROR_STATUS_BAR__')) return;
    const bar = document.createElement('div');
    bar.id = '__GOOGLE_MIRROR_STATUS_BAR__';
    bar.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:32px;line-height:32px;background:#202124;color:#f1f3f4;text-align:center;font-size:13px;z-index:2147483647;box-shadow:0 2px 6px rgba(0,0,0,0.3);user-select:none;font-family:sans-serif;font-weight:bold;letter-spacing:0.5px;border-bottom:1px solid #3c4043;';
    bar.innerHTML = 'Google镜像站 g.sakcn.icu提供知识搜索，请勿用于违法用途。';
    
    // 确保绝对不被页面自带样式覆盖
    const style = document.createElement('style');
    style.innerHTML = 'html, body { margin-top: 32px !important; }';
    document.head.appendChild(style);
    
    document.body.insertAdjacentElement('afterbegin', bar);
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    injectBar();
  } else {
    window.addEventListener('DOMContentLoaded', injectBar);
    window.addEventListener('load', injectBar);
  }
})();
`;

const httpRequestInjection = `
var nowURL = new URL(window.location.href);
var proxy_host = nowURL.host; 
var proxy_protocol = nowURL.protocol; 
var proxy_host_with_schema = proxy_protocol + "//" + proxy_host + "/"; 

Object.defineProperty(window, 'original_website_url_str', {
    get: function() { return window.location.href.substring(proxy_host_with_schema.length); }
});
Object.defineProperty(window, 'original_website_url', {
    get: function() { return new URL(original_website_url_str); }
});
Object.defineProperty(window, 'original_website_host', {
    get: function() {
        var h = original_website_url_str.substring(original_website_url_str.indexOf("://") + "://".length);
        return h.split('/')[0];
    }
});
Object.defineProperty(window, 'original_website_host_with_schema', {
    get: function() { return original_website_url_str.substring(0, original_website_url_str.indexOf("://")) + "://" + original_website_host + "/"; }
});

function changeURL(relativePath) {
    if (relativePath == null) return null;
    let relativePath_str = relativePath instanceof URL ? relativePath.href : relativePath.toString();
    try {
        if (relativePath_str.startsWith("data:") || relativePath_str.startsWith("mailto:") || relativePath_str.startsWith("javascript:") || relativePath_str.startsWith("chrome") || relativePath_str.startsWith("edge")) return relativePath_str;
    } catch { return relativePath_str; }

    var pathAfterAdd = "";
    if (relativePath_str.startsWith("blob:")) {
        pathAfterAdd = "blob:";
        relativePath_str = relativePath_str.substring("blob:".length);
    }
    try {
        let startWithLs = [proxy_host_with_schema, proxy_host + "/", proxy_host]
        startWithLs.forEach(x => { if (relativePath_str.startsWith(x)) relativePath_str = relativePath_str.substring(x.length); });
        startWithLs.forEach(x => { x = "/" + x; if (relativePath_str.startsWith(x)) relativePath_str = relativePath_str.substring(x.length); });
        let enhancedStartRm = [original_website_host_with_schema.substring(0, original_website_host_with_schema.length - 1), original_website_host]
        enhancedStartRm.forEach(x => { x = "/" + x; if (relativePath_str.startsWith(x)) relativePath_str = relativePath_str.substring(x.length); });
    } catch {}
    try {
        var absolutePath = new URL(relativePath_str, original_website_url_str).href; 
        absolutePath = absolutePath.replaceAll(window.location.href, original_website_url_str); 
        absolutePath = absolutePath.replaceAll(encodeURI(window.location.href), encodeURI(original_website_url_str));
        absolutePath = absolutePath.replaceAll(encodeURIComponent(window.location.href), encodeURIComponent(original_website_url_str));
        absolutePath = absolutePath.replaceAll(proxy_host, original_website_host);
        absolutePath = absolutePath.replaceAll(encodeURI(proxy_host), encodeURI(original_website_host));
        absolutePath = absolutePath.replaceAll(encodeURIComponent(proxy_host), encodeURIComponent(original_website_host));
        return pathAfterAdd + proxy_host_with_schema + absolutePath;
    } catch (e) { return relativePath_str; }
}

function getOriginalUrl(url) {
    if (url == null) return null;
    if (url.startsWith(proxy_host_with_schema)) return url.substring(proxy_host_with_schema.length);
    return url;
}

function networkInject() {
    var originalOpen = XMLHttpRequest.prototype.open;
    var originalFetch = window.fetch;
    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        url = changeURL(url);
        return originalOpen.apply(this, arguments);
    };
    window.fetch = function (input, init) {
        var url = (typeof input === 'string') ? input : (input instanceof Request ? input.url : input);
        url = changeURL(url);
        if (typeof input === 'string') { return originalFetch(url, init); } 
        else { return originalFetch(new Request(url, input), init); }
    };
}

function windowOpenInject() {
    const originalOpen = window.open;
    window.open = function (url, name, specs) { return originalOpen.call(window, changeURL(url), name, specs); };
}

function appendChildInject() {
    const originalAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function (child) {
        try {
            if (child.src) child.src = changeURL(child.src);
            if (child.href) child.href = changeURL(child.href);
        } catch {}
        return originalAppendChild.call(this, child);
    };
}

function elementPropertyInject() {
    const originalSetAttribute = HTMLElement.prototype.setAttribute;
    HTMLElement.prototype.setAttribute = function (name, value) {
        if (name == "src" || name == "href" || name == "action") value = changeURL(value);
        originalSetAttribute.call(this, name, value);
    };
    const originalGetAttribute = HTMLElement.prototype.getAttribute;
    HTMLElement.prototype.getAttribute = function (name) {
        const val = originalGetAttribute.call(this, name);
        if (name == "src" || name == "href" || name == "action") return getOriginalUrl(val);
        return val;
    };

    const setList = [
        [HTMLAnchorElement, "href"], [HTMLScriptElement, "src"], [HTMLImageElement, "src"],
        [HTMLLinkElement, "href"], [HTMLIFrameElement, "src"], [HTMLVideoElement, "src"],
        [HTMLAudioElement, "src"], [HTMLSourceElement, "src"], [HTMLObjectElement, "data"], [HTMLFormElement, "action"],
    ];
    for (const [whichElement, whichProperty] of setList) {
        if (!whichElement || !whichElement.prototype) continue;
        const descriptor = Object.getOwnPropertyDescriptor(whichElement.prototype, whichProperty);
        if (!descriptor) continue;
        Object.defineProperty(whichElement.prototype, whichProperty, {
            get: function () { return getOriginalUrl(descriptor.get.call(this)); },
            set: function (val) { descriptor.set.call(this, changeURL(val)); },
            configurable: true,
        });
    }
}

class ProxyLocation {
    constructor(originalLocation) { this.originalLocation = originalLocation; }
    reload(forcedReload) { this.originalLocation.reload(forcedReload); }
    replace(url) { this.originalLocation.replace(changeURL(url)); }
    assign(url) { this.originalLocation.assign(changeURL(url)); }
    get href() { return original_website_url_str; }
    set href(url) { this.originalLocation.href = changeURL(url); }
    get protocol() { return original_website_url.protocol; }
    set protocol(value) { original_website_url.protocol = value; this.originalLocation.href = proxy_host_with_schema + original_website_url.href; }
    get host() { return original_website_url.host; }
    set host(value) { original_website_url.host = value; this.originalLocation.href = proxy_host_with_schema + original_website_url.href; }
    get hostname() { return original_website_url.hostname; }
    set hostname(value) { original_website_url.hostname = value; this.originalLocation.href = proxy_host_with_schema + original_website_url.href; }
    get port() { return original_website_url.port; }
    set port(value) { original_website_url.port = value; this.originalLocation.href = proxy_host_with_schema + original_website_url.href; }
    get pathname() { return original_website_url.pathname; }
    set pathname(value) { original_website_url.pathname = value; this.originalLocation.href = proxy_host_with_schema + original_website_url.href; }
    get search() { return original_website_url.search; }
    set search(value) { original_website_url.search = value; this.originalLocation.href = proxy_host_with_schema + original_website_url.href; }
    get hash() { return original_website_url.hash; }
    set hash(value) { original_website_url.hash = value; this.originalLocation.href = proxy_host_with_schema + original_website_url.href; }
    get origin() { return original_website_url.origin; }
    toString() { return this.originalLocation.href; }
}

function documentLocationInject() {
    Object.defineProperty(document, 'URL', { get: function () { return original_website_url_str; }, set: function (url) { document.URL = changeURL(url); } });
    Object.defineProperty(document, '${replaceUrlObj}', { get: function () { return new ProxyLocation(window.location); }, set: function (url) { window.location.href = changeURL(url); } });
}

function windowLocationInject() {
    Object.defineProperty(window, '${replaceUrlObj}', { get: function () { return new ProxyLocation(window.location); }, set: function (url) { window.location.href = changeURL(url); } });
}

function historyInject() {
    const originalPushState = History.prototype.pushState;
    const originalReplaceState = History.prototype.replaceState;
    History.prototype.pushState = function (state, title, url) {
        if (!url) return;
        if (url.startsWith("/" + original_website_url.href)) url = url.substring(("/" + original_website_url.href).length);
        if (url.startsWith("/" + original_website_url.href.substring(0, original_website_url.href.length - 1))) url = url.substring(("/" + original_website_url.href).length - 1);
        return originalPushState.apply(this, [state, title, changeURL(url)]);
    };
    History.prototype.replaceState = function (state, title, url) {
        if (!url) return;
        let url_str = url.toString();
        if (url_str.startsWith("/" + original_website_url.href)) url_str = url_str.substring(("/" + original_website_url.href).length);
        if (url_str.startsWith("/" + original_website_url.href.substring(0, original_website_url.href.length - 1))) url_str = url_str.substring(("/" + original_website_url.href).length - 1);
        return originalReplaceState.apply(this, [state, title, changeURL(url_str)]);
    };
}

function obsPage() {
    var yProxyObserver = new MutationObserver(function (mutations) { mutations.forEach(function (mutation) { traverseAndConvert(mutation); }); });
    yProxyObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
}

function traverseAndConvert(node) {
    if (node instanceof HTMLElement) {
        removeIntegrityAttributesFromElement(node);
        covToAbs(node);
        node.querySelectorAll('*').forEach(function (child) { removeIntegrityAttributesFromElement(child); covToAbs(child); });
    }
}

function covToAbs(element) {
    if (!(element instanceof HTMLElement)) return;
    const attrs = ["href", "src", "action", "srcset", "poster", "data"];
    attrs.forEach(attr => {
        if (element.hasAttribute(attr)) {
            try { element.setAttribute(attr, changeURL(element.getAttribute(attr))); } catch {}
        }
    });
}

function removeIntegrityAttributesFromElement(element) { if (element.hasAttribute('integrity')) element.removeAttribute('integrity'); }
function loopAndConvertToAbs() { for (var ele of document.querySelectorAll('*')) { removeIntegrityAttributesFromElement(ele); covToAbs(ele); } }
function covScript() { var scripts = document.getElementsByTagName('script'); for (var i = 0; i < scripts.length; i++) { covToAbs(scripts[i]); } setTimeout(covScript, 3000); }

networkInject(); windowOpenInject(); elementPropertyInject(); appendChildInject(); documentLocationInject(); windowLocationInject(); historyInject();

window.addEventListener('load', () => { loopAndConvertToAbs(); obsPage(); covScript(); });
window.addEventListener('error', event => {
    var element = event.target || event.srcElement;
    if (element.tagName === 'SCRIPT' && !element.alreadyChanged) {
        removeIntegrityAttributesFromElement(element); covToAbs(element);
        var newScript = document.createElement("script");
        newScript.src = element.src; newScript.async = element.async; newScript.defer = element.defer; newScript.alreadyChanged = true;
        document.head.appendChild(newScript);
    }
}, true);
`;

const htmlCovPathInjectFuncName = "parseAndInsertDoc";
const htmlCovPathInject = `
function ${htmlCovPathInjectFuncName}(htmlString) {
  const parser = new DOMParser();
  const tempDoc = parser.parseFromString(htmlString, 'text/html');
  tempDoc.querySelectorAll('*').forEach(element => {
    covToAbs(element);
    removeIntegrityAttributesFromElement(element);
    if ((element.tagName === 'SCRIPT' || element.tagName === 'STYLE') && element.textContent && !element.src) {
        element.textContent = replaceContentPaths(element.textContent);
    }
  });
  let modifiedHtml = tempDoc.documentElement.outerHTML;
  let charset = modifiedHtml.match(/content="text\\/html;\\s*charset=[^"]*"/);
  if(charset != null && charset.length !== 0){ modifiedHtml = modifiedHtml.replace(charset[0], "content='text/html;charset=utf-8'"); }
  document.open(); document.write('<!DOCTYPE html>' + modifiedHtml); document.close();
}

function replaceContentPaths(content){
  let regex = new RegExp(\`(https?:\\\\/\\\\/[^\s'"]+)\`, 'g');
  return content.replaceAll(regex, (match) => {
    if (match.startsWith("http://www.w3.org/") || match.startsWith("https://www.w3.org/")) return match;
    return match.startsWith("http") ? proxy_host_with_schema + match : proxy_host + "/" + match;
  });
}
`;

// 主控引导配置界面
const mainPage = `
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google 镜像导航控制台</title>
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
        button { width: 100%; padding: 12px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; transition: background 0.2s; margin-top: 10px; box-shadow: 0 2px 4px rgba(26,115,232,0.2); }
        button:hover { background: #1557b0; }
        .tips { max-width: 500px; margin-top: 25px; font-size: 13px; color: #70757a; line-height: 1.6; }
        .tips strong { color: #d93025; }
    </style>
</head>
<body>
<div class="card">
    <h1>Google 镜像高级控制台</h1>
    <div class="form-group">
        <label>1. 选择反代方向 (最佳节点)</label>
        <select id="targetNode">
            <option value="google.com.hk">google.com.hk (中国香港 - 最稳定)</option>
            <option value="google.com">google.com (美国全球主站)</option>
            <option value="ipv4.google.com">ipv4.google.com (纯 IPv4 节点)</option>
            <option value="ipv6.google.com">ipv6.google.com (纯 IPv6 节点)</option>
        </select>
    </div>
    <div class="form-group">
        <label>2. 伪装 User-Agent 修改注入 (已默认优化适配)</label>
        <input type="text" id="uaInput" value="${DEFAULT_UA}">
    </div>
    <div class="form-group">
        <label>3. 目标地区语言 (Accept-Language 头修改)</label>
        <select id="langInput">
            <option value="zh-CN,zh;q=0.9,en;q=0.8">zh-CN (简体中文)</option>
            <option value="zh-TW,zh;q=0.9,en;q=0.8">zh-TW (繁体中文)</option>
            <option value="en-US,en;q=0.9">en-US (纯英文地区)</option>
        </select>
    </div>
    <div class="form-group">
        <label>4. 谷歌全局 Cookie 注入 (留空则不注入)</label>
        <textarea id="cookieInput" placeholder="例如: NID=511=xxxx; PREF=ID=xxxx:FF=0:LD=zh-CN:CR=2"></textarea>
    </div>
    <button onclick="saveAndJump()">保存配置并安全进入 Google</button>
</div>

<div class="tips">
    <p>注意 <strong>重要声明：</strong> 本站为 <strong>g.sakcn.icu Google 镜像站</strong>，提供的服务仅限用于合法的学术知识搜索研究，严禁用于任何违法违规用途。</p>
    <p>警告 <strong>技术提示：</strong> 已经精简底层依赖，原生修复了 Edge/Chrome 核心的兼容报错，全局重组并伪装了网络访问指纹。</p>
</div>

<script>
function saveAndJump() {
    const node = document.getElementById('targetNode').value;
    const ua = document.getElementById('uaInput').value.trim();
    const lang = document.getElementById('langInput').value;
    const cookieInject = document.getElementById('cookieInput').value.trim();

    const expiry = new Date();
    expiry.setTime(expiry.getTime() + (30 * 24 * 60 * 60 * 1000)); // 缓存30天
    const expStr = "; expires=" + expiry.toUTCString() + "; path=/";

    document.cookie = "__CF_PROXY_UA__=" + encodeURIComponent(ua) + expStr;
    document.cookie = "__CF_PROXY_LANG__=" + encodeURIComponent(lang) + expStr;
    document.cookie = "__CF_PROXY_INJECT_COOKIE__=" + encodeURIComponent(cookieInject) + expStr;

    window.open(window.location.origin + '/https://' + node, '_blank');
}
// 自动读取历史存储的 Cookie 设定到输入框
function loadSaved() {
    const getC = (k) => { var m = RegExp(k + "=[^;]+").exec(document.cookie); return m ? decodeURIComponent(m[0].replace(/^[^=]+./, "")) : ""; };
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
  const userAgent = request.headers.get('User-Agent') || "";
  if (userAgent.includes("Bytespider")) {
    return new Response("Forbidden Bot", { status: 403 });
  }

  var siteCookie = request.headers.get('Cookie') || "";
  const url = new URL(request.url);

  if (request.url.endsWith("favicon.ico")) {
    return Response.redirect("https://www.google.com/favicon.ico", 301);
  }
  if (request.url.endsWith("robots.txt")) {
    return new Response(`User-Agent: *\nDisallow: /`, { headers: { "Content-Type": "text/plain" } });
  }

  var actualUrlStr = url.pathname.substring(url.pathname.indexOf(str) + str.length) + url.search + url.hash;
  if (actualUrlStr == "") {
    return getHTMLResponse(mainPage);
  }

  try {
    var test = actualUrlStr;
    if (!test.startsWith("http")) test = "https://" + test;
    var u = new URL(test);
    
    // 🔒 域名过滤锁：仅允许代理 Google 主站及相关的基本前端静态资源层
    const host = u.host.toLowerCase();
    const isGoogle = host.endsWith('google.com') || 
                     host.endsWith('google.com.hk') || 
                     host.endsWith('gstatic.com') || 
                     host.endsWith('googleusercontent.com') ||
                     host.endsWith('ggpht.com');
                     
    if (!isGoogle) {
      return getHTMLResponse("<h1>403 Forbidden</h1><br>本镜像代理站仅被允许访问谷歌相关知识库，拒绝代理其他站点。");
    }
  }
  catch {
    var lastVisit = getCook(lastVisitProxyCookie, siteCookie);
    if (lastVisit) {
      return Response.redirect(thisProxyServerUrlHttps + lastVisit + "/" + actualUrlStr, 302);
    }
    return getHTMLResponse("无法解析该目标请求。");
  }

  if (!actualUrlStr.startsWith("http") && !actualUrlStr.includes("://")) {
    return Response.redirect(thisProxyServerUrlHttps + "https://" + actualUrlStr, 301);
  }

  const actualUrl = new URL(actualUrlStr);
  if (actualUrlStr != actualUrl.href) return Response.redirect(thisProxyServerUrlHttps + actualUrl.href, 301);

  // 🎛️ 获取前台面板存储的 Cookie、UA、语言定制配置
  let customUA = getCook("__CF_PROXY_UA__", siteCookie) || DEFAULT_UA;
  let customLang = getCook("__CF_PROXY_LANG__", siteCookie) || "zh-CN,zh;q=0.9,en;q=0.8";
  let customInjectCookie = getCook("__CF_PROXY_INJECT_COOKIE__", siteCookie) || "";

  let clientHeaderWithChange = new Headers();
  request.headers.forEach((value, key) => {
    var newValue = value.replaceAll(thisProxyServerUrlHttps + "http", "http");
    newValue = newValue.replaceAll(thisProxyServerUrlHttps, `${actualUrl.protocol}//${actualUrl.hostname}/`);
    newValue = newValue.replaceAll(thisProxyServerUrlHttps.substring(0, thisProxyServerUrlHttps.length - 1), `${actualUrl.protocol}//${actualUrl.hostname}`);
    newValue = newValue.replaceAll(thisProxyServerUrl_hostOnly, actualUrl.host);
    clientHeaderWithChange.set(key, newValue);
  });

  // 注入伪装头属性
  clientHeaderWithChange.set('User-Agent', customUA);
  clientHeaderWithChange.set('Accept-Language', customLang);
  if (customInjectCookie) {
    let baseCookie = clientHeaderWithChange.get('Cookie') || "";
    clientHeaderWithChange.set('Cookie', baseCookie ? `${baseCookie}; ${customInjectCookie}` : customInjectCookie);
  }

  let clientRequestBodyWithChange;
  if (request.body) {
    const [body1, body2] = request.body.tee();
    try {
      const bodyText = await new Response(body1).text();
      if (bodyText.includes(thisProxyServerUrlHttps) || bodyText.includes(thisProxyServerUrl_hostOnly)) {
        clientRequestBodyWithChange = bodyText
          .replaceAll(thisProxyServerUrlHttps, actualUrlStr)
          .replaceAll(thisProxyServerUrl_hostOnly, actualUrl.host);
      } else {
        clientRequestBodyWithChange = body2;
      }
    } catch (e) {
      clientRequestBodyWithChange = body2;
    }
  }

  const modifiedRequest = new Request(actualUrl, {
    headers: clientHeaderWithChange,
    method: request.method,
    body: (request.body) ? clientRequestBodyWithChange : request.body,
    redirect: "manual"
  });

  const response = await fetch(modifiedRequest);
  
  if (response.status.toString().startsWith("3") && response.headers.get("Location") != null) {
    try {
      return getRedirect(thisProxyServerUrlHttps + new URL(response.headers.get("Location"), actualUrlStr).href, response, actualUrl);
    } catch {
      return getHTMLResponse("重定向解析发生错误。");
    }
  }

  var modifiedResponse;
  var bd;
  const contentType = response.headers.get("Content-Type") || "";
  var isHTML = false;

  if (response.body) {
    let isText = false;
    let isTextDetectingKeyword = ["text/", "application/json", "application/javascript"];
    isTextDetectingKeyword.forEach(x => { if(contentType.includes(x)) isText = true; })
    
    if (isText) {
      const rawBytes = await response.arrayBuffer();
      let encoding = 'utf-8';
      let m = contentType.match(/charset=([^\s;]+)/i);
      if (m) { encoding = m[1]; } 
      else if (contentType.includes("text/html")) {
        let preview = new TextDecoder('utf-8').decode(rawBytes.slice(0, 2048));
        let metaMatch = preview.match(/charset\s*=\s*["']?\s*([^\s"';>]+)/i);
        if (metaMatch) encoding = metaMatch[1];
      }
      
      try { bd = new TextDecoder(encoding).decode(rawBytes); } 
      catch(ex) { bd = new TextDecoder('utf-8').decode(rawBytes); }

      isHTML = contentType.includes("text/html") && bd.includes("<html");

      if (contentType.includes("html") || contentType.includes("javascript")) {
        bd = bd.replaceAll("window.location", "window." + replaceUrlObj)
               .replaceAll("document.location", "document." + replaceUrlObj)
               .replaceAll("location.href", replaceUrlObj + ".href")
               .replaceAll("location.replace(", replaceUrlObj + ".replace(")
               .replaceAll("location.assign(", replaceUrlObj + ".assign(");
      }

      if (isHTML) {
        var hasBom = bd.charCodeAt(0) === 0xFEFF;
        if (hasBom) bd = bd.substring(1);

        // 核心改动：把原本的弹窗警告逻辑，替换为顶部的手机式状态栏渲染
        var inject = `
        <!DOCTYPE html>
        <script>
        ${statusBarInjection}
        (function () {
          ${httpRequestInjection}
          ${htmlCovPathInject}
          const originalBodyBase64Encoded = "${new TextEncoder().encode(bd)}";
          const bytes = new Uint8Array(originalBodyBase64Encoded.split(',').map(Number));
          ${htmlCovPathInjectFuncName}(new TextDecoder().decode(bytes));
        })();
        </script>
        `;
        bd = (hasBom ? "\uFEFF" : "") + inject;
      } else {
        let regex = new RegExp(`(https?:\\/\\/[^\s'"]+)`, 'g');
        bd = bd.replaceAll(regex, (match) => {
          if (match.startsWith("http://www.w3.org/") || match.startsWith("https://www.w3.org/")) return match;
          return match.startsWith("http") ? thisProxyServerUrlHttps + match : thisProxyServerUrl_hostOnly + "/" + match;
        });
      }

      modifiedResponse = new Response(bd, response);
      modifiedResponse.headers.set("Content-Type", contentType.replace(/charset=([^\s;]+)/i, "charset=utf-8"));
    } else {
      modifiedResponse = new Response(response.body, response);
    }
  } else {
    modifiedResponse = new Response(response.body, response);
  }

  handleCookieHeader(modifiedResponse, isHTML, response, actualUrlStr, actualUrl);

  modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
  modifiedResponse.headers.set("X-Frame-Options", "ALLOWALL");

  var listHeaderDel = ["Content-Security-Policy", "Permissions-Policy", "Cross-Origin-Embedder-Policy", "Cross-Origin-Resource-Policy"];
  listHeaderDel.forEach(element => {
    modifiedResponse.headers.delete(element);
    modifiedResponse.headers.delete(element + "-Report-Only");
  });

  return modifiedResponse;
}

function handleCookieHeader(modifiedResponse, isHTML, response, actualUrlStr, actualUrl) {
  let headers = modifiedResponse.headers;
  let rawCookies = [];
  try { rawCookies = headers.getAll('Set-Cookie'); } catch {
    const val = headers.get('Set-Cookie');
    if (val) rawCookies = [val];
  }

  if (rawCookies.length > 0) {
    headers.delete('Set-Cookie');
    rawCookies.forEach(singleCookie => {
      let parts = singleCookie.split(';').map(part => part.trim());
      let pathIndex = parts.findIndex(part => part.toLowerCase().startsWith('path='));
      let originalPath = pathIndex !== -1 ? parts[pathIndex].substring("path=".length) : "/";
      let absolutePath = "/" + new URL(originalPath, actualUrlStr).href;

      if (pathIndex !== -1) { parts[pathIndex] = `Path=${absolutePath}`; } 
      else { parts.push(`Path=${absolutePath}`); }

      let domainIndex = parts.findIndex(part => part.toLowerCase().startsWith('domain='));
      if (domainIndex !== -1) { parts[domainIndex] = `domain=${thisProxyServerUrl_hostOnly}`; } 
      else { parts.push(`domain=${thisProxyServerUrl_hostOnly}`); }

      headers.append('Set-Cookie', parts.join('; '));
    });
  }

  if (isHTML && response.status == 200) {
    let cookieValue = lastVisitProxyCookie + "=" + actualUrl.origin + "; Path=/; Domain=" + thisProxyServerUrl_hostOnly;
    headers.append("Set-Cookie", cookieValue);
  }
}

function getCook(cookiename, cookies) {
  var cookiestring = RegExp(cookiename + "=[^;]+").exec(cookies);
  return decodeURIComponent(!!cookiestring ? cookiestring.toString().replace(/^[^=]+./, "") : "");
}

function getHTMLResponse(html) {
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function getRedirect(url, originalResponse, actualUrl) {
  if (originalResponse) {
    var res = new Response(null, originalResponse);
    handleCookieHeader(res, false, originalResponse, actualUrl.toString(), actualUrl);
    res.headers.set("Location", url);
    return res;
  }
  return Response.redirect(url, 301);
}