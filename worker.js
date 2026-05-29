// ============================================================
//  Cloudflare Worker 反代 Google + 自建 reCAPTCHA 接管验证
// ============================================================
// 配置区域
const UPSTREAM = 'ipv6.google.com.hk'; // 固定使用 IPv6 域名
const CUSTOM_DOMAIN = 'g.sakcn.icu';   // 你的代理域名
const RECAPTCHA_SITE_KEY = '6Lf0yQItAAAAAH-dzgdOH_3PjjrFnDCucgIi6GWD';
const RECAPTCHA_SECRET_KEY = '6Lf0yQItAAAAADfMfWw6KI4mOh_RXEjBJHgPXOx6';
const RECAPTCHA_API_URL = 'https://www.recaptcha.net/recaptcha/api/siteverify';
const YOUR_VERIFICATION_ENDPOINT = 'https://g.sakcn.icu/verify'; // 你的验证页面URL

// 请求头伪装 - 使用你提供的真实手机 Chrome UA
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';
const ACCEPT_LANGUAGE = 'zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7';
const SEC_CH_UA = '"Not_A Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"';
const SEC_CH_UA_MOBILE = '?1';
const SEC_CH_UA_PLATFORM = '"Android"';

// 资源重定向表
const REPLACE_DICT = {
  'ipv6.google.com.hk': CUSTOM_DOMAIN,
  'www.google.com.hk': CUSTOM_DOMAIN,
  'www.google.com': CUSTOM_DOMAIN,
  'accounts.google.com': CUSTOM_DOMAIN,
  'apis.google.com': CUSTOM_DOMAIN,
  'recaptcha.net': CUSTOM_DOMAIN,
  'www.recaptcha.net': CUSTOM_DOMAIN,
  'ssl.gstatic.com': 'gstatic.cn',
  'fonts.googleapis.com': 'fonts.googleapis.cn',
  'ajax.googleapis.com': 'ajax.lug.ustc.edu.cn',
  'themes.googleusercontent.com': 'google-themes.lug.ustc.edu.cn',
};

// ============================================================
//  主函数
// ============================================================
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const requestUrl = url.href;

  // HTTP -> HTTPS 重定向
  if (url.protocol === 'http:') {
    url.protocol = 'https:';
    return Response.redirect(url.href, 301);
  }

  // 检查是否需要显示自定义验证页面
  if (requestUrl.includes('google.com/search') && shouldShowCaptcha(request)) {
    return showCustomCaptchaPage();
  }

  // 处理验证回调（/verify 端点）
  if (requestUrl.includes('/verify')) {
    return handleVerification(request);
  }

  // 正常反代流程
  return proxyRequest(request, url);
}

// ============================================================
//  判断是否显示验证页
// ============================================================
function shouldShowCaptcha(request) {
  // 检查是否有已验证的 session
  const cookie = request.headers.get('Cookie') || '';
  if (cookie.includes('g_captcha_verified=true')) {
    return false; // 已验证通过，放行
  }
  // 默认触发验证
  return true;
}

// ============================================================
//  展示自建 reCAPTCHA 验证页面
// ============================================================
function showCustomCaptchaPage() {
  const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>人机验证 - Google 搜索</title>
    <script src="https://www.recaptcha.net/recaptcha/api.js" async defer></script>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .container {
            background: white;
            border-radius: 10px;
            padding: 2rem;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
            width: 90%;
        }
        h2 {
            color: #333;
            margin-bottom: 1rem;
        }
        p {
            color: #666;
            margin-bottom: 2rem;
        }
        .g-recaptcha {
            display: inline-block;
            margin-bottom: 1rem;
        }
        button {
            background: #4285f4;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.3s;
        }
        button:hover {
            background: #3367d6;
        }
        .loading {
            display: none;
            margin-top: 1rem;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>人机验证</h2>
        <p>为了继续使用 Google 搜索，请完成下方验证</p>
        <form id="captchaForm" action="/verify" method="POST">
            <div class="g-recaptcha" data-sitekey="${RECAPTCHA_SITE_KEY}" data-callback="onCaptchaSuccess"></div>
            <input type="hidden" id="g-recaptcha-response" name="g-recaptcha-response">
            <button type="submit">提交验证并继续</button>
        </form>
        <div class="loading" id="loading">验证中，请稍候...</div>
    </div>
    <script>
        function onCaptchaSuccess(token) {
            document.getElementById('g-recaptcha-response').value = token;
            document.getElementById('loading').style.display = 'block';
            document.getElementById('captchaForm').submit();
        }
        
        // 自动聚焦到验证框
        if (typeof grecaptcha !== 'undefined') {
            grecaptcha.ready(function() {
                grecaptcha.execute();
            });
        }
    </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

// ============================================================
//  处理验证请求
// ============================================================
async function handleVerification(request) {
  const url = new URL(request.url);
  const formData = await request.formData();
  const captchaResponse = formData.get('g-recaptcha-response');

  if (!captchaResponse) {
    return new Response('验证失败：请完成 reCAPTCHA 验证', { status: 400 });
  }

  // 验证 reCAPTCHA token
  const verificationResult = await verifyRecaptchaToken(captchaResponse);
  if (!verificationResult.success) {
    console.error('reCAPTCHA 验证失败:', verificationResult['error-codes']);
    return new Response('验证失败：请重试', { status: 400 });
  }

  // 验证成功，设置 session cookie 并重定向回原始搜索页面
  const redirectUrl = url.searchParams.get('redirect') || '/search?q=test';
  return new Response(null, {
    status: 302,
    headers: {
      'Location': redirectUrl,
      'Set-Cookie': 'g_captcha_verified=true; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Lax',
    },
  });
}

// ============================================================
//  reCAPTCHA token 验证函数
// ============================================================
async function verifyRecaptchaToken(token) {
  const response = await fetch(RECAPTCHA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      secret: RECAPTCHA_SECRET_KEY,
      response: token,
    }),
  });
  return response.json();
}

// ============================================================
//  反代请求核心函数
// ============================================================
async function proxyRequest(request, originalUrl) {
  const method = request.method;
  const requestHeaders = request.headers;

  // 构建新的请求头
  const newHeaders = new Headers(requestHeaders);
  newHeaders.set('Host', UPSTREAM);
  newHeaders.set('User-Agent', USER_AGENT);
  newHeaders.set('Accept-Language', ACCEPT_LANGUAGE);
  newHeaders.set('Sec-Ch-Ua', SEC_CH_UA);
  newHeaders.set('Sec-Ch-Ua-Mobile', SEC_CH_UA_MOBILE);
  newHeaders.set('Sec-Ch-Ua-Platform', SEC_CH_UA_PLATFORM);
  newHeaders.set('Sec-Fetch-Site', 'same-origin');
  newHeaders.set('Sec-Fetch-Mode', 'navigate');
  newHeaders.set('Sec-Fetch-User', '?1');
  newHeaders.set('Sec-Fetch-Dest', 'document');
  newHeaders.set('Upgrade-Insecure-Requests', '1');
  newHeaders.set('Cache-Control', 'max-age=0');
  newHeaders.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
  newHeaders.set('Accept-Encoding', 'gzip, deflate, br');
  newHeaders.set('Connection', 'keep-alive');
  // 关键：移除 CF 特有的 IP 头，防止 Google 检测到代理 IP
  newHeaders.delete('CF-Connecting-IP');
  newHeaders.delete('CF-IPCountry');
  newHeaders.delete('CF-Ray');
  newHeaders.delete('CF-Visitor');
  newHeaders.delete('X-Forwarded-For');
  newHeaders.delete('X-Real-IP');

  // 构建上游 URL
  let upstreamUrl = `https://${UPSTREAM}${originalUrl.pathname}${originalUrl.search}`;

  // 发起请求到 Google
  let upstreamResponse;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: method,
      headers: newHeaders,
      redirect: 'manual', // 手动处理重定向
    });
  } catch (err) {
    console.error('上游请求失败:', err);
    return new Response('网络错误，请稍后重试', { status: 502 });
  }

  // 处理响应
  let response = new Response(upstreamResponse.body, upstreamResponse);
  const responseHeaders = new Headers(response.headers);
  const contentType = responseHeaders.get('content-type') || '';

  // 清理安全策略头
  responseHeaders.delete('content-security-policy');
  responseHeaders.delete('content-security-policy-report-only');
  responseHeaders.delete('clear-site-data');

  // 添加 CORS 头
  responseHeaders.set('access-control-allow-origin', '*');
  responseHeaders.set('access-control-allow-credentials', 'true');
  responseHeaders.set('cache-control', 'public, max-age=14400');

  // 保留已有的验证 cookie（如果有）
  const existingCookie = responseHeaders.get('set-cookie');
  if (existingCookie && !existingCookie.includes('g_captcha_verified')) {
    responseHeaders.set('set-cookie', `${existingCookie}; g_captcha_verified=true; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Lax`);
  } else if (!existingCookie) {
    responseHeaders.set('set-cookie', 'g_captcha_verified=true; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Lax');
  }

  // 如果是 HTML 且包含验证页面，尝试替换
  if (contentType.includes('text/html')) {
    let text = await upstreamResponse.text();
    text = replaceResponseText(text);
    response = new Response(text, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } else {
    response = new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  }

  return response;
}

// ============================================================
//  替换响应文本中的域名
// ============================================================
function replaceResponseText(text) {
  let result = text;
  for (const [search, replace] of Object.entries(REPLACE_DICT)) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    result = result.replace(regex, replace);
  }
  return result;
}