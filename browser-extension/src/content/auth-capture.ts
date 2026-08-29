import browser from "webextension-polyfill";

const INJECTED = "ccm-auth-injected";
const PROBE_MESSAGE = "ccm-probe-auth";

function injectPageHook(): void {
  if (document.documentElement.getAttribute(INJECTED)) return;
  document.documentElement.setAttribute(INJECTED, "1");

  const script = document.createElement("script");
  script.textContent = `
(function() {
  const API_HOSTS = ["api2.cursor.sh", "cursor.com/api", "www.cursor.com/api"];
  function isCursorApi(url) {
    if (!url) return false;
    return API_HOSTS.some(function(host) { return url.indexOf(host) !== -1; });
  }
  function persist(token) {
    if (!token || token.length < 20) return;
    window.postMessage({ source: "ccm-auth", token: token }, "*");
  }
  function extractBearer(headers) {
    if (!headers) return null;
    if (headers instanceof Headers) {
      var auth = headers.get("Authorization") || headers.get("authorization");
      return auth && auth.indexOf("Bearer ") === 0 ? auth.slice(7) : null;
    }
    if (Array.isArray(headers)) {
      for (var i = 0; i < headers.length; i++) {
        var pair = headers[i];
        if (pair[0].toLowerCase() === "authorization" && pair[1].indexOf("Bearer ") === 0) {
          return pair[1].slice(7);
        }
      }
      return null;
    }
    var auth2 = headers.Authorization || headers.authorization;
    return auth2 && auth2.indexOf("Bearer ") === 0 ? auth2.slice(7) : null;
  }
  function jwtFromSessionCookie(value) {
    if (!value) return null;
    try { value = decodeURIComponent(value); } catch (e) {}
    var sep = value.indexOf("::");
    if (sep >= 0) {
      var token = value.slice(sep + 2).trim();
      return token.length >= 20 ? token : null;
    }
    var raw = value.replace(/^Bearer\\s+/i, "").trim();
    return raw.indexOf("eyJ") === 0 && raw.length >= 20 ? raw : null;
  }
  function scanStorage() {
    try {
      var stores = [window.localStorage, window.sessionStorage];
      for (var s = 0; s < stores.length; s++) {
        var store = stores[s];
        if (!store) continue;
        for (var i = 0; i < store.length; i++) {
          var val = store.getItem(store.key(i));
          if (!val || val.length < 40) continue;
          var trimmed = val.replace(/^Bearer\\s+/i, "").trim();
          if (trimmed.indexOf("eyJ") === 0) persist(trimmed);
        }
      }
    } catch (e) {}
  }
  function scanDocumentCookie() {
    try {
      var parts = document.cookie.split(";");
      for (var i = 0; i < parts.length; i++) {
        var chunk = parts[i].trim();
        if (chunk.indexOf("WorkosCursorSessionToken=") !== 0) continue;
        var token = jwtFromSessionCookie(chunk.slice("WorkosCursorSessionToken=".length));
        if (token) persist(token);
      }
    } catch (e) {}
  }
  function probeAuth() {
    scanDocumentCookie();
    scanStorage();
  }
  window.addEventListener("message", function(event) {
    if (event.source !== window || !event.data) return;
    if (event.data.source === "${PROBE_MESSAGE}") probeAuth();
  });
  var origFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    var url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (isCursorApi(url)) {
      var token = extractBearer(init && init.headers) ||
        (input instanceof Request ? extractBearer(input.headers) : null);
      if (token) persist(token);
    }
    return origFetch(input, init).then(function(response) {
      if (isCursorApi(url)) {
        var headerToken = extractBearer(response.headers);
        if (headerToken) persist(headerToken);
      }
      return response;
    });
  };
  var XHR = XMLHttpRequest.prototype;
  var origOpen = XHR.open;
  var origSetHeader = XHR.setRequestHeader;
  XHR.open = function(method, url) {
    this._ccmUrl = String(url);
    return origOpen.apply(this, arguments);
  };
  XHR.setRequestHeader = function(name, value) {
    if (name.toLowerCase() === "authorization" && value.indexOf("Bearer ") === 0 &&
        isCursorApi(this._ccmUrl)) {
      persist(value.slice(7));
    }
    return origSetHeader.apply(this, arguments);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", probeAuth);
  } else {
    probeAuth();
  }
  setTimeout(probeAuth, 1200);
  setTimeout(probeAuth, 4000);
})();
`;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data as { source?: string; token?: string };
  if (data?.source === "ccm-auth" && data.token) {
    void browser.runtime.sendMessage({
      type: "tokenCaptured",
      token: data.token,
    });
  }
});

browser.runtime.onMessage.addListener((message) => {
  const msg = message as { type?: string };
  if (msg.type === "probeAuth") {
    window.postMessage({ source: PROBE_MESSAGE }, "*");
    void browser.runtime.sendMessage({ type: "probeAuth" });
  }
});

injectPageHook();
