var assertions = 0;
function assertTrue(value, label) { assertions++; if (!value) { throw new Error(label); } }
function equal(actual, expected, label) { assertTrue(actual === expected, label + ": expected " + expected + ", got " + actual); }
function queue(data, status, text) { queuedResponses.push({ status: status == null ? 200 : status, data: data, text: text }); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function lastRequest() { return requests[requests.length - 1]; }
function expectError(action, fragment, label) {
    var caught = null;
    try { action(); } catch (error) { caught = error; }
    assertTrue(caught instanceof ParserException, label + " uses ParserException");
    if (fragment) { assertTrue(String(caught.message).indexOf(fragment) >= 0, label + " has clear message"); }
    return caught;
}
var titleReads = 0;
function sdkSummary(id) {
    var summary = { id: id, source: "heyanle.ggl" };
    Object.defineProperty(summary, "title", { get: function() { titleReads++; throw new Error("CartoonSummary has no title"); } });
    return summary;
}

equal(source.key, "heyanle.ggl", "formal source key stays independent of Beta");
equal(getRootUrl(), "https://ani.girigirilove.com", "formal default Host");
equal(gglApiRoot(), "https://m3u8.girigirilove.com", "API origin declared by formal client");
var preferences = PreferenceComponent_getPreference();
equal(preferences.size(), 2, "only current web/API settings are exposed");
equal(preferences.get(0).key, "Host", "unified Host key");
equal(preferences.get(1).key, "ApiHost", "independent API Host");
testPreferences.HostV2 = " legacy.example:8443/base///?ignored=1#fragment ";
equal(getRootUrl(), "https://legacy.example:8443/base", "unset Host reads saved HostV2");
equal(PreferenceComponent_getPreference().get(0).fallback, testPreferences.HostV2, "settings show existing legacy value");
testPreferences.Host = " new.example/root///?ignored=1#x ";
equal(getRootUrl(), "https://new.example/root", "new Host overrides HostV2");
testPreferences.Host = "  ";
equal(getRootUrl(), GGL_HOST, "explicit empty new Host restores default instead of old HostV2");
delete testPreferences.Host;
delete testPreferences.HostV2;
equal(gglNormalizeHost("HTTP://example.test:8080/base///?ignored=has spaces#x", GGL_HOST, "网页"), "http://example.test:8080/base", "scheme/path/port normalization strips query first");
equal(gglNormalizeHost("example.test:8443?x=1#y", GGL_HOST, "网页"), "https://example.test:8443", "bare port plus query");
equal(gglNormalizeHost("//example.test/", GGL_HOST, "网页"), "https://example.test", "protocol relative Host");
equal(gglNormalizeHost(null, GGL_HOST, "网页"), GGL_HOST, "null fallback");
var invalidHosts = ["ftp://example.test", "javascript:alert(1)", "http:example.test", "https://", "https://bad host.test", "https://user:pass@example.test", "https://example.test:99999", "/relative"];
for (var i = 0; i < invalidHosts.length; i++) {
    (function(value) { expectError(function() { gglNormalizeHost(value, GGL_HOST, "网页"); }, "地址无效", "invalid Host " + value); })(invalidHosts[i]);
}

var tabs = PageComponent_getMainTabs();
equal(tabs.size(), 6, "formal discovery exposes all six categories");
for (var i = 0; i < GGL_CATEGORIES.length; i++) {
    var category = GGL_CATEGORIES[i];
    var fixture = fixtures["category-" + category.id + "-p1.json"];
    equal(tabs.get(i).label, category.label, "category order " + i);
    equal(PageComponent_getSubTabs(tabs.get(i)).size(), 0, "category directly loads covers " + i);
    queue(fixture);
    var result = PageComponent_getContent(tabs.get(i), null, 0);
    equal(result.second.size(), fixture.info.rows.length, "category count " + i);
    equal(result.first, fixture.info.rows.length < fixture.info.total ? fixture.info.rows.length : null, "native offset continuation " + i);
    equal(result.second.get(0).id, "ggl-v2:" + fixture.info.rows[0].vod_id, "first row preserved " + i);
    equal(result.second.get(result.second.size() - 1).id, "ggl-v2:" + fixture.info.rows[fixture.info.rows.length - 1].vod_id, "last row preserved " + i);
    equal(result.second.get(0).source, "heyanle.ggl", "formal key on cards " + i);
    assertTrue(lastRequest().url.indexOf("offset=0") >= 0 && lastRequest().url.indexOf("type_id=" + category.id) >= 0, "correct category query " + i);
    assertTrue(result.second.get(0).url.indexOf(GGL_HOST + "/detail/") === 0, "new formal detail route " + i);
}
queue(fixtures["category-2-p2.json"]);
var categoryPage2 = PageComponent_getContent(tabs.get(0), null, 20);
equal(categoryPage2.first, 40, "category second native offset");
equal(categoryPage2.second.size(), 20, "category second page size");
assertTrue(lastRequest().url.indexOf("offset=20") >= 0, "no one-based/page multiplication guess");
var firstIds = {};
for (var i = 0; i < fixtures["category-2-p1.json"].info.rows.length; i++) { firstIds[fixtures["category-2-p1.json"].info.rows[i].vod_id] = true; }
for (var i = 0; i < fixtures["category-2-p2.json"].info.rows.length; i++) { assertTrue(!firstIds[fixtures["category-2-p2.json"].info.rows[i].vod_id], "observed category pages have distinct rows " + i); }
expectError(function() { PageComponent_getContent({ label: "unknown" }, null, 0); }, "分类无效", "unknown category");
expectError(function() { SearchComponent_search(-1, "海"); }, "分页无效", "negative offset");
expectError(function() { SearchComponent_search(1.5, "海"); }, "分页无效", "fractional offset");
expectError(function() { SearchComponent_search(2147483648, "海"); }, "分页无效", "offset fits API15 Int ABI");

queue(fixtures["search.json"]);
var search = SearchComponent_search(0, " 孤独摇滚 ");
equal(search.second.size(), 3, "fixed keyword count");
equal(search.first, null, "fixed keyword ends after its real results");
var ids = ["26538", "26168", "1091"];
var titles = ["孤独摇滚总集篇", "LIVE STAGE 孤独摇滚 舞台剧", "孤独摇滚！"];
for (var i = 0; i < ids.length; i++) {
    equal(search.second.get(i).id, "ggl-v2:" + ids[i], "fixed search ordering " + i);
    equal(search.second.get(i).title, titles[i], "fixed search title " + i);
}
assertTrue(lastRequest().url.indexOf("vod_name=%E5%AD%A4%E7%8B%AC%E6%91%87%E6%BB%9A") >= 0, "search keyword encoded");
assertTrue(lastRequest().url.indexOf("limit=24") >= 0, "formal SearchPage limit");
queue(fixtures["search-sea-0.json"]);
equal(SearchComponent_search(0, "海").first, 24, "real search offset continuation");
queue(fixtures["search-sea-24.json"]);
equal(SearchComponent_search(24, "海").first, 48, "second search offset continuation");
assertTrue(lastRequest().url.indexOf("offset=24") >= 0, "search passes actual cursor");
var shortPage = clone(fixtures["search-sea-0.json"]);
shortPage.info.rows = shortPage.info.rows.slice(0, 2);
queue(shortPage);
equal(SearchComponent_search(0, "海").first, 2, "partial server page continues by actual returned count");
var before = requests.length;
equal(SearchComponent_search(0, "  ").second.size(), 0, "empty input does not search");
equal(requests.length, before, "empty input has no request");
queue({ code: 1, info: { offset: 74, total: 74, rows: [] } });
equal(SearchComponent_search(74, "海").first, null, "genuine empty exhausted page");

var episodeCounts = [2, 1, 12];
var firstLabels = ["前篇", "1080P", "01"];
for (var i = 0; i < ids.length; i++) {
    var summary = sdkSummary("ggl-v2:" + ids[i]);
    var fixture = fixtures["detail-" + ids[i] + ".json"];
    queue(fixture);
    var detail = DetailedComponent_getDetailed(summary);
    equal(detail.first.title, titles[i], "real API supplies title " + i);
    equal(detail.first.id, "ggl-v2:" + ids[i], "stable work ID " + i);
    equal(detail.first.description, "合成简介，仅用于验证 HTML 清理。", "description HTML cleanup " + i);
    equal(detail.second.size(), 1, "every actual line retained " + i);
    var line = detail.second.get(0);
    equal(line.label, "chs", "formal line code " + i);
    equal(line.id, "ggl-v2:0:chs", "versioned label-bound line ID " + i);
    equal(line.episode.size(), episodeCounts[i], "all formal episodes " + i);
    equal(line.episode.get(0).label, firstLabels[i], "actual first episode never skipped " + i);
    equal(line.episode.get(0).order, 0, "API15 zero-based Episode order " + i);
    queue(fixture);
    var info = PlayComponent_getPlayInfo(summary, line, line.episode.get(0));
    equal(info.uri, "https://media.invalid/formal/" + ids[i] + "/0/0" + (i < 2 ? ".m3u8" : ".mp4"), "exact selected first episode " + i);
    equal(info.decodeType, i < 2 ? PlayerInfo.DECODE_TYPE_HLS : PlayerInfo.DECODE_TYPE_OTHER, "native media decode type " + i);
    equal(String(info.header.get("Referer")), GGL_HOST + "/", "formal media referer " + i);
    equal(String(info.header.get("Origin")), GGL_HOST, "formal media origin " + i);
    equal(info.header.get("Accept"), null, "API JSON headers do not leak into media " + i);
    assertTrue(lastRequest().url.indexOf("vod_id=" + ids[i]) >= 0, "play refreshes same work from official API " + i);
}
equal(titleReads, 0, "SDK summary.title never accessed");
var blankTitles = [undefined, null, "", " \t ", "<b></b>"];
for (var i = 0; i < blankTitles.length; i++) {
    var noTitle = clone(fixtures["detail-26538.json"]);
    if (blankTitles[i] === undefined) { delete noTitle.info.vod_name; } else { noTitle.info.vod_name = blankTitles[i]; }
    queue(noTitle);
    expectError(function() { DetailedComponent_getDetailed(sdkSummary("ggl-v2:26538")); }, "缺少作品标题", "missing required API title " + i);
}
equal(titleReads, 0, "missing title never falls back to unsupported SDK title");

var beforeLegacy = requests.length;
var legacyIds = ["GV26538", "GV1091", "26538", "https://ani.girigirilove.com/GV26538/"];
for (var i = 0; i < legacyIds.length; i++) {
    (function(value) { expectError(function() { DetailedComponent_getDetailed(sdkSummary(value)); }, "旧收藏请重新搜索", "no unproven legacy work mapping " + value); })(legacyIds[i]);
}
equal(requests.length, beforeLegacy, "unproven GV migration never guesses a numeric API request");
expectError(function() { PlayComponent_getPlayInfo(sdkSummary("ggl-v2:26538"), { id: "1" }, { id: "1" }); }, "刷新详情后重新选集", "old one-based selections cannot become new zero-based selections");

var synthetic = fixtures["synthetic-lines.json"];
queue(synthetic);
var d = DetailedComponent_getDetailed(sdkSummary("ggl-v2:99"));
equal(d.second.size(), 2, "empty official line omitted");
equal(d.second.get(0).id, "ggl-v2:1:chs", "raw position and line label retained after filtering");
equal(d.second.get(0).episode.get(0).id, "ggl-v2:99:1:1:%E5%89%8D%E7%AF%87", "episode ID binds work/line/position/label");
queue(synthetic);
equal(PlayComponent_getPlayInfo(sdkSummary("ggl-v2:99"), d.second.get(0), d.second.get(0).episode.get(0)).uri, "https://media.invalid/first.m3u8?name=a$b", "URL dollar/query never truncated");
queue(synthetic);
equal(PlayComponent_getPlayInfo(sdkSummary("ggl-v2:99"), d.second.get(1), d.second.get(1).episode.get(1)).decodeType, PlayerInfo.DECODE_TYPE_DASH, "DASH type retained");
var changedLine = clone(synthetic);
changedLine.info.vod_play_from = "empty$$$other$$$高清";
queue(changedLine);
expectError(function() { PlayComponent_getPlayInfo(sdkSummary("ggl-v2:99"), d.second.get(0), d.second.get(0).episode.get(0)); }, "所选线路或集数已变化", "changed line at same position cannot select another source");
var changedEpisode = clone(synthetic);
changedEpisode.info.vod_play_url = changedEpisode.info.vod_play_url.replace("前篇$", "变更篇$");
queue(changedEpisode);
expectError(function() { PlayComponent_getPlayInfo(sdkSummary("ggl-v2:99"), d.second.get(0), d.second.get(0).episode.get(0)); }, "所选线路或集数已变化", "changed episode at same position cannot silently play");
queue(fixtures["detail-26538.json"]);
expectError(function() { PlayComponent_getPlayInfo(sdkSummary("ggl-v2:26538"), d.second.get(0), d.second.get(0).episode.get(0)); }, "所选线路或集数已变化", "another work's selection cannot play");

testPreferences.Host = "http://web.example:8080/base/?ignored=1#x";
testPreferences.ApiHost = "api.example:8443/gateway///?ignored=1#x";
queue(fixtures["search.json"]);
var overridden = SearchComponent_search(0, "孤独摇滚");
assertTrue(lastRequest().url.indexOf("https://api.example:8443/gateway/api.php/Vod/get_list?") === 0, "independent API follows ApiHost");
equal(overridden.second.get(0).url, "http://web.example:8080/base/detail/26538", "formal page follows Host base");
equal(overridden.second.get(0).id, "ggl-v2:26538", "Host change cannot alter work identity");
equal(String(lastRequest().headers.get("Origin")), "http://web.example:8080", "origin excludes Host base path");
equal(overridden.second.get(0).cover, fixtures["search.json"].info.rows[0].vod_pic, "external image CDN never rewritten");
equal(gglImage("upload/cover.webp"), "https://jpg.girigirilove.net/upload/cover.webp", "formal client-declared image origin");
equal(gglImage("/relative.webp"), "http://web.example:8080/base/relative.webp", "same-site relative image follows Host");
equal(gglImage("https://ani.girigirilove.com/cover.webp?x=1"), "http://web.example:8080/base/cover.webp?x=1", "formal same-site image follows new Host");
equal(gglImage("https://ani.girigirilove.com:8443/cover.webp"), "https://ani.girigirilove.com:8443/cover.webp", "a separate port is not the formal default origin");
queue(fixtures["detail-26538.json"]);
equal(PlayComponent_getPlayInfo(sdkSummary("ggl-v2:26538"), { id: "ggl-v2:0:chs" }, { id: "ggl-v2:26538:0:0:%E5%89%8D%E7%AF%87" }).uri, "https://media.invalid/formal/26538/0/0.m3u8", "external media never rewritten by Host/ApiHost");
testPreferences = {};

var invalidBodies = ["", " \n ", "null", "[]", "123", "true", "\"text\"", "<!doctype html><html><div id=app></div></html>"];
for (var i = 0; i < invalidBodies.length; i++) {
    queue(null, 200, invalidBodies[i]);
    expectError(function() { SearchComponent_search(0, "孤独摇滚"); }, null, "invalid successful body cannot be fake EMPTY " + i);
}
for (var i = 0; i < 3; i++) {
    queue({}, [401, 403, 503][i]);
    expectError(function() { SearchComponent_search(0, "孤独摇滚"); }, "HTTP " + [401, 403, 503][i], "HTTP access/server rejection is not bypassed " + i);
}
queue({ code: 0, msg: "requires login" });
expectError(function() { SearchComponent_search(0, "孤独摇滚"); }, "原网页确认访问状态", "API denial cannot masquerade as empty results");
queue({ code: 1, info: {} });
expectError(function() { SearchComponent_search(0, "孤独摇滚"); }, "列表格式发生变化", "missing list structure");
queue({ code: 1, info: { total: 1, rows: [] } });
expectError(function() { SearchComponent_search(0, "孤独摇滚"); }, "尚未完整返回", "nonempty total with empty page is a failed response");
queue({ code: 1, info: { total: 1, rows: [{}] } });
expectError(function() { SearchComponent_search(0, "孤独摇滚"); }, "缺少作品信息", "malformed row cannot be silently dropped into EMPTY");
queue({ code: 1, info: { offset: 24, total: 0, rows: [] } });
expectError(function() { SearchComponent_search(0, "孤独摇滚"); }, "分页响应不匹配", "wrong offset rejected");
queue({ code: 1, info: { vod_id: 1, vod_name: "wrong work" } });
expectError(function() { DetailedComponent_getDetailed(sdkSummary("ggl-v2:26538")); }, "详情格式发生变化", "wrong work rejected");
expectError(function() { gglMedia("javascript:alert(1)"); }, "未返回可用播放地址", "non-HTTP media rejected");
equal(queuedResponses.length, 0, "all fixture responses consumed");
equal(responseClosed, requests.length, "every API response closed on success and failure");
equal(titleReads, 0, "all scenarios respect real CartoonSummary ABI");
print("PASS GiriGiriLove formal: " + assertions + " assertions, " + requests.length + " mocked requests; all response bodies closed");
