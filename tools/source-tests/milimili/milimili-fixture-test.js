var assertions = 0;
function equal(actual, expected, message) {
    assertions++;
    if (String(actual) != String(expected)) { throw new Error(message + ": " + actual + " != " + expected); }
}
function truth(value, message) { equal(!!value, true, message); }
function throws(fn, needle, message) {
    var caught = null;
    try { fn(); } catch (error) { caught = error; }
    truth(caught != null, message + " throws");
    if (needle) { truth(String(caught.message).indexOf(needle) >= 0, message + " message"); }
    return caught;
}
function queue(status, data, type, text) { queuedResponses.push({ status: status, data: data, type: type, text: text }); }
// Execute the actual browser-state script with a small DOM/URL facade. Java URI
// keeps Host/path/query parsing real while fixtures contain no account data.
function fixtureBrowserUrl(value) {
    var uri = new URI(String(value));
    var scheme = String(uri.getScheme()).toLowerCase();
    var port = uri.getPort();
    this.origin = scheme + "://" + String(uri.getHost()).toLowerCase() +
        (port < 0 || (scheme == "https" && port == 443) || (scheme == "http" && port == 80) ? "" : ":" + port);
    this.pathname = String(uri.getRawPath() || "/");
    var values = {};
    var query = String(uri.getRawQuery() || "").split("&");
    for (var i = 0; i < query.length; i++) {
        var parts = query[i].split("=");
        var key = String(Packages.java.net.URLDecoder.decode(parts.shift(), "UTF-8"));
        var decoded = String(Packages.java.net.URLDecoder.decode(parts.join("="), "UTF-8"));
        if (!values[key]) { values[key] = []; }
        values[key].push(decoded);
    }
    this.searchParams = {
        get: function(key) { return values[key] && values[key].length ? values[key][0] : null; },
        getAll: function(key) { return values[key] || []; }
    };
}
function proxy(state, resource, blob) {
    var value = {
        state: state || {}, resource: resource, blob: blob, loadCalls: [], hrefCalls: [],
        resourceCalls: 0, blobCalls: 0, delays: 0, videoReads: 0, closed: false,
        loadUrl: function() { this.loadCalls.push(Array.prototype.slice.call(arguments)); },
        href: function(url) { this.hrefCalls.push(url); if (!this.state.keepLocation) { this.state.href = url; } },
        waitingForPageLoaded: function() { return true; },
        waitingForResourceLoaded: function() { this.resourceCalls++; return this.resource; },
        waitingForBlobText: function() { this.blobCalls++; return this.blob; },
        delay: function(time) { this.lastDelay = time; this.delays++; },
        executeJavaScript: function(script) {
            Packages.org.mozilla.javascript.Context.getCurrentContext().compileString(script, "browser-hook", 1, null);
            var self = this;
            var URL = fixtureBrowserUrl;
            var currentRoot = new URI(getRootUrl());
            var origin = String(currentRoot.getScheme()) + "://" + String(currentRoot.getRawAuthority());
            var location = { href: self.state.href || origin + (self.state.path || "/") };
            var document = {
                body: { innerText: self.state.login ? "请先登录" : "" },
                querySelector: function(selector) {
                    self.videoReads++;
                    if (!self.state.hasVideo) { return null; }
                    return { currentSrc: self.state.videoSrc || (self.state.blobVideo ? "blob:fixture-player" : ""), src: "" };
                }
            };
            return JSON.stringify(eval(script));
        },
        close: function() { this.closed = true; },
        needUserCheck: function(tips) { var error = new Error(tips); error.proxy = this; throw error; }
    };
    return value;
}

// Host normalization uses real java.net.URI in Rhino, including ports and invalid inputs.
equal(normalizeHost(""), DEFAULT_HOST, "empty host fallback");
equal(normalizeHost(null), DEFAULT_HOST, "null host fallback");
equal(normalizeHost("  milimili.moe///?x=1#section  "), DEFAULT_HOST, "missing scheme plus query/hash");
equal(normalizeHost("//mirror.invalid/"), "https://mirror.invalid", "protocol-relative host");
equal(normalizeHost("HTTP://mirror.invalid/base///?q=1#hash"), "http://mirror.invalid/base", "http and base path");
equal(normalizeHost("mirror.invalid:8443/path/?q=1"), "https://mirror.invalid:8443/path", "port without scheme");
equal(normalizeHost("https://mirror.invalid:8443/"), "https://mirror.invalid:8443", "https port");
var invalidHosts = ["ftp://mirror.invalid", "javascript:alert(1)", "file:///tmp/a", "https://", "https://bad host.invalid", "https://user:password@mirror.invalid", "https://mirror.invalid:99999", "http:mirror.invalid"];
for (var hi = 0; hi < invalidHosts.length; hi++) {
    var badHost = invalidHosts[hi];
    throws(function() { normalizeHost(badHost); }, "Host 无效", "invalid host " + hi);
}
var preference = PreferenceComponent_getPreference().get(0);
equal(preference.label, "网页", "host label");
equal(preference.key, "Host", "host key");
equal(preference.fallback, DEFAULT_HOST, "host default");
equal(remoteShortId("ml1522", true), "ml1522", "short id");
equal(remoteShortId("https://old.invalid/bangumi/ml1522?from=x#y", true), "ml1522", "old detail URL id");
equal(remoteEpisodeId("https://old.invalid/watch?from=source&ep=17245#x", true), "17245", "old episode URL id");
equal(remoteEpisodeId("17245", true), "17245", "ep id");
throws(function() { remoteShortId("ml0", true); }, "ID 无效", "bad short id");
throws(function() { remoteEpisodeId("https://old.invalid/watch?ep=abc", true); }, "ID 无效", "bad episode id");
throws(function() { parseOffset("-1"); }, "偏移无效", "negative offset");
throws(function() { parseOffset("24junk"); }, "偏移无效", "noninteger offset");
equal(parseOffset(null), 0, "initial offset");
equal(parseOffset("24"), 24, "real offset");

testHost = "https://mirror.invalid/base/?ignored=1#fragment";
equal(detailUrl("ml1522"), "https://mirror.invalid/base/bangumi/ml1522", "detail uses configured host");
equal(watchUrl("17245"), "https://mirror.invalid/base/watch?ep=17245", "watch uses configured host");
equal(imageUrl("https://img.milimili.moe/cover.jpg"), "https://img.milimili.moe/cover.jpg", "absolute image CDN preserved");
equal(imageUrl("/uploads/cover.jpg"), "https://mirror.invalid/base/uploads/cover.jpg", "relative image follows Host base");
equal(imageUrl("https://milimili.moe/uploads/cover.jpg?w=300"), "https://mirror.invalid/base/uploads/cover.jpg?w=300", "same-site absolute image follows Host");
equal(imageUrl("https://milimili.moe.evil.invalid/cover.jpg"), "https://milimili.moe.evil.invalid/cover.jpg", "host prefix cannot rewrite other origins");
equal(normalizeHost("https://mirror.invalid/?ignored=has spaces#x"), "https://mirror.invalid", "query removed before validation");
equal(String(makeHeaders().get("Referer")), "https://mirror.invalid/base/", "referer uses configured host");

var home = parseCatalog(fixture_home, 0);
equal(home.second.size(), 24, "home public fixture count");
equal(home.first, "24", "home public real nextOffset");
equal(home.second.get(0).id, "ml2163", "home first stable id");
equal(home.second.get(0).url, "https://mirror.invalid/base/bangumi/ml2163", "home configured detail URL");
truth(String(home.second.get(0).cover).indexOf("https://img.milimili.moe/") == 0, "home CDN preserved");
equal(parseCatalog({ items: [], nextOffset: 24, totalCount: 25 }, 0).first, null, "empty catalog ends");
equal(parseCatalog({ items: fixture_home.items, nextOffset: 24, totalCount: 24 }, 0).first, null, "total boundary ends");
equal(parseCatalog({ items: fixture_home.items, nextOffset: 0, totalCount: 100 }, 24).first, null, "regressing offset ends");
equal(parseCatalog({ items: fixture_home.items }, 0).first, null, "missing offset ends");
var search = parseSearch(fixture_search);
equal(search.second.size(), 3, "search public fixture count");
equal(search.second.get(0).id, "ml1522", "search first stable id");
equal(search.first, null, "search no fake next page");
var detail = parseDetailed(fixture_detail, "ml1522");
equal(detail.first.id, "ml1522", "detail id stable");
equal(detail.first.title, "孤独摇滚！", "detail title");
truth(detail.first.description.indexOf("合成") >= 0, "synthetic fixture description populated");
truth(detail.first.genre.indexOf("音乐") >= 0, "genre populated");
equal(detail.second.size(), 1, "one known line");
var episodes = detail.second.get(0).episode;
equal(episodes.size(), 12, "detail episode count");
equal(episodes.get(0).id, "17245", "first ep");
equal(episodes.get(1).id, "17372", "second sortOrder not episodeOrder");
truth(episodes.get(1).label.indexOf("第2集") == 0, "label uses episodeLabel");
equal(episodes.get(11).id, "17343", "last sortOrder");
equal(episodes.get(11).order, 11, "zero-based client order");
var shuffled = JSON.parse(JSON.stringify(fixture_detail));
shuffled.episodes.reverse();
equal(parseDetailed(shuffled, "ml1522").second.get(0).episode.get(0).id, "17245", "shuffled fixture sortOrder");
shuffled.episodes.push(shuffled.episodes[0]);
equal(parseDetailed(shuffled, "ml1522").second.get(0).episode.size(), 12, "episode duplicates omitted");
shuffled.episodes[0].status = "draft";
equal(parseDetailed(shuffled, "ml1522").second.get(0).episode.size(), 11, "unpublished episodes omitted");

queue(200, fixture_home);
PageComponent_getContent(new MainTab("高分推荐", 1, "score"), null, "24");
var homeRequest = requests[requests.length - 1];
equal(homeRequest.url, "https://mirror.invalid/base" + RPC_PATH + "BrowseCatalog", "RPC uses configured host");
equal(JSON.parse(homeRequest.body.content).offset, 24, "RPC real offset");
equal(JSON.parse(homeRequest.body.content).sort, "score", "RPC high score sort");
equal(homeRequest.headers["Referer"], "https://mirror.invalid/base/", "RPC referer");
equal(homeRequest.headers["Connect-Protocol-Version"], "1", "RPC Connect protocol");
equal(responseClosed, 1, "RPC closes response");
var count = requests.length;
equal(SearchComponent_search(1, "孤独摇滚").second.size(), 0, "search extra page empty");
equal(requests.length, count, "search extra page no network");
equal(SearchComponent_search(null, "  ").second.size(), 0, "empty search");
queue(200, fixture_search);
SearchComponent_search(null, " 孤独摇滚 ");
var body = JSON.parse(requests[requests.length - 1].body.content);
equal(body.query, "孤独摇滚", "trimmed query");
equal(body.contentType, "pgc", "anime search filter");
equal(body.limit, 24, "search limit");
truth(body.offset == null, "no invented search offset");
queue(403, { message: "forbidden" });
throws(function() { rpc("GetBangumi", {}, false); }, "HTTP 403", "RPC auth rejection");
queue(200, null, null, "<html>challenge</html>");
throws(function() { rpc("GetBangumi", {}, false); }, "无效 JSON", "RPC invalid JSON");
equal(responseClosed, 4, "all RPC responses closed");

// Normal WebProxy authentication handoff; fixtures contain no real login data.
providedProxy = proxy({ path: "/base/watch?ep=17245", login: true });
queue(401, { code: "unauthenticated", message: "请先登录" });
var check = throws(function() { PlayComponent_getPlayInfo({}, {}, { id: "17245" }); }, "需要登录", "401 requests login");
truth(check.proxy === providedProxy, "original proxy handed to user");
equal(providedProxy.loadCalls.length, 1, "initial page loaded once");
equal(providedProxy.loadCalls[0][0], "https://mirror.invalid/base/watch?ep=17245", "watch uses configured host");
equal(providedProxy.loadCalls[0][4], false, "unsafe Blob hook disabled");
equal(providedProxy.resourceCalls, 0, "historical media requests are not trusted");
equal(providedProxy.blobCalls, 0, "no-match Blob wait avoided");
equal(providedProxy.closed, false, "login window preserved");
var creationCount = proxyCreations;
throws(function() { PlayComponent_getPlayInfoWithCheck({}, {}, { id: "17245" }, providedProxy); }, "需要登录", "continued login required");
equal(proxyCreations, creationCount, "check reuses original proxy");
equal(providedProxy.loadCalls.length, 1, "check never calls one-shot load again");

var proofUrl = "https://media.invalid/video.mp4?mk=fixture&mt=fixture&mp=1.fixture";
truth(hasPlaybackProof(proofUrl), "proof detected");
truth(!hasPlaybackProof("https://cdn.invalid/file.mp4?token=fixture"), "unrelated query not a proof");
var signedProxy = proxy({ path: "/base/watch?ep=17245", hasVideo: true, videoSrc: proofUrl }, proofUrl);
var blocked = throws(function() { PlayComponent_getPlayInfoWithCheck({}, {}, { id: "17245" }, signedProxy); }, "当前的播放方式", "proof native incompatibility");
truth(String(blocked.message).indexOf("mk=fixture") < 0, "proof values never included in error");

var hlsProxy = proxy({ path: "/base/watch?ep=17245", hasVideo: true, videoSrc: "https://cdn.invalid/anime/master.m3u8" }, "https://cdn.invalid/old-episode.m3u8");
queue(200, null, "application/vnd.apple.mpegurl", "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nmedia.m3u8");
var hls = PlayComponent_getPlayInfoWithCheck({}, {}, { id: "17245" }, hlsProxy);
equal(hlsProxy.blobCalls, 0, "unbounded Blob API never called");
equal(hls.decodeType, PlayerInfo.DECODE_TYPE_HLS, "validated playlist HLS type");
equal(hls.uri, "https://cdn.invalid/anime/master.m3u8", "media CDN never rewritten");
equal(String(hls.header.get("Referer")), "https://mirror.invalid/base/", "media referer uses Host");
equal(hlsProxy.closed, true, "completed proxy closed");

var staticProxy = proxy({ path: "/base/watch?ep=17245", hasVideo: true, videoSrc: "https://cdn.invalid/authorized.mp4" }, "https://cdn.invalid/old-episode.mp4");
queue(206, null, "video/mp4");
var mp4 = PlayComponent_getPlayInfoWithCheck({}, {}, { id: "17245" }, staticProxy);
equal(mp4.decodeType, PlayerInfo.DECODE_TYPE_OTHER, "static video type");
equal(mp4.uri, "https://cdn.invalid/authorized.mp4", "static video original URL");
equal(String(requests[requests.length - 1].headers.get("Range")), "bytes=0-0", "static mp4 limited validation");
queue(200, null, "application/vnd.apple.mpegurl", "#EXTM3U\nhttps://cdn.invalid/a.ts?mp=1.fixture");
throws(function() { validateStaticMedia("https://cdn.invalid/master.m3u8"); }, "当前的播放方式", "validated manifest proof rejected");
var browserOnly = proxy({ path: "/base/watch?ep=17245", hasVideo: true, blobVideo: true });
throws(function() { PlayComponent_getPlayInfoWithCheck({}, {}, { id: "17245" }, browserOnly); }, "当前的网页播放方式", "browser-only media explicit limitation");
var returnedLogin = proxy({ path: "/login", login: true });
throws(function() { PlayComponent_getPlayInfoWithCheck({}, {}, { id: "17245" }, returnedLogin); }, "需要登录", "login navigation handoff");
equal(returnedLogin.hrefCalls[0], "https://mirror.invalid/base/watch?ep=17245", "same window returns to episode");

// A Connect success is an object, but omitted repeated fields are legal protoJSON.
var invalidSuccessBodies = ["", " \r\n\t", "null", "[]", "[{}]", "true", "false", "123", "\"string\""];
for (var invalidIndex = 0; invalidIndex < invalidSuccessBodies.length; invalidIndex++) {
    var closedBefore = responseClosed;
    queue(200, null, null, invalidSuccessBodies[invalidIndex]);
    throws(function() { SearchComponent_search(0, "孤独摇滚"); }, "无效 JSON", "invalid success body " + invalidIndex);
    equal(responseClosed, closedBefore + 1, "invalid success body closed " + invalidIndex);
}
queue(200, {});
equal(SearchComponent_search(0, "无结果").second.size(), 0, "omitted videos is a valid empty Connect result");
queue(200, {});
var emptyCatalog = PageComponent_getContent(new MainTab("最近更新", 1, "latest_update"), null, 0);
equal(emptyCatalog.second.size(), 0, "omitted catalog items is a valid empty Connect result");
equal(emptyCatalog.first, null, "omitted catalog items ends pagination");
queue(200, { videos: null });
equal(SearchComponent_search(0, "无结果").second.size(), 0, "protoJSON null repeated field is unset");
providedProxy = proxy({ path: "/base/watch?ep=17245", login: true });
queue(401, null, null, "");
var empty401 = throws(function() { PlayComponent_getPlayInfo({}, {}, { id: "17245" }); }, "需要登录", "empty 401 body preserves authentication handoff");
truth(empty401.proxy === providedProxy, "empty 401 hands off exact original proxy");
equal(providedProxy.loadCalls[0][4], false, "empty 401 also disables Blob hook");
equal(providedProxy.closed, false, "empty 401 preserves login window");

// The current Host's base path, exact episode and live video prove ownership.
equal(hlsProxy.hrefCalls.length, 0, "Host base path does not cause pointless episode navigation");
equal(hlsProxy.resourceCalls, 0, "old sticky playlist never read");
equal(staticProxy.resourceCalls, 0, "old sticky MP4 never read");
var noCurrentMedia = proxy({ path: "/base/watch?ep=17245", hasVideo: true }, "https://cdn.invalid/previous-episode.mp4");
var beforeUnowned = requests.length;
throws(function() { PlayComponent_getPlayInfoWithCheck({}, {}, { id: "17245" }, noCurrentMedia); }, "暂未取得播放地址", "old resource cannot substitute for a current video");
equal(requests.length, beforeUnowned, "unowned media is never requested");
equal(noCurrentMedia.resourceCalls, 0, "unowned sticky media is never read");
equal(noCurrentMedia.delays, 39, "post-check video-state polling has a fixed limit");
equal(noCurrentMedia.lastDelay, 200, "bounded poll interval");
var foreignPage = proxy({ href: "https://other.invalid/base/watch?ep=17245", hasVideo: true, videoSrc: "https://cdn.invalid/other-site.mp4", keepLocation: true }, "https://cdn.invalid/other-site.mp4");
var foreignCheck = throws(function() { PlayComponent_getPlayInfoWithCheck({}, {}, { id: "17245" }, foreignPage); }, "请回到当前剧集", "matching episode on another Host cannot supply media");
truth(foreignCheck.proxy === foreignPage, "wrong Host preserves same verification proxy");
equal(foreignPage.videoReads, 0, "foreign page video never inspected");
equal(foreignPage.hrefCalls[0], "https://mirror.invalid/base/watch?ep=17245", "wrong Host navigates original window to configured page");
var otherEpisode = proxy({ path: "/base/watch?ep=17246", hasVideo: true, videoSrc: "https://cdn.invalid/other-episode.mp4", keepLocation: true }, "https://cdn.invalid/other-episode.mp4");
throws(function() { PlayComponent_getPlayInfoWithCheck({}, {}, { id: "17245" }, otherEpisode); }, "请回到当前剧集", "different episode cannot supply media");
equal(otherEpisode.videoReads, 0, "different episode video never inspected");
var duplicateEpisode = proxy({ path: "/base/watch?ep=17245&ep=17246", hasVideo: true, videoSrc: "https://cdn.invalid/ambiguous.mp4", keepLocation: true });
equal(readPageState(duplicateEpisode, "17245").matched, false, "ambiguous ep parameters are rejected");
equal(duplicateEpisode.videoReads, 0, "ambiguous episode video never inspected");
var reorderedQuery = proxy({ path: "/base/watch?from=fixture&ep=17245#section", hasVideo: true, videoSrc: "https://cdn.invalid/current.mp4" }, proofUrl);
queue(206, null, "video/mp4");
var currentVideo = PlayComponent_getPlayInfoWithCheck({}, {}, { id: "17245" }, reorderedQuery);
equal(currentVideo.uri, "https://cdn.invalid/current.mp4", "current video wins over an old proof-bearing resource");
equal(reorderedQuery.hrefCalls.length, 0, "extra query and fragment do not break exact episode ownership");
equal(reorderedQuery.resourceCalls, 0, "old proof-bearing resource is ignored");
truth(queuedResponses.length == 0, "all fixtures consumed");
equal(responseClosed, requests.length, "all success and failure HTTP responses closed");
Packages.java.lang.System.out.println("PASS " + assertions + " Rhino fixture assertions (catalog/search/detail/Host/login relay/media compatibility)");
