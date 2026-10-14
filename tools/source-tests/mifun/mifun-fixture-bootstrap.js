function print(value) { Packages.java.lang.System.out.println(String(value)); }
var URI = Packages.java.net.URI;
var URLEncoder = Packages.java.net.URLEncoder;
var URLDecoder = Packages.java.net.URLDecoder;
var ArrayList = Packages.java.util.ArrayList;
var HashMap = Packages.java.util.HashMap;
var Jsoup = Packages.org.jsoup.Jsoup;
var testHost = "";
var assertionCount = 0;
var source = { key: "kazumi.mifun" };
var Inject_NetworkHelper = { defaultLinuxUA: "fixture-UA" };
var Inject_PreferenceHelper = { get: function(key, fallback) { return key == "Host" ? testHost : fallback; } };
var queuedResponses = [], requests = [], responseClosed = 0;
var Inject_OkhttpHelper = { client: { newCall: function(request) {
    requests.push(request);
    return { execute: function() {
        if (!queuedResponses.length) { throw new Error("No fixture response: " + request.url); }
        var raw = queuedResponses.shift();
        return { code: function() { return raw.status || 200; },
            isSuccessful: function() { return (raw.status || 200) >= 200 && (raw.status || 200) < 300; },
            body: function() { return { string: function() { return String(raw.text); } }; },
            close: function() { responseClosed++; } };
    } };
} } };
var proxyCreations = 0, providedProxy = null;
var Inject_WebProxyProvider = { getWebProxy: function() { proxyCreations++; return providedProxy; } };
function ParserException(message, cause) { this.message = String(message); }
ParserException.prototype = new Error();
function Pair(first, second) { this.first = first; this.second = second; }
function MainTab(label, type) { this.label = label; this.type = type; }
MainTab.MAIN_TAB_WITH_COVER = 1;
function Episode(id, label, order) { this.id = id; this.label = label; this.order = order; }
function PlayLine(id, label, episodes) { this.id = id; this.label = label; this.episodes = episodes; }
function PlayerInfo(type, uri) { this.decodeType = type; this.uri = uri; }
PlayerInfo.DECODE_TYPE_OTHER = 4;PlayerInfo.DECODE_TYPE_HLS = 2;
var Cartoon = { STATUS_UNKNOWN: 0, STATUS_ONGOING: 1, STATUS_COMPLETED: 2, UPDATE_STRATEGY_ALWAYS: 0 };
var SourcePreference = { Edit: function(label, key, fallback) { this.label = label; this.key = key; this.fallback = fallback; } };
function makeCartoonCover(value) { return value; }function makeCartoon(value) { return value; }
var OkhttpUtils = { get: function(url, headers) { return { url: String(url), headers: headers }; } };
function assert(value, label) { assertionCount++; if (!value) { throw new Error("FAIL: " + label); } }
function same(a, b, label) { assert(String(a) == String(b), label + " expected " + b + " received " + a); }
function throws(fn, label) { var caught = false;try { fn(); } catch(e) { caught = true; }assert(caught, label); }
function queue(html, status) { queuedResponses.push({text: html, status: status || 200}); }
function expectParserError(fn, text, label) {
    var caught = null;
    try { fn(); } catch (error) { caught = error; }
    assert(caught instanceof ParserException, label + " returns ParserException");
    assert(caught.message.indexOf(text) >= 0, label + " has actionable error");
}
function mockProxy(html, media) { return { loads: 0, closes: 0, checks: 0, wait: 0, hrefs: 0, delays: 0, docReads: 0, resourceReads: 0,
    html: String(html), media: media || null, loaded: true, ready: "complete",
    loadUrl: function(url) { this.loads++;this.url = String(url); },
    href: function(url, clean) { this.hrefs++;this.url = String(url);if (this.nextHtml != null) { this.html = this.nextHtml; } },
    delay: function(ms) { this.delays++;assert(ms <= 1000, "bounded verification DOM poll"); },
    waitingForPageLoaded: function(timeout) { this.wait = timeout;return this.loaded; },
    waitingForResourceLoaded: function(regex, sticky, timeout) { this.resourceReads++;return this.media; },
    getContent: function() { this.docReads++;return this.html; },
    executeJavaScript: function(script) {
        if (String(script).indexOf("location.origin") >= 0) {
            if (this.state != null) { return JSON.stringify(this.state); }
            this.lastScript = String(script);
            var uri = new URI(String(this.url || siteUrl("/vodsearch/?wd=" + URLEncoder.encode(searchPagination.keyword, "UTF-8"))));
            var state = {origin:String(uri.getScheme())+"://"+String(uri.getRawAuthority()),path:String(uri.getRawPath()),ready:this.ready,wd:"",wdCount:0};
            if (/\/vodsearch\/?$/.test(state.path)) {
                var pairs = String(uri.getRawQuery() || "").split("&");
                for (var i=0;i<pairs.length;i++) {
                    var equal = pairs[i].indexOf("=");
                    var name = String(URLDecoder.decode(equal < 0 ? pairs[i] : pairs[i].substring(0,equal),"UTF-8"));
                    if (name == "wd") {
                        if (state.wdCount == 0) { state.wd = String(URLDecoder.decode(equal < 0 ? "" : pairs[i].substring(equal+1),"UTF-8")); }
                        state.wdCount++;
                    }
                }
            }
            return JSON.stringify(state);
        }
        throw new Error("Unexpected browser script");
    },
    close: function() { this.closes++; },needUserCheck: function() { this.checks++;throw new Error("verification transfer"); }
}; }
