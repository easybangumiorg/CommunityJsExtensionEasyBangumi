var URI = Packages.java.net.URI;
var URLEncoder = Packages.java.net.URLEncoder;
var Jsoup = Packages.org.jsoup.Jsoup;
function print(value) { Packages.java.lang.System.out.println(String(value)); }
var ArrayList = Packages.java.util.ArrayList;
var HashMap = Packages.java.util.HashMap;
var testPreferences = {};
var source = { key: "heyanle.ggl" };
var Inject_NetworkHelper = { defaultLinuxUA: "fixture-user-agent" };
var Inject_PreferenceHelper = { get: function(key, fallback) { return Object.prototype.hasOwnProperty.call(testPreferences, key) ? testPreferences[key] : fallback; } };
var queuedResponses = [];
var requests = [];
var responseClosed = 0;
var Inject_OkhttpHelper = { client: { newCall: function(request) {
    requests.push(request);
    return { execute: function() {
        if (queuedResponses.length == 0) { throw new Error("No fixture response"); }
        var raw = queuedResponses.shift();
        return {
            code: function() { return raw.status; },
            isSuccessful: function() { return raw.status >= 200 && raw.status < 300; },
            header: function(name) { return name == "Content-Type" ? raw.type || "application/json" : null; },
            body: function() { return { string: function() { return raw.text != null ? raw.text : JSON.stringify(raw.data || {}); } }; },
            close: function() { responseClosed++; }
        };
    } };
} } };
function ParserException(message, cause) { this.message = String(message); this.cause = cause; }
ParserException.prototype = new Error();
function Pair(first, second) { this.first = first; this.second = second; }
function MainTab(label, type, ext) { this.label = label; this.type = type; this.ext = ext; }
MainTab.MAIN_TAB_WITH_COVER = 1;
function Episode(id, label, order) { this.id = id; this.label = label; this.order = order; }
function PlayLine(id, label, episode) { this.id = id; this.label = label; this.episode = episode; }
function PlayerInfo(type, uri) { this.decodeType = type; this.uri = uri; }
PlayerInfo.DECODE_TYPE_OTHER = 4;
PlayerInfo.DECODE_TYPE_HLS = 2;
PlayerInfo.DECODE_TYPE_DASH = 0;
var Cartoon = { STATUS_UNKNOWN: 0, STATUS_ONGOING: 1, STATUS_COMPLETED: 2, UPDATE_STRATEGY_ALWAYS: 0 };
var SourcePreference = { Edit: function(label, key, fallback) { this.label = label; this.key = key; this.fallback = fallback; } };
function makeCartoonCover(value) { return value; }
function makeCartoon(value) { return value; }
var SourceUtils = { urlParser: function(base, value) { return String(new URI(base).resolve(value)); } };
var MediaType = { get: function(value) { return value; } };
var RequestBody = { create: function(type, body) { return { type: type, content: body }; } };
var Request = { Builder: function() {
    var result = { headers: {} };
    this.url = function(value) { result.url = value; return this; };
    this.header = function(name, value) { result.headers[name] = value; return this; };
    this.post = function(body) { result.body = body; return this; };
    this.build = function() { return result; };
} };
var OkhttpUtils = { get: function(url, headers) { return { url: url, headers: headers }; } };
