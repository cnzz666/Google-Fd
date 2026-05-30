addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  thisProxyServerUrlHttps = `${url.protocol}//${url.hostname}/`;
  thisProxyServerUrl_hostOnly = url.host;
  event.respondWith(handleRequest(event.request))
})

const str = "/";
const lastVisitProxyCookie = "__PROXY_VISITEDSITE__";
const passwordCookieName = "__PROXY_PWD__";
const proxyHintCookieName = "__PROXY_HINT__";
const password = "";
const showPasswordPage = false;
const replaceUrlObj = "__location__yproxy__";

var thisProxyServerUrlHttps;
var thisProxyServerUrl_hostOnly;

// 提示使用代理（留空，防止遮挡或干扰Google人机验证）
const proxyHintInjection = ``;

const httpRequestInjection = `
//---***========================================***---信息配置---***========================================***---
var nowURL = new URL(window.location.href);
var proxy_host = nowURL.host; 
var proxy_protocol = nowURL.protocol; 
var proxy_host_with_schema = proxy_protocol + "//" + proxy_host + "/"; 

// 动态计算当前的原始网站地址
Object.defineProperty(window, 'original_website_url_str', {
    get: function() {
        let currentPath = window.location.pathname.substring(1);
        if (currentPath.startsWith("http://") || currentPath.startsWith("https://")) {
            return currentPath + window.location.search + window.location.hash;
        } else {
            return "https://www.google.com" + window.location.pathname + window.location.search + window.location.hash;
        }
    }
});

Object.defineProperty(window, 'original_website_url', {
    get: function() {
        return new URL(original_website_url_str);
    }
});

Object.defineProperty(window, 'original_website_host', {
    get: function() {
        return original_website_url.host;
    }
});

Object.defineProperty(window, 'original_website_host_with_schema', {
    get: function() {
        return original_website_url.protocol + "//" + original_website_host + "/";
    }
});

//---***========================================***---路径转换func---***========================================***---
function changeURL(relativePath) {
    if (relativePath == null) return null;

    let relativePath_str = (relativePath instanceof URL) ? relativePath.href : relativePath.toString();

    try {
        if (relativePath_str.startsWith("data:") || relativePath_str.startsWith("mailto:") || relativePath_str.startsWith("javascript:") || relativePath_str.startsWith("chrome") || relativePath_str.startsWith("edge")) return relativePath_str;
    } catch {
        return relativePath_str;
    }

    var pathAfterAdd = "";
    if (relativePath_str.startsWith("blob:")) {
        pathAfterAdd = "blob:";
        relativePath_str = relativePath_str.substring("blob:".length);
    }

    try {
        let startWithLs = [proxy_host_with_schema, proxy_host + "/", proxy_host]
        startWithLs.forEach(x => {
            if (relativePath_str.startsWith(x)) relativePath_str = relativePath_str.substring(x.length);
        });
        startWithLs.forEach(x => {
            x = "/" + x;
            if (relativePath_str.startsWith(x)) relativePath_str = relativePath_str.substring(x.length);
        });

        let enhancedStartRm = [original_website_host_with_schema.substring(0, original_website_host_with_schema.length - 1), original_website_host]
        enhancedStartRm.forEach(x => {
            x = "/" + x;
            if (relativePath_str.startsWith(x)) relativePath_str = relativePath_str.substring(x.length);
        });
    } catch {}

    try {
        var absolutePath = new URL(relativePath_str, original_website_url_str).href; 
        absolutePath = absolutePath.replaceAll(window.location.href, original_website_url_str); 
        absolutePath = absolutePath.replaceAll(encodeURI(window.location.href), encodeURI(original_website_url_str));
        absolutePath = absolutePath.replaceAll(encodeURIComponent(window.location.href), encodeURIComponent(original_website_url_str));

        absolutePath = absolutePath.replaceAll(proxy_host, original_website_host);
        absolutePath = absolutePath.replaceAll(encodeURI(proxy_host), encodeURI(original_website_host));
        absolutePath = absolutePath.replaceAll(encodeURIComponent(proxy_host), encodeURIComponent(original_website_host));

        // 核心直连路由：如果是Google本域，直接走根路径；如果是第三方域名（如gstatic），走回退全路径
        let absUrlObj = new URL(absolutePath);
        if (absUrlObj.hostname.includes("google.com") || absUrlObj.hostname.includes("google.com.hk")) {
            absolutePath = proxy_host_with_schema + absUrlObj.pathname.substring(1) + absUrlObj.search + absUrlObj.hash;
        } else {
            absolutePath = proxy_host_with_schema + absolutePath;
        }

        return pathAfterAdd + absolutePath;
    } catch (e) {
        return relativePath_str;
    }
}

function getOriginalUrl(url) {
    if (url == null) return null;
    if (url.startsWith(proxy_host_with_schema)) {
        let subPath = url.substring(proxy_host_with_schema.length);
        if (!subPath.startsWith("http")) {
            return "https://www.google.com/" + subPath;
        }
        return subPath;
    }
    return url;
}

//---***========================================***---注入网络请求---***========================================***---
function networkInject() {
    var originalOpen = XMLHttpRequest.prototype.open;
    var originalFetch = window.fetch;
    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        url = changeURL(url);
        return originalOpen.apply(this, arguments);
    };

    window.fetch = function (input, init) {
        var url = (typeof input === 'string') ? input : ((input instanceof Request) ? input.url : input);
        url = changeURL(url);
        if (typeof input === 'string') {
            return originalFetch(url, init);
        } else {
            const newRequest = new Request(url, input);
            return originalFetch(newRequest, init);
        }
    };
    console.log("NETWORK REQUEST METHOD INJECTED");
}

function windowOpenInject() {
    const originalOpen = window.open;
    window.open = function (url, name, specs) {
        let modifiedUrl = changeURL(url);
        return originalOpen.call(window, modifiedUrl, name, specs);
    };
    console.log("WINDOW OPEN INJECTED");
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
    console.log("APPEND CHILD INJECTED");
}

function elementPropertyInject() {
    const originalSetAttribute = HTMLElement.prototype.setAttribute;
    HTMLElement.prototype.setAttribute = function (name, value) {
        if (name == "src" || name == "href" || name == "action") {
            value = changeURL(value);
        }
        originalSetAttribute.call(this, name, value);
    };

    const originalGetAttribute = HTMLElement.prototype.getAttribute;
    HTMLElement.prototype.getAttribute = function (name) {
        const val = originalGetAttribute.call(this, name);
        if (name == "src" || name == "href" || name == "action") {
            return getOriginalUrl(val);
        }
        return val;
    };

    const setList = [
        [HTMLAnchorElement, "href"],
        [HTMLScriptElement, "src"],
        [HTMLImageElement, "src"],
        [HTMLLinkElement, "href"],
        [HTMLIFrameElement, "src"],
        [HTMLVideoElement, "src"],
        [HTMLAudioElement, "src"],
        [HTMLSourceElement, "src"],
        [HTMLObjectElement, "data"],
        [HTMLFormElement, "action"],
    ];

    for (const [whichElement, whichProperty] of setList) {
        if (!whichElement || !whichElement.prototype) continue;
        const descriptor = Object.getOwnPropertyDescriptor(whichElement.prototype, whichProperty);
        if (!descriptor) continue;

        Object.defineProperty(whichElement.prototype, whichProperty, {
            get: function () {
                const real = descriptor.get.call(this);
                return getOriginalUrl(real);
            },
            set: function (val) {
                descriptor.set.call(this, changeURL(val));
            },
            configurable: true,
        });
    }
    console.log("ELEMENT PROPERTY INJECTED");
}

//---***========================================***---注入location---***========================================***---
class ProxyLocation {
    constructor(originalLocation) { this.originalLocation = originalLocation; }
    reload(forcedReload) { this.originalLocation.reload(forcedReload); }
    replace(url) { this.originalLocation.replace(changeURL(url)); }
    assign(url) { this.originalLocation.assign(changeURL(url)); }
    get href() { return original_website_url_str; }
    set href(url) { this.originalLocation.href = changeURL(url); }
    get protocol() { return original_website_url.protocol; }
    set protocol(value) {
        original_website_url.protocol = value;
        this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
    }
    get host() { return original_website_url.host; }
    set host(value) {
        original_website_url.host = value;
        this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
    }
    get hostname() { return original_website_url.hostname; }
    set hostname(value) {
        original_website_url.hostname = value;
        this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
    }
    get port() { return original_website_url.port; }
    set port(value) {
        original_website_url.port = value;
        this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
    }
    get pathname() { return original_website_url.pathname; }
    set pathname(value) {
        original_website_url.pathname = value;
        this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
    }
    get search() { return original_website_url.search; }
    set search(value) {
        original_website_url.search = value;
        this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
    }
    get hash() { return original_website_url.hash; }
    set hash(value) {
        original_website_url.hash = value;
        this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
    }
    get origin() { return original_website_url.origin; }
    toString() { return this.originalLocation.href; }
}

function documentLocationInject() {
    Object.defineProperty(document, 'URL', {
        get: function () { return original_website_url_str; },
        set: function (url) { document.URL = changeURL(url); }
    });
    Object.defineProperty(document, '${replaceUrlObj}', {
        get: function () { return new ProxyLocation(window.location); },
        set: function (url) { window.location.href = changeURL(url); }
    });
    console.log("LOCATION INJECTED");
}

function windowLocationInject() {
    Object.defineProperty(window, '${replaceUrlObj}', {
        get: function () { return new ProxyLocation(window.location); },
        set: function (url) { window.location.href = changeURL(url); }
    });
    console.log("WINDOW LOCATION INJECTED");
}

function historyInject() {
    const originalPushState = History.prototype.pushState;
    const originalReplaceState = History.prototype.replaceState;

    History.prototype.pushState = function (state, title, url) {
        if (!url) return;
        var u = changeURL(url);
        return originalPushState.apply(this, [state, title, u]);
    };

    History.prototype.replaceState = function (state, title, url) {
        if (!url) return;
        var u = changeURL(url.toString());
        return originalReplaceState.apply(this, [state, title, u]);
    };
    console.log("HISTORY INJECTED");
}

function obsPage() {
    var yProxyObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) { traverseAndConvert(mutation); });
    });
    yProxyObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
}

function traverseAndConvert(node) {
    if (node instanceof HTMLElement) {
        removeIntegrityAttributesFromElement(node);
        covToAbs(node);
        node.querySelectorAll('*').forEach(function (child) {
            removeIntegrityAttributesFromElement(child);
            covToAbs(child);
        });
    }
}

function covToAbs(element) {
    if (!(element instanceof HTMLElement)) return;
    const attrs = ["href", "src", "action", "srcset", "poster", "data"];
    attrs.forEach(attr => {
        if (element.hasAttribute(attr)) {
            let relativePath = element.getAttribute(attr);
            try {
                element.setAttribute(attr, changeURL(relativePath));
            } catch (e) {}
        }
    });
}

function removeIntegrityAttributesFromElement(element) {
    if (element.hasAttribute('integrity')) element.removeAttribute('integrity');
}

function loopAndConvertToAbs() {
    for (var ele of document.querySelectorAll('*')) {
        removeIntegrityAttributesFromElement(ele);
        covToAbs(ele);
    }
}

function covScript() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) { covToAbs(scripts[i]); }
    setTimeout(covScript, 3000);
}

networkInject();
windowOpenInject();
elementPropertyInject();
appendChildInject();
documentLocationInject();
windowLocationInject();
historyInject();

window.addEventListener('load', () => {
    loopAndConvertToAbs();
    obsPage();
    covScript();
});
`;

const htmlCovPathInjectFuncName = "parseAndInsertDoc";
const htmlCovPathInject = `
function ${htmlCovPathInjectFuncName}(htmlString) {
  const parser = new DOMParser();
  const tempDoc = parser.parseFromString(htmlString, 'text/html');
  const allElements = tempDoc.querySelectorAll('*');

  allElements.forEach(element => {
    covToAbs(element);
    removeIntegrityAttributesFromElement(element);
    if (element.tagName === 'SCRIPT' && element.textContent && !element.src) {
        element.textContent = replaceContentPaths(element.textContent);
    }
    if (element.tagName === 'STYLE' && element.textContent) {
        element.textContent = replaceContentPaths(element.textContent);
    }
  });

  let modifiedHtml = tempDoc.documentElement.outerHTML;
  let charset = modifiedHtml.match(/content="text\\/html;\\s*charset=[^"]*"/);
  if(charset != null && charset.length !== 0){
    modifiedHtml = modifiedHtml.replace(charset[0], "content='text/html;charset=utf-8'");
  }

  document.open();
  document.write('<!DOCTYPE html>' + modifiedHtml);
  document.close();
}

function replaceContentPaths(content){
  let regex = new RegExp(\`(https?:\\\\/\\\\/[^\\s'"]+)\`, 'g');
  content = content.replaceAll(regex, (match) => {
    if (match.startsWith("http://www.w3.org/") || match.startsWith("https://www.w3.org/")) return match;
    try {
      let mUrl = new URL(match);
      if (mUrl.hostname.includes("google.com") || mUrl.hostname.includes("google.com.hk")) {
        return proxy_host_with_schema + mUrl.pathname.substring(1) + mUrl.search + mUrl.hash;
      }
    } catch(e) {}
    return proxy_host_with_schema + match;
  });
  return content;
}
`;

const mainPage = `
<html>
<head>
    <meta charset="utf-8">
    <title>Google镜像</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { min-height: 100%; font-family: Arial, sans-serif; background-color: #f0f8ff; }
        body { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 30px; }
        .container { background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1); width: 100%; max-width: 400px; text-align: center; margin: 20px 0; }
        h1 { font-size: 22px; margin-bottom: 15px; }
        input[type="text"] { width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 5px; font-size: 14px; box-shadow: inset 0 4px 8px rgba(0, 0, 0, 0.2); }
        button { padding: 10px 20px; background-color: #008cba; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2); }
        button:hover { background-color: #005f5f; }
        ul { margin-top: 20px; list-style-type: none; font-size: 14px; text-align: left; width: 100%; max-width: 600px; }
        li { margin-bottom: 10px; }
        a { color: #008cba; text-decoration: none; cursor:pointer; }
    </style>
</head>
<body>
<div class="container">
<form id="urlForm" onsubmit="redirectToProxy(event)">
    <h1>Google镜像</h1>
    <label for="targetUrl">
        <input type="text" id="targetUrl" placeholder="输入搜索内容或直接点击下方进入...">
    </label>
    <button type="submit" id="jump"> 进入 Google </button>
</form>
</div>
<ul>
  <li><strong>直接代理模式已启用：本站仅提供 Google 专属镜像服务。</strong></li>
</ul>
<script>
  function redirectToProxy(event) {
      event.preventDefault();
      window.location.href = window.location.origin + '/';
  }
</script>
</body>
</html>
`;

const pwdPage = `
<!DOCTYPE html>
<html>
    <head>
        <script>
            function setPassword() {
                var cookieDomain = window.location.hostname;
                var password = document.getElementById('password').value;
                var oneWeekLater = new Date();
                oneWeekLater.setTime(oneWeekLater.getTime() + (7 * 24 * 60 * 60 * 1000));
                document.cookie = "${passwordCookieName}" + "=" + password + "; expires=" + oneWeekLater.toUTCString() + "; path=/; domain=" + cookieDomain;
                location.reload();
            }
        </script>
    </head>
    <body>
        <div>
            <input id="password" type="password" placeholder="Password">
            <button onclick="setPassword()">Submit</button>
        </div>
    </body>
</html>
`;
const redirectError = `
<html><body><h2>Error while redirecting: the website you want to access to may contain wrong redirect information.</h2></body></html>
`;

async function handleRequest(request) {
  const userAgent = request.headers.get('User-Agent') || "";
  if (userAgent.includes("Bytespider")) {
    return getHTMLResponse("Access Denied");
  }

  // 密码验证逻辑
  var siteCookie = request.headers.get('Cookie') || "";
  if (password != "") {
    var pwd = getCook(passwordCookieName, siteCookie);
    if (pwd != password) {
      return handleWrongPwd();
    }
  }

  const url = new URL(request.url);
  if (request.url.endsWith("favicon.ico")) {
    return getRedirect("https://www.google.com/favicon.ico");
  }
  if (request.url.endsWith("robots.txt")) {
    return new Response(`User-Agent: *\nDisallow: /`, { headers: { "Content-Type": "text/plain" } });
  }

  // 计算代理的目标URL (优化为专属直连转换)
  let actualUrlStr = "";
  let pathAfterSlash = url.pathname.substring(1);
  
  if (pathAfterSlash.startsWith("http://") || pathAfterSlash.startsWith("https://")) {
    actualUrlStr = pathAfterSlash + url.search + url.hash;
  } else {
    // 根目录或常规Google路径
    actualUrlStr = "https://www.google.com" + url.pathname + url.search + url.hash;
  }

  const actualUrl = new URL(actualUrlStr);

  // 清理发往Google的请求Header，转换为标准的Google目标域引用
  let clientHeaderWithChange = new Headers();
  request.headers.forEach((value, key) => {
    var newValue = value.replaceAll(thisProxyServerUrlHttps + "http", "http");
    newValue = newValue.replaceAll(thisProxyServerUrlHttps, `https://www.google.com/`);
    newValue = newValue.replaceAll(thisProxyServerUrl_hostOnly, "www.google.com");
    clientHeaderWithChange.set(key, newValue);
  });

  // 处理请求体
  let clientRequestBodyWithChange;
  if (request.body) {
    const [body1, body2] = request.body.tee();
    try {
      const bodyText = await new Response(body1).text();
      if (bodyText.includes(thisProxyServerUrlHttps) || bodyText.includes(thisProxyServerUrl_hostOnly)) {
        clientRequestBodyWithChange = bodyText
          .replaceAll(thisProxyServerUrlHttps, actualUrlStr)
          .replaceAll(thisProxyServerUrl_hostOnly, "www.google.com");
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

  // 处理重定向
  if (response.status.toString().startsWith("3") && response.headers.get("Location") != null) {
    try {
      let redirectTarget = new URL(response.headers.get("Location"), actualUrlStr).href;
      // 保持本地专代路径格式
      if (redirectTarget.includes("google.com") || redirectTarget.includes("google.com.hk")) {
        let redirectUrlObj = new URL(redirectTarget);
        return getRedirect(thisProxyServerUrlHttps + redirectUrlObj.pathname.substring(1) + redirectUrlObj.search + redirectUrlObj.hash, response, actualUrl);
      }
      return getRedirect(thisProxyServerUrlHttps + redirectTarget, response, actualUrl);
    } catch {
      return getHTMLResponse(redirectError);
    }
  }

  var modifiedResponse;
  var bd;
  const contentType = response.headers.get("Content-Type") || "";

  if (response.body) {
    let isText = ["text/", "application/json", "application/javascript"].some(x => contentType.includes(x));
    
    if (isText) {
      const rawBytes = await response.arrayBuffer();
      let encoding = 'utf-8';
      let preview = new TextDecoder('utf-8').decode(rawBytes.slice(0, 2048));
      let metaMatch = preview.match(/charset\s*=\s*["']?\s*([^\s"';>]+)/i);
      if (metaMatch) encoding = metaMatch[1];

      try {
        bd = new TextDecoder(encoding).decode(rawBytes);
      } catch(ex) {
        bd = new TextDecoder('utf-8').decode(rawBytes);
      }

      // 核心防碎处理：如果是Google的re检测异常流量验证码页面（/sorry/），坚决不使用破坏上下文的动态脚本重写方案，确保原始验证机制正常。
      let isHTML = contentType.includes("text/html") && bd.includes("<html") && !actualUrlStr.includes("/sorry/");

      if (contentType.includes("html") || contentType.includes("javascript")) {
        bd = bd.replaceAll("window.location", "window." + replaceUrlObj);
        bd = bd.replaceAll("document.location", "document." + replaceUrlObj);
        bd = bd.replaceAll("location.href", replaceUrlObj + ".href");
        bd = bd.replaceAll("location.replace(", replaceUrlObj + ".replace(");
        bd = bd.replaceAll("location.assign(", replaceUrlObj + ".assign(");
      }

      if (isHTML) {
        var hasBom = bd.charCodeAt(0) === 0xFEFF;
        if (hasBom) bd = bd.substring(1);

        var inject = `
        <!DOCTYPE html>
        <script>
        (function () { ${proxyHintInjection} })();
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
        // 静态资源与纯文本内地址替换
        let regex = new RegExp(`(https?:\\/\\/[^\\s'"]+)`, 'g');
        bd = bd.replaceAll(regex, (match) => {
          if (match.startsWith("http://www.w3.org/") || match.startsWith("https://www.w3.org/")) return match;
          try {
            let mUrl = new URL(match);
            if (mUrl.hostname.includes("google.com") || mUrl.hostname.includes("google.com.")) {
              return thisProxyServerUrlHttps + mUrl.pathname.substring(1) + mUrl.search + mUrl.hash;
            }
          } catch(e) {}
          return thisProxyServerUrlHttps + match;
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

  // 处理和重写各种Cookie属性，确保本地客户端能正常接纳和携带Google Cookie
  handleCookieHeader(modifiedResponse, contentType.includes("text/html") && response.status == 200, response, actualUrlStr, actualUrl);

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
  try {
    rawCookies = headers.getAll('Set-Cookie');
  } catch {
    const val = headers.get('Set-Cookie');
    if (val) rawCookies = [val];
  }

  if (rawCookies.length > 0) {
    headers.delete('Set-Cookie');
    rawCookies.forEach(singleCookie => {
      let parts = singleCookie.split(';').map(part => part.trim());

      let pathIndex = parts.findIndex(part => part.toLowerCase().startsWith('path='));
      let originalPath = (pathIndex !== -1) ? parts[pathIndex].substring("path=".length) : "/";
      
      // 保持Cookie在根域名可用
      if (pathIndex !== -1) {
        parts[pathIndex] = `Path=/`;
      } else {
        parts.push(`Path=/`);
      }

      let domainIndex = parts.findIndex(part => part.toLowerCase().startsWith('domain='));
      if (domainIndex !== -1) {
        parts[domainIndex] = `domain=${thisProxyServerUrl_hostOnly}`;
      } else {
        parts.push(`domain=${thisProxyServerUrl_hostOnly}`);
      }

      headers.append('Set-Cookie', parts.join('; '));
    });
  }

  if (isHTML) {
    let cookieValue = lastVisitProxyCookie + "=" + actualUrl.origin + "; Path=/; Domain=" + thisProxyServerUrl_hostOnly;
    headers.append("Set-Cookie", cookieValue);
  }
}

function getCook(cookiename, cookies) {
  var cookiestring = RegExp(cookiename + "=[^;]+").exec(cookies);
  return decodeURIComponent(!!cookiestring ? cookiestring.toString().replace(/^[^=]+./, "") : "");
}

function handleWrongPwd() {
  if (showPasswordPage) {
    return getHTMLResponse(pwdPage);
  } else {
    return getHTMLResponse("<h1>403 Forbidden</h1><br>You do not have access to view this webpage.");
  }
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