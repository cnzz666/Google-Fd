addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  thisProxyServerUrlHttps = `${url.protocol}//${url.hostname}/`;
  thisProxyServerUrl_hostOnly = url.host;
  event.respondWith(handleRequest(event.request))
})

const str = "/";
const lastVisitProxyCookie = "__GOOGLE_VISITEDSITE__";
const googleCookieStoreName = "__GOOGLE_COOKIES__";

var thisProxyServerUrlHttps;
var thisProxyServerUrl_hostOnly;

const replaceUrlObj = "__location__gproxy__";

const httpRequestInjection = `

//---***========================================***---information---***========================================***---
var nowURL = new URL(window.location.href);
var proxy_host = nowURL.host;
var proxy_protocol = nowURL.protocol;
var proxy_host_with_schema = proxy_protocol + "//" + proxy_host + "/";

Object.defineProperty(window, 'original_website_url_str', {
    get: function() {
        return "https://www.google.com/";
    }
});

Object.defineProperty(window, 'original_website_url', {
    get: function() {
        return new URL("https://www.google.com/");
    }
});

Object.defineProperty(window, 'original_website_host', {
    get: function() {
        return "www.google.com";
    }
});

Object.defineProperty(window, 'original_website_host_with_schema', {
    get: function() {
        return "https://www.google.com/";
    }
});

//---***========================================***---通用func---***========================================***---
function changeURL(relativePath) {
    if (relativePath == null) return null;

    let relativePath_str = "";
    if (relativePath instanceof URL) {
        relativePath_str = relativePath.href;
    } else {
        relativePath_str = relativePath.toString();
    }

    try {
        if (relativePath_str.startsWith("data:") || relativePath_str.startsWith("mailto:") || relativePath_str.startsWith("javascript:") || relativePath_str.startsWith("chrome") || relativePath_str.startsWith("blob:")) {
            return relativePath_str;
        }
    } catch {
        console.log("Change URL Error :");
        console.log(relativePath_str);
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

        let enhancedStartRm = ["https://www.google.com", "www.google.com"]
        enhancedStartRm.forEach(x => {
            x = "/" + x;
            if (relativePath_str.startsWith(x)) relativePath_str = relativePath_str.substring(x.length);
        });
    } catch {
        //ignore
    }

    try {
        var absolutePath = new URL(relativePath_str, "https://www.google.com/").href;
        absolutePath = absolutePath.replaceAll(window.location.href, "https://www.google.com/");
        absolutePath = absolutePath.replaceAll(encodeURI(window.location.href), encodeURI("https://www.google.com/"));
        absolutePath = absolutePath.replaceAll(encodeURIComponent(window.location.href), encodeURIComponent("https://www.google.com/"));

        absolutePath = absolutePath.replaceAll(proxy_host, "www.google.com");
        absolutePath = absolutePath.replaceAll(encodeURI(proxy_host), encodeURI("www.google.com"));
        absolutePath = absolutePath.replaceAll(encodeURIComponent(proxy_host), encodeURIComponent("www.google.com"));

        absolutePath = proxy_host_with_schema + absolutePath;

        absolutePath = pathAfterAdd + absolutePath;

        return absolutePath;
    } catch (e) {
        console.log("Exception occured: " + e.message);
        return relativePath_str;
    }
}

function getOriginalUrl(url) {
    if (url == null) return null;
    if (url.startsWith(proxy_host_with_schema)) return url.substring(proxy_host_with_schema.length);
    return url;
}

//---***========================================***---注入网络---***========================================***---
function networkInject() {
    var originalOpen = XMLHttpRequest.prototype.open;
    var originalFetch = window.fetch;
    
    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        console.log("Original XHR: " + url);
        url = changeURL(url);
        console.log("Changed XHR: " + url);
        return originalOpen.apply(this, arguments);
    };

    window.fetch = function (input, init) {
        var url;
        if (typeof input === 'string') {
            url = input;
        } else if (input instanceof Request) {
            url = input.url;
        } else {
            url = input;
        }

        url = changeURL(url);
        console.log("Changed Fetch: " + url);
        
        if (typeof input === 'string') {
            return originalFetch(url, init);
        } else {
            const newRequest = new Request(url, input);
            return originalFetch(newRequest, init);
        }
    };

    console.log("NETWORK REQUEST METHOD INJECTED");
}

//---***========================================***---注入window.open---***========================================***---
function windowOpenInject() {
    const originalOpen = window.open;
    window.open = function (url, name, specs) {
        let modifiedUrl = changeURL(url);
        return originalOpen.call(window, modifiedUrl, name, specs);
    };
    console.log("WINDOW OPEN INJECTED");
}

//---***========================================***---注入append元素---***========================================***---
function appendChildInject() {
    const originalAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function (child) {
        try {
            if (child.src) {
                child.src = changeURL(child.src);
            }
            if (child.href) {
                child.href = changeURL(child.href);
            }
        } catch {
            //ignore
        }
        return originalAppendChild.call(this, child);
    };
    console.log("APPEND CHILD INJECTED");
}

//---***========================================***---注入元素的src和href---***========================================***---
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

    console.log("ELEMENT PROPERTY (get/set attribute) INJECTED");

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

        console.log("Hooked " + whichElement.name + " " + whichProperty);
    }

    console.log("ELEMENT PROPERTY (src / href) INJECTED");
}

//---***========================================***---注入location---***========================================***---
class ProxyLocation {
    constructor(originalLocation) {
        this.originalLocation = originalLocation;
    }

    reload(forcedReload) {
        this.originalLocation.reload(forcedReload);
    }

    replace(url) {
        this.originalLocation.replace(changeURL(url));
    }

    assign(url) {
        this.originalLocation.assign(changeURL(url));
    }

    get href() {
        return "https://www.google.com/";
    }

    set href(url) {
        this.originalLocation.href = changeURL(url);
    }

    get protocol() {
        return "https:";
    }

    set protocol(value) {
        this.originalLocation.href = proxy_host_with_schema + "https://www.google.com/";
    }

    get host() {
        return "www.google.com";
    }

    set host(value) {
        this.originalLocation.href = proxy_host_with_schema + "https://www.google.com/";
    }

    get hostname() {
        return "www.google.com";
    }

    set hostname(value) {
        this.originalLocation.href = proxy_host_with_schema + "https://www.google.com/";
    }

    get port() {
        return "";
    }

    set port(value) {
        this.originalLocation.href = proxy_host_with_schema + "https://www.google.com/";
    }

    get pathname() {
        return "/";
    }

    set pathname(value) {
        this.originalLocation.href = proxy_host_with_schema + "https://www.google.com" + value;
    }

    get search() {
        return window.location.search;
    }

    set search(value) {
        this.originalLocation.href = proxy_host_with_schema + "https://www.google.com/" + value;
    }

    get hash() {
        return window.location.hash;
    }

    set hash(value) {
        this.originalLocation.href = proxy_host_with_schema + "https://www.google.com/" + value;
    }

    get origin() {
        return "https://www.google.com";
    }

    toString() {
        return "https://www.google.com/";
    }
}

function documentLocationInject() {
    Object.defineProperty(document, 'URL', {
        get: function () {
            return "https://www.google.com/";
        }
    });

    Object.defineProperty(document, '${replaceUrlObj}', {
        get: function () {
            return new ProxyLocation(window.location);
        },
        set: function (url) {
            window.location.href = changeURL(url);
        }
    });
    console.log("DOCUMENT LOCATION INJECTED");
}

function windowLocationInject() {
    Object.defineProperty(window, '${replaceUrlObj}', {
        get: function () {
            return new ProxyLocation(window.location);
        },
        set: function (url) {
            window.location.href = changeURL(url);
        }
    });
    console.log("WINDOW LOCATION INJECTED");
}

//---***========================================***---注入历史---***========================================***---
function historyInject() {
    const originalPushState = History.prototype.pushState;
    const originalReplaceState = History.prototype.replaceState;
    const originalBack = History.prototype.back;
    const originalForward = History.prototype.forward;
    const originalGo = History.prototype.go;

    History.prototype.pushState = function (state, title, url) {
        if (!url) return;
        var u = changeURL(url);
        return originalPushState.apply(this, [state, title, u]);
    };

    History.prototype.replaceState = function (state, title, url) {
        console.log("History url started: " + url);
        if (!url) return;

        let url_str = url.toString();
        var u = changeURL(url_str);

        console.log("History url changed: " + u);

        return originalReplaceState.apply(this, [state, title, u]);
    };

    History.prototype.back = function () {
        return originalBack.apply(this);
    };

    History.prototype.forward = function () {
        return originalForward.apply(this);
    };

    History.prototype.go = function (delta) {
        return originalGo.apply(this, [delta]);
    };

    console.log("HISTORY INJECTED");
}

//---***========================================***---Hook观察界面---***========================================***---
function obsPage() {
    var gProxyObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            traverseAndConvert(mutation);
        });
    });
    var config = { attributes: true, childList: true, subtree: true };
    gProxyObserver.observe(document.body, config);

    console.log("OBSERVING THE WEBPAGE...");
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

    if (element.hasAttribute("href")) {
        relativePath = element.getAttribute("href");
        try {
            var absolutePath = changeURL(relativePath);
            element.setAttribute("href", absolutePath);
        } catch (e) {
            console.log("Exception occured: " + e.message);
        }
    }

    if (element.hasAttribute("src")) {
        relativePath = element.getAttribute("src");
        try {
            var absolutePath = changeURL(relativePath);
            element.setAttribute("src", absolutePath);
        } catch (e) {
            console.log("Exception occured: " + e.message);
        }
    }

    if (element.tagName === "FORM" && element.hasAttribute("action")) {
        relativePath = element.getAttribute("action");
        try {
            var absolutePath = changeURL(relativePath);
            element.setAttribute("action", absolutePath);
        } catch (e) {
            console.log("Exception occured: " + e.message);
        }
    }

    if (element.tagName === "SOURCE" && element.hasAttribute("srcset")) {
        relativePath = element.getAttribute("srcset");
        try {
            var absolutePath = changeURL(relativePath);
            element.setAttribute("srcset", absolutePath);
        } catch (e) {
            console.log("Exception occured: " + e.message);
        }
    }

    if ((element.tagName === "VIDEO" || element.tagName === "AUDIO") && element.hasAttribute("poster")) {
        relativePath = element.getAttribute("poster");
        try {
            var absolutePath = changeURL(relativePath);
            element.setAttribute("poster", absolutePath);
        } catch (e) {
            console.log("Exception occured: " + e.message);
        }
    }

    if (element.tagName === "OBJECT" && element.hasAttribute("data")) {
        relativePath = element.getAttribute("data");
        try {
            var absolutePath = changeURL(relativePath);
            element.setAttribute("data", absolutePath);
        } catch (e) {
            console.log("Exception occured: " + e.message);
        }
    }
}

function removeIntegrityAttributesFromElement(element) {
    if (element.hasAttribute('integrity')) {
        element.removeAttribute('integrity');
    }
}

function loopAndConvertToAbs() {
    for (var ele of document.querySelectorAll('*')) {
        removeIntegrityAttributesFromElement(ele);
        covToAbs(ele);
    }
    console.log("LOOPED EVERY ELEMENT");
}

function covScript() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
        covToAbs(scripts[i]);
    }
    setTimeout(covScript, 3000);
}

//---***========================================***---操作---***========================================***---
networkInject();
windowOpenInject();
elementPropertyInject();
appendChildInject();
documentLocationInject();
windowLocationInject();
historyInject();

//---***========================================***---在window.load之后的操作---***========================================***---
window.addEventListener('load', () => {
    loopAndConvertToAbs();
    console.log("CONVERTING SCRIPT PATH");
    obsPage();
    covScript();
});
console.log("WINDOW ONLOAD EVENT ADDED");

//---***========================================***---在window.error的时候---***========================================***---
window.addEventListener('error', event => {
    var element = event.target || event.srcElement;
    if (element.tagName === 'SCRIPT') {
        console.log("Found problematic script:", element);
        if (element.alreadyChanged) {
            console.log("this script has already been injected, ignoring this problematic script...");
            return;
        }
        removeIntegrityAttributesFromElement(element);
        covToAbs(element);

        var newScript = document.createElement("script");
        newScript.src = element.src;
        newScript.async = element.async;
        newScript.defer = element.defer;
        newScript.alreadyChanged = true;

        document.head.appendChild(newScript);

        console.log("New script added:", newScript);
    }
}, true);
console.log("WINDOW CORS ERROR EVENT ADDED");
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

    if (element.tagName === 'SCRIPT') {
      if (element.textContent && !element.src) {
          element.textContent = replaceContentPaths(element.textContent);
      }
    }
  
    if (element.tagName === 'STYLE') {
      if (element.textContent) {
          element.textContent = replaceContentPaths(element.textContent);
      }
    }
  });

  let modifiedHtml = tempDoc.documentElement.outerHTML;

  let charset = modifiedHtml.match(/content="text\\/html;\\s*charset=[^"]*"/);
  console.log(charset);
  if(charset != null && charset.length !== 0){
    modifiedHtml = modifiedHtml.replace(charset[0], "content='text/html;charset=utf-8'");
  }

  document.open();
  document.write('<!DOCTYPE html>' + modifiedHtml);
  document.close();
}

function replaceContentPaths(content){
  let regex = new RegExp(\`(https?:\\\\/\\\\/[^\s'"]+)\`, 'g');
  content = content.replaceAll(regex, (match) => {
    if (match.startsWith("http://www.w3.org/") || match.startsWith("https://www.w3.org/")) return match;
    
    if (match.startsWith("http")) {
      return proxy_host_with_schema + match;
    } else {
      return proxy_host + "/" + match;
    }
  });

  return content;
}
`;

async function handleRequest(request) {
  // =======================================================================================
  // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-* 处理前置情况 *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*
  // =======================================================================================

  const url = new URL(request.url);
  
  if (request.url.endsWith("favicon.ico")) {
    return getRedirect("https://www.google.com/favicon.ico");
  }
  
  if (request.url.endsWith("robots.txt")) {
    return new Response(\`User-Agent: *
Disallow: /\`, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  // 获取路径和查询参数 - 直接转发所有请求到Google
  var actualUrlStr = url.pathname + url.search + url.hash;
  
  // 如果只访问根路径，则直接转向Google首页
  if (actualUrlStr === "" || actualUrlStr === "/") {
    actualUrlStr = "https://www.google.com/";
  }

  try {
    var test = actualUrlStr;
    if (!test.startsWith("http")) {
      test = "https://www.google.com" + (test.startsWith("/") ? test : "/" + test);
    }
    var u = new URL(test);
  } catch {
    return getHTMLResponse("Invalid request");
  }

  if (!actualUrlStr.startsWith("http")) {
    if (actualUrlStr.startsWith("/")) {
      actualUrlStr = "https://www.google.com" + actualUrlStr;
    } else {
      actualUrlStr = "https://www.google.com/" + actualUrlStr;
    }
  }

  const actualUrl = new URL(actualUrlStr);

  // =======================================================================================
  // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-* 处理客户端发来的 Header *-*-*-*-*-*-*-*-*-*-*-*-*
  // =======================================================================================

  let clientHeaderWithChange = new Headers();
  
  request.headers.forEach((value, key) => {
    var newValue = value.replaceAll(thisProxyServerUrlHttps + "http", "http");
    var newValue = newValue.replaceAll(thisProxyServerUrlHttps, \`\${actualUrl.protocol}//\${actualUrl.hostname}/\`);
    var newValue = newValue.replaceAll(thisProxyServerUrlHttps.substring(0, thisProxyServerUrlHttps.length - 1), \`\${actualUrl.protocol}//\${actualUrl.hostname}\`);
    var newValue = newValue.replaceAll(thisProxyServerUrl_hostOnly, actualUrl.host);
    clientHeaderWithChange.set(key, newValue);
  });

  // =======================================================================================
  // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-* 处理客户端发来的 Body *-*-*-*-*-*-*-*-*-*-*-*-*-*
  // =======================================================================================

  let clientRequestBodyWithChange;
  
  if (request.body) {
    const [body1, body2] = request.body.tee();
    try {
      const bodyText = await new Response(body1).text();

      if (bodyText.includes(thisProxyServerUrlHttps) ||
        bodyText.includes(thisProxyServerUrl_hostOnly)) {
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

  // =======================================================================================
  // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-* 构造代理请求 *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*
  // =======================================================================================

  const modifiedRequest = new Request(actualUrl, {
    headers: clientHeaderWithChange,
    method: request.method,
    body: (request.body) ? clientRequestBodyWithChange : request.body,
    redirect: "manual"
  });

  // =======================================================================================
  // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-* Fetch结果 *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*
  // =======================================================================================

  const response = await fetch(modifiedRequest);
  console.log("upstream status: " + response.status + " url: " + actualUrlStr);
  
  if (response.status.toString().startsWith("3") && response.headers.get("Location") != null) {
    try {
      return getRedirect(thisProxyServerUrlHttps + new URL(response.headers.get("Location"), actualUrlStr).href, response, actualUrl);
    } catch {
      return getHTMLResponse("Error while redirecting");
    }
  }

  // =======================================================================================
  // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-* 处理获取的结果 *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*
  // =======================================================================================

  var modifiedResponse;
  var bd;
  
  const contentType = response.headers.get("Content-Type");
  var isHTML = false;

  // =======================================================================================
  // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-* 如果有 Body 就处理 *-*-*-*-*-*-*-*-*-*-*-*-*-*-*
  // =======================================================================================
  
  if (response.body) {
    let isText = false;
    let isTextDetectingKeyword = ["text/", "application/json", "application/javascript"]
    isTextDetectingKeyword.forEach(x => {if(contentType && contentType.includes(x)) isText = true;})
    
    if (isText) {
      const rawBytes = await response.arrayBuffer();
      let encoding = 'utf-8';
      
      console.log("content type: " + contentType);
      
      if (contentType) {
          let m = contentType.match(/charset=([^\\s;]+)/i);
          if (m){
            console.log(m);
            encoding = m[1];
          }else if (contentType.includes("text/html")) {
            let preview = new TextDecoder('utf-8').decode(rawBytes.slice(0, 1024 * 2));
            let metaMatch = preview.match(/charset\\s*=\\s*["']?\\s*([^\\s"';>]+)/i);
            if (metaMatch) {
              encoding = metaMatch[1];
              console.log("Detected charset from meta: " + encoding);
            }
          }
      }
      
      console.log(encoding);
      
      try{
        bd = new TextDecoder(encoding).decode(rawBytes);
      }catch(ex){
        console.log(ex);
        bd = new TextDecoder('utf-8').decode(rawBytes);
      }

      console.log(bd);

      isHTML = (contentType && contentType.includes("text/html") && bd.includes("<html"));

      // =======================================================================================
      // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-* 如果是 HTML 或者 JS ，替换掉转跳的 Class *-*-*-*-*
      // =======================================================================================
      
      if (contentType && (contentType.includes("html") || contentType.includes("javascript"))) {
        bd = bd.replaceAll("window.location", "window." + replaceUrlObj);
        bd = bd.replaceAll("document.location", "document." + replaceUrlObj);
        bd = bd.replaceAll("location.href", replaceUrlObj + ".href");
        bd = bd.replaceAll("location.replace(", replaceUrlObj + ".replace(");
        bd = bd.replaceAll("location.assign(", replaceUrlObj + ".assign(");
      }

      // =======================================================================================
      // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-* 如果是 HTML *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*
      // =======================================================================================
      
      if (isHTML) {
        var hasBom = false;
        if (bd.charCodeAt(0) === 0xFEFF) {
          bd = bd.substring(1);
          hasBom = true;
        }

        var inject =
          \`
        <!DOCTYPE html>
        <script>
        



        (function () {
          // hooks stuff - Must before convert path functions
          \${httpRequestInjection}

          // Convert path functions
          \${htmlCovPathInject}

          // Invoke the function
          const originalBodyBase64Encoded = "\${new TextEncoder().encode(bd)}";

          const bytes = new Uint8Array(originalBodyBase64Encoded.split(',').map(Number));

          console.log(
            '%c' + 'Google Proxy Debug Start',
            'color: blue; font-size: 15px;'
          );
          console.log(
            '%c' + new TextDecoder().decode(bytes),
            'color: green; font-size: 10px; padding:5px;'
          );
          console.log(
            '%c' + 'Google Proxy Debug End',
            'color: blue; font-size: 15px;'
          );

          \${htmlCovPathInjectFuncName}(new TextDecoder().decode(bytes));
        })();
          </script>
        \`;

        bd = (hasBom ? "\uFEFF" : "") + inject;
      }
      
      // =======================================================================================
      // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-* 如果不是 HTML，就 Regex 替换掉链接 *-*
      // =======================================================================================
      else {
        let regex = new RegExp(\`(https?:\\\\/\\\\/[^\\s'"]+)\`, 'g');
        bd = bd.replaceAll(regex, (match) => {
          if (match.startsWith("http://www.w3.org/") || match.startsWith("https://www.w3.org/")) return match;
          if (match.startsWith("http")) {
            return thisProxyServerUrlHttps + match;
          } else {
            return thisProxyServerUrl_hostOnly + "/" + match;
          }
        });
      }

      modifiedResponse = new Response(bd, response);
      modifiedResponse.headers.set("Content-Type", contentType.replace(/charset=([^\\s;]+)/i, "charset=utf-8"));
    }
    else {
      modifiedResponse = new Response(response.body, response);
    }
  }
  else {
    modifiedResponse = new Response(response.body, response);
  }

  // =======================================================================================
  // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-* 处理要返回的 Cookie Header *-*-*-*-*-*-*-*-*-*-*
  // =======================================================================================
  
  handleCookieHeader(modifiedResponse, isHTML, response, actualUrlStr, actualUrl);

  // =======================================================================================
  // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-* 删除部分限制性的 Header *-*-*-*-*-*-*-*-*-*-*-*-*
  // =======================================================================================

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

      // Modify Path
      let pathIndex = parts.findIndex(part => part.toLowerCase().startsWith('path='));
      let originalPath = "/";
      if (pathIndex !== -1) {
        originalPath = parts[pathIndex].substring("path=".length);
      }
      let absolutePath = "/" + new URL(originalPath, actualUrlStr).href;

      if (pathIndex !== -1) {
        parts[pathIndex] = \`Path=\${absolutePath}\`;
      } else {
        parts.push(\`Path=\${absolutePath}\`);
      }

      // Modify Domain
      let domainIndex = parts.findIndex(part => part.toLowerCase().startsWith('domain='));
      if (domainIndex !== -1) {
        parts[domainIndex] = \`domain=\${thisProxyServerUrl_hostOnly}\`;
      } else {
        parts.push(\`domain=\${thisProxyServerUrl_hostOnly}\`);
      }

      // 用 append 而不是 set，确保多个 Set-Cookie 不会互相覆盖
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
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
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
