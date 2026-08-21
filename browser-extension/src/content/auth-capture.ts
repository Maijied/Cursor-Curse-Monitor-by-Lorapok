import browser from "webextension-polyfill";

const INJECTED = "ccm-auth-injected";

function injectPageHook(): void {
  if (document.documentElement.getAttribute(INJECTED)) return;
  document.documentElement.setAttribute(INJECTED, "1");

  const script = document.createElement("script");
  script.textContent = `
(function() {
  const API_HOST = "api2.cursor.sh";
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
  var origFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    var url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.indexOf(API_HOST) !== -1) {
      var token = extractBearer(init && init.headers) ||
        (input instanceof Request ? extractBearer(input.headers) : null);
      if (token) persist(token);
    }
    return origFetch(input, init);
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
        this._ccmUrl && this._ccmUrl.indexOf(API_HOST) !== -1) {
      persist(value.slice(7));
    }
    return origSetHeader.apply(this, arguments);
  };
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

injectPageHook();
