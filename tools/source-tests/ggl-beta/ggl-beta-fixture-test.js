var assertions = 0;
function assertTrue(value, message) {
    assertions++;
    if (!value) { throw new Error(message); }
}
function equal(actual, expected, message) {
    assertTrue(actual === expected, message + ": expected " + expected + ", got " + actual);
}
function queue(data, status) {
    queuedResponses.push({ status: status == null ? 200 : status, data: data });
}
function expectParserError(action, message) {
    var caught = null;
    try { action(); } catch (error) { caught = error; }
    assertTrue(caught instanceof ParserException, message);
}
function requestHas(part) {
    return String(requests[requests.length - 1].url).indexOf(part) >= 0;
}

var preferences = PreferenceComponent_getPreference();
equal(preferences.size(), 2, "two independent host preferences");
equal(preferences.get(0).key, "Host", "web host key");
equal(preferences.get(1).key, "ApiHost", "independent API host key");
equal(getRootUrl(), DEFAULT_HOST, "empty host falls back");
equal(getApiRoot(), DEFAULT_API_HOST, "empty API host falls back");
equal(normalizeHost(" beta.girigirilove.com///?a=1#x ", DEFAULT_HOST, "网页"), DEFAULT_HOST, "scheme/query/fragment/trailing slash normalization");
equal(normalizeHost("HTTP://example.com:8080/base///?a=1#x", DEFAULT_HOST, "网页"), "http://example.com:8080/base", "HTTP scheme and base path");
equal(normalizeHost("example.com:8443/base/", DEFAULT_HOST, "网页"), "https://example.com:8443/base", "bare host with port");
equal(normalizeHost("//example.com/", DEFAULT_HOST, "网页"), "https://example.com", "protocol-relative host");
var badHosts = ["ftp://example.com", "javascript:alert(1)", "http:example.com", "https://user:pass@example.com", "https://", "https://example.com:99999", "https://bad host/", "/relative/path"];
for (var i = 0; i < badHosts.length; i++) {
    (function(value) { expectParserError(function() { normalizeHost(value, DEFAULT_HOST, "网页"); }, "invalid host: " + value); })(badHosts[i]);
}

var tabs = PageComponent_getMainTabs();
equal(tabs.size(), 6, "all beta discovery categories");
for (var i = 0; i < CATEGORIES.length; i++) {
    equal(tabs.get(i).label, CATEGORIES[i].label, "category label " + i);
    equal(PageComponent_getSubTabs(tabs.get(i)).size(), 0, "category has direct page");
    var fixture = fixtures["browse-" + CATEGORIES[i].id + "-p1.json"];
    queue(fixture);
    var page = PageComponent_getContent(tabs.get(i), null, 0);
    equal(page.second.size(), fixture.info.rows.length, "category first-page size " + i);
    equal(page.second.get(0).id, String(fixture.info.rows[0].vod_id), "category keeps first row " + i);
    equal(page.second.get(page.second.size() - 1).id, String(fixture.info.rows[fixture.info.rows.length - 1].vod_id), "category keeps last row " + i);
    equal(page.first, fixture.info.rows.length < fixture.info.total ? 1 : null, "category pagination " + i);
    assertTrue(requestHas("type_id=" + CATEGORIES[i].id), "category type query " + i);
    assertTrue(requestHas("offset=0"), "category first offset " + i);
    equal(page.second.get(0).source, "heyanle.ggl.beta", "independent source key " + i);
    assertTrue(String(page.second.get(0).url).indexOf(DEFAULT_HOST + "/detail/") === 0, "beta detail URL " + i);
}
queue(fixtures["browse-2-p2.json"]);
var secondPage = PageComponent_getContent(tabs.get(0), null, 1);
equal(secondPage.first, 2, "day-anime second-page continuation");
equal(secondPage.second.size(), 20, "day-anime second-page count");
assertTrue(requestHas("offset=20"), "day-anime second offset");
var ids = {};
var firstRows = fixtures["browse-2-p1.json"].info.rows;
for (var i = 0; i < firstRows.length; i++) { ids[firstRows[i].vod_id] = true; }
for (var i = 0; i < secondPage.second.size(); i++) { assertTrue(!ids[secondPage.second.get(i).id], "pages do not repeat " + i); }
expectParserError(function() { PageComponent_getContent({ label: "invalid" }, null, 0); }, "unknown category fails clearly");
expectParserError(function() { PageComponent_getContent(tabs.get(0), null, -1); }, "negative page fails clearly");

queue(fixtures["search-api.json"]);
var searchResult = SearchComponent_search(0, "孤独摇滚");
equal(searchResult.first, null, "fixed search has one page");
equal(searchResult.second.size(), 3, "fixed search count");
var expectedIds = ["26538", "26168", "1091"];
var expectedTitles = ["孤独摇滚总集篇", "LIVE STAGE 孤独摇滚 舞台剧", "孤独摇滚！"];
for (var i = 0; i < expectedIds.length; i++) {
    equal(searchResult.second.get(i).id, expectedIds[i], "fixed search order " + i);
    equal(searchResult.second.get(i).title, expectedTitles[i], "fixed search title " + i);
}
assertTrue(requestHas("vod_name=%E5%AD%A4%E7%8B%AC%E6%91%87%E6%BB%9A"), "encoded search keyword");
assertTrue(requestHas("limit=24"), "native beta search limit");
var beforeEmptySearch = requests.length;
equal(SearchComponent_search(0, "  ").second.size(), 0, "empty search");
equal(requests.length, beforeEmptySearch, "empty search needs no network");
queue({ code: 1, info: { offset: 24, limit: 24, total: 3, rows: [] } });
equal(SearchComponent_search(1, "孤独摇滚").first, null, "search exhausted page terminates");
assertTrue(requestHas("offset=24"), "search second offset");

var episodeCounts = [2, 1, 12];
var firstLabels = ["前篇", "1080P", "01"];
for (var i = 0; i < expectedIds.length; i++) {
    var summary = searchResult.second.get(i);
    var fixture = fixtures["detail-" + expectedIds[i] + "-api.json"];
    queue(fixture);
    var detail = DetailedComponent_getDetailed(summary);
    equal(detail.first.id, expectedIds[i], "stable detail ID " + i);
    equal(detail.first.title, expectedTitles[i], "detail title " + i);
    equal(detail.first.description, "合成简介，仅用于验证 HTML 清理。", "description is stripped " + i);
    equal(detail.second.size(), 1, "all actual beta lines " + i);
    var line = detail.second.get(0);
    equal(line.label, "chs", "actual line name " + i);
    equal(line.id, "0", "line ID excludes domains " + i);
    equal(line.episode.size(), episodeCounts[i], "all episodes " + i);
    equal(line.episode.get(0).label, firstLabels[i], "actual first episode retained " + i);
    equal(line.episode.get(0).id, "0", "episode ID excludes URLs " + i);
    queue(fixture);
    var play = PlayComponent_getPlayInfo(summary, line, line.episode.get(0));
    equal(play.decodeType, i < 2 ? PlayerInfo.DECODE_TYPE_HLS : PlayerInfo.DECODE_TYPE_OTHER, "media type " + i);
    equal(play.uri, "https://media.invalid/ggl-beta/" + expectedIds[i] + "/0/0" + (i < 2 ? ".m3u8" : ".mp4"), "selected first episode " + i);
    equal(String(play.header.get("Referer")), DEFAULT_HOST + "/", "media referer " + i);
    equal(String(play.header.get("Origin")), DEFAULT_HOST, "media origin " + i);
    equal(String(play.header.get("User-Agent")), "fixture-user-agent", "media user agent " + i);
    equal(play.header.get("Accept"), null, "JSON accept is not applied to media " + i);
    assertTrue(requestHas("vod_id=" + expectedIds[i]), "play refreshes current detail " + i);
}

var synthetic = fixtures["synthetic-lines-api.json"];
// API15 CartoonSummary has only id/source. Accessing an absent Java property
// fails in Rhino, so a throwing title getter models that SDK contract.
var titleReads = 0;
function sdkSummary(id) {
    var summary = { id: id, source: "heyanle.ggl.beta" };
    Object.defineProperty(summary, "title", { get: function() {
        titleReads++;
        throw new Error("SDK CartoonSummary has no title field");
    } });
    return summary;
}
queue(synthetic);
var sdkDetail = DetailedComponent_getDetailed(sdkSummary("99"));
equal(sdkDetail.first.title, "合成番剧", "normal detail title comes only from API");
equal(titleReads, 0, "normal detail never reads unsupported summary.title");
var missingTitles = [undefined, null, "", " \t ", "<span></span>"];
for (var missingTitleIndex = 0; missingTitleIndex < missingTitles.length; missingTitleIndex++) {
    var noTitle = JSON.parse(JSON.stringify(synthetic));
    if (missingTitles[missingTitleIndex] === undefined) {
        delete noTitle.info.vod_name;
    } else {
        noTitle.info.vod_name = missingTitles[missingTitleIndex];
    }
    queue(noTitle);
    var missingTitleError = null;
    try { DetailedComponent_getDetailed(sdkSummary("99")); } catch (error) { missingTitleError = error; }
    assertTrue(missingTitleError instanceof ParserException, "missing title reports ParserException " + missingTitleIndex);
    equal(missingTitleError.message, "番剧详情缺少作品标题，请稍后重试", "missing title has a clear message " + missingTitleIndex);
    equal(titleReads, 0, "missing title never falls back to unsupported SDK field " + missingTitleIndex);
}
queue(synthetic);
var detail = DetailedComponent_getDetailed({ id: "99", title: "合成番剧" });
equal(detail.second.size(), 2, "empty line skipped");
equal(detail.second.get(0).id, "1", "original line index preserved");
equal(detail.second.get(0).episode.get(0).id, "1", "original episode index preserved");
equal(detail.first.status, Cartoon.STATUS_COMPLETED, "completed status");
equal(detail.first.genre, "音乐,喜剧", "genre");
equal(detail.first.cover, "https://jpg.girigirilove.net/upload/cover.webp", "declared independent image origin");
queue(synthetic);
var play = PlayComponent_getPlayInfo({ id: "99" }, detail.second.get(0), detail.second.get(0).episode.get(0));
equal(play.uri, "https://media.invalid/first.m3u8?name=a$b", "URL dollar/query preserved");
queue(synthetic);
expectParserError(function() { PlayComponent_getPlayInfo({ id: "99" }, { id: "9" }, { id: "0" }); }, "missing selected line cannot silently change line");
expectParserError(function() { DetailedComponent_getDetailed({ id: "https://example.com/99" }); }, "domain-bearing source IDs rejected");
expectParserError(function() { mediaUrl("javascript:alert(1)"); }, "invalid media scheme");

testHost = "http://web.example:8080/base/?old=1#fragment";
testApiHost = "api.example:8443/gateway/?old=1#fragment";
queue(fixtures["search-api.json"]);
var overrideSearch = SearchComponent_search(0, "孤独摇滚");
assertTrue(String(requests[requests.length - 1].url).indexOf("https://api.example:8443/gateway/api.php/Vod/get_list?") === 0, "API host controls API URLs");
equal(overrideSearch.second.get(0).url, "http://web.example:8080/base/detail/26538", "web host controls page URLs");
equal(String(requests[requests.length - 1].headers.get("Referer")), "http://web.example:8080/base/", "web host controls request referer");
equal(String(requests[requests.length - 1].headers.get("Origin")), "http://web.example:8080", "origin excludes base path");
equal(overrideSearch.second.get(0).id, "26538", "host change keeps source ID");
equal(overrideSearch.second.get(0).cover, fixtures["search-api.json"].info.rows[0].vod_pic, "external cover origin unchanged");
queue(fixtures["detail-26538-api.json"]);
var overridePlay = PlayComponent_getPlayInfo({ id: "26538" }, { id: "0" }, { id: "0" });
equal(overridePlay.uri, "https://media.invalid/ggl-beta/26538/0/0.m3u8", "external CDN URL is never mechanically rewritten");
equal(String(overridePlay.header.get("Origin")), "http://web.example:8080", "media headers follow web host");
testHost = "";
testApiHost = "";

queue({}, 403);
expectParserError(function() { SearchComponent_search(0, "孤独摇滚"); }, "HTTP error propagates");
queuedResponses.push({ status: 200, text: "<!doctype html><title>unavailable</title>" });
expectParserError(function() { SearchComponent_search(0, "孤独摇滚"); }, "HTML cannot masquerade as empty search results");
queue({ code: 0, msg: "请求失败" });
expectParserError(function() { SearchComponent_search(0, "孤独摇滚"); }, "API rejection propagates");
queue({ code: 1, info: { rows: {} } });
expectParserError(function() { SearchComponent_search(0, "孤独摇滚"); }, "malformed list propagates");
queue({ code: 1, info: { vod_id: 1, vod_name: "错误 ID" } });
expectParserError(function() { DetailedComponent_getDetailed({ id: "26538" }); }, "wrong detail ID propagates");
queue({ code: 1, info: { total: 0, rows: [] } });
equal(SearchComponent_search(0, "无结果").second.size(), 0, "valid empty response");
equal(queuedResponses.length, 0, "every queued response consumed");
equal(responseClosed, requests.length, "all responses closed on success and failure");
print("PASS GiriGiriLove Beta: " + assertions + " assertions, " + requests.length + " mocked API requests, all response bodies closed");
