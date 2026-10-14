// @key kazumi.ciyuancheng
// @label ciyuancheng
// @versionName 2.1
// @versionCode 20100
// @libVersion 15
// @cover https://www.cycani.org/favicon.ico

var networkHelper = Inject_NetworkHelper;
var okhttpHelper = Inject_OkhttpHelper;
var preferenceHelper = Inject_PreferenceHelper;
var webProxyProvider = Inject_WebProxyProvider;
var CYC_DEFAULT_HOST = "https://www.cycani.org";
var CYC_PAGE_SIZE = 24;
var CYC_SECTION_PAGE_SIZE = 100;
var CYC_MAX_PAGES = 200;

function PreferenceComponent_getPreference() {
    var list = new ArrayList();
    list.add(new SourcePreference.Edit("网页", "Host", CYC_DEFAULT_HOST));
    return list;
}
function cycText(value) { return value == null ? "" : String(value).trim(); }
function cycIsArray(value) { return Object.prototype.toString.call(value) == "[object Array]"; }
function cycIsObject(value) { return Object.prototype.toString.call(value) == "[object Object]"; }
function cycArray(value) { return cycIsArray(value) ? value : []; }
function cycRequiredArray(value, label) {
    if (!cycIsArray(value)) cycFail("次元城 " + label + "返回格式无效：缺少列表或列表类型错误");
    return value;
}
function cycList(value) {
    if (cycIsArray(value)) return value;
    if (cycIsObject(value)) {
        var fields = ["list", "items", "sections"];
        for (var i = 0; i < fields.length; i++) if (Object.prototype.hasOwnProperty.call(value, fields[i])) return cycRequiredArray(value[fields[i]], "列表");
    }
    cycFail("次元城列表返回格式无效：缺少列表");
}
function cycContractList(value, label) {
    if (!cycIsObject(value)) cycFail("次元城 " + label + "返回格式无效");
    return cycRequiredArray(value.list, label);
}
function cycPositive(value, fallback) {
    if (typeof value != "number" && typeof value != "string") return fallback;
    var number = Number(value);
    return isFinite(number) && number > 0 && Math.floor(number) == number ? number : fallback;
}
function cycFail(message) { throw new ParserException(String(message), null); }
function normalizeRootUrl(raw) {
    var value = cycText(raw) || CYC_DEFAULT_HOST;
    if (value.indexOf("//") == 0) value = "https:" + value;
    else if (!/^https?:\/\//i.test(value)) {
        if (value.indexOf("://") >= 0 || (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[^\s/?#:]+:\d+(?:\/|[?#]|$)/.test(value))) {
            cycFail("网页 Host 仅支持 http 或 https");
        }
        value = "https://" + value;
    }
    var uri;
    try { uri = URI.create(value); } catch (ignored) { cycFail("网页 Host 格式无效"); }
    var scheme = cycText(uri.getScheme()).toLowerCase();
    if ((scheme != "http" && scheme != "https") || !cycText(uri.getHost()) || uri.getRawUserInfo() != null || uri.getPort() > 65535) {
        cycFail("网页 Host 格式无效，仅支持 http 或 https");
    }
    return (scheme + "://" + uri.getRawAuthority() + cycText(uri.getRawPath())).replace(/\/+$/, "");
}
function getRootUrl() { return normalizeRootUrl(preferenceHelper.get("Host", CYC_DEFAULT_HOST)); }
function cycUrl(path) { return getRootUrl() + "/" + cycText(path).replace(/^\/+/, ""); }
function cycAbsolute(value) {
    var text = cycText(value);
    if (!text) return "";
    if (/^https?:\/\//i.test(text)) {
        var uri;
        try { uri = URI.create(text); } catch (ignored) { return ""; }
        if (/^(?:www\.)?cycani\.org$/i.test(cycText(uri.getHost()))) {
            return cycUrl(cycText(uri.getRawPath())) + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
        }
        return text;
    }
    if (text.indexOf("//") == 0) return cycText(URI.create(getRootUrl()).getScheme()) + ":" + text;
    if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return "";
    return SourceUtils.urlParser(getRootUrl() + "/", text);
}
function cycHeaders() {
    var headers = new HashMap();
    headers.put("User-Agent", networkHelper.defaultAndroidUA);
    headers.put("Referer", getRootUrl() + "/");
    headers.put("Accept", "application/json");
    headers.put("X-App-Name", "cyc_web");
    headers.put("X-App-Version", "cycweb");
    headers.put("X-Time-Zone", "Asia/Shanghai");
    return headers;
}
function cycApi(path) {
    var response = okhttpHelper.client.newCall(OkhttpUtils.get(cycUrl("api" + path), cycHeaders())).execute();
    try {
        var status = response.code();
        var body = response.body();
        var envelope = null;
        try { envelope = JSON.parse(body == null ? "" : String(body.string())); } catch (ignoredJson) {}
        if (status == 401 || status == 403 || (envelope && (Number(envelope.code) == 401 || Number(envelope.code) == 403))) {
            var auth = new Error("次元城要求登录后观看，请在原网页登录并播放所选集数");
            auth.cycAuthRequired = true;
            throw auth;
        }
        if (!response.isSuccessful()) cycFail("次元城请求失败: HTTP " + status);
        if (!cycIsObject(envelope) || typeof envelope.code != "number" || !isFinite(envelope.code) || Math.floor(envelope.code) != envelope.code || !Object.prototype.hasOwnProperty.call(envelope, "data")) cycFail("次元城 API 返回格式无效");
        if (Number(envelope.code) != 0) cycFail("次元城 API 错误: " + (cycText(envelope.msg) || envelope.code));
        return envelope.data;
    } finally { response.close(); }
}
function cycPager(data, requestedPage, requestedSize) {
    var items = cycList(data);
    // The frontend also accepts a complete sections array without pagination.
    if (cycIsArray(data)) return { list: items, page: requestedPage, size: requestedSize, more: false };
    var pager = data.pager;
    if (!cycIsObject(pager) || typeof pager.page != "number" || cycPositive(pager.page, 0) == 0 ||
        typeof pager.page_size != "number" || cycPositive(pager.page_size, 0) == 0 ||
        typeof pager.total != "number" || !isFinite(pager.total) || pager.total < 0 || Math.floor(pager.total) != pager.total) {
        cycFail("次元城分页返回格式无效");
    }
    var page = pager.page, size = pager.page_size, total = pager.total;
    if (page != requestedPage) cycFail("次元城分页响应与请求不一致，请重试");
    if (items.length == 0 && (page - 1) * size < total) cycFail("次元城分页结果缺失，请重试");
    if (items.length > 0 && total == 0) cycFail("次元城分页结果与总数不一致，请重试");
    return { list: items, page: page, size: size, more: items.length > 0 && page * size < total };
}
function cycValidateVideos(items, label) {
    cycRequiredArray(items, label);
    for (var i = 0; i < items.length; i++) if (!cycIsObject(items[i]) || !cycVideoId(items[i]) || typeof items[i].title != "string" || !cycText(items[i].title)) cycFail("次元城 " + label + "番剧条目格式无效");
    return items;
}
function cycVideoPage(data, requestedPage, requestedSize) {
    cycContractList(data, "番剧列表");
    var paged = cycPager(data, requestedPage, requestedSize);
    cycValidateVideos(paged.list, "番剧列表");
    return paged;
}
function cycRecommendGroups() {
    var groups = cycContractList(cycApi("/index/recommend"), "首页推荐");
    for (var i = 0; i < groups.length; i++) {
        var group = groups[i];
        if (!cycIsObject(group) || !cycPositive(group.id, 0) || typeof group.name != "string" || !cycText(group.name)) cycFail("次元城首页推荐分组格式无效");
        cycValidateVideos(group.videos, "首页推荐");
    }
    return groups;
}
function cycWeekdays(path) {
    var days = cycContractList(cycApi(path), "新番时间表");
    for (var i = 0; i < days.length; i++) {
        var day = days[i];
        if (!cycIsObject(day) || !cycPositive(day.weekday, 0) || Number(day.weekday) > 7) cycFail("次元城新番时间表分组格式无效");
        cycValidateVideos(day.videos, "新番时间表");
    }
    return days;
}
function cycVideoId(item) { return cycPositive(item && (item.video_id || item.id), 0); }
function cycCover(item) {
    var id = cycVideoId(item), title = cycText(item && item.title);
    if (!id || !title) return null;
    return makeCartoonCover({ id: "cyc-v2:" + id, source: source.key, url: cycUrl("anime/" + id), title: title,
        intro: cycText(item.remarks) || cycText(item.version), cover: cycAbsolute(item.cover_url) });
}
function cycCovers(items) {
    var result = new ArrayList();
    for (var i = 0; i < items.length; i++) { var cover = cycCover(items[i]); if (cover != null) result.add(cover); }
    return result;
}
function PageComponent_getMainTabs() {
    var result = new ArrayList();
    result.add(new MainTab("首页推荐", MainTab.MAIN_TAB_GROUP));
    result.add(new MainTab("分类", MainTab.MAIN_TAB_GROUP));
    result.add(new MainTab("新番时间表", MainTab.MAIN_TAB_GROUP));
    return result;
}
function PageComponent_getSubTabs(mainTab) {
    var result = new ArrayList(), label = cycText(mainTab.label);
    if (label == "首页推荐") {
        var groups = cycRecommendGroups();
        for (var i = 0; i < groups.length; i++) if (groups[i] && cycText(groups[i].name)) {
            result.add(new SubTab(cycText(groups[i].name), true, "recommend:" + groups[i].id));
        }
    } else if (label == "分类") {
        var zones = cycContractList(cycApi("/video-zones"), "分类");
        for (var j = 0; j < zones.length; j++) {
            if (!cycIsObject(zones[j]) || !cycPositive(zones[j].id, 0) || typeof zones[j].name != "string" || !cycText(zones[j].name)) cycFail("次元城分类条目格式无效");
            result.add(new SubTab(cycText(zones[j].name), true, "zone:" + zones[j].id));
        }
    } else if (label == "新番时间表") {
        var names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
        for (var k = 0; k < names.length; k++) result.add(new SubTab(names[k], true, "weekday:" + (k + 1)));
    }
    return result;
}
function PageComponent_getContent(mainTab, subTab, pageKey) {
    var key = Math.max(0, Math.floor(Number(pageKey) || 0));
    var ext = cycText(subTab && subTab.ext), split = ext.split(":"), selected = split[1];
    if (split[0] == "zone") {
        var page = key + 1;
        var data = cycApi("/videos?page=" + page + "&page_size=" + CYC_PAGE_SIZE + "&zone_id=" + encodeURIComponent(selected) + "&order_by=update_time");
        var paged = cycVideoPage(data, page, CYC_PAGE_SIZE);
        return new Pair(paged.more ? key + 1 : null, cycCovers(paged.list));
    }
    if (key != 0) return new Pair(null, new ArrayList());
    if (split[0] == "recommend") {
        var groups = cycRecommendGroups();
        for (var i = 0; i < groups.length; i++) if (String(groups[i].id) == selected) return new Pair(null, cycCovers(groups[i].videos));
        cycFail("次元城首页推荐分组已变化，请刷新首页");
    } else if (split[0] == "weekday") {
        var days = cycWeekdays("/index/weekday?weekday=" + encodeURIComponent(selected));
        for (var j = 0; j < days.length; j++) if (days[j] && String(days[j].weekday) == selected) return new Pair(null, cycCovers(days[j].videos));
    }
    return new Pair(null, new ArrayList());
}
function SearchComponent_search(pageKey, keyword) {
    var key = Math.max(0, Math.floor(Number(pageKey) || 0));
    var data = cycApi("/videos/search?q=" + encodeURIComponent(cycText(keyword)) + "&page=" + (key + 1) + "&page_size=" + CYC_PAGE_SIZE);
    var paged = cycVideoPage(data, key + 1, CYC_PAGE_SIZE);
    return new Pair(paged.more ? key + 1 : null, cycCovers(paged.list));
}
// Legacy MacCMS numeric IDs are a different namespace from the current API.
function cycLegacy(value) {
    var parts = String(value).split("|"), decoded = [];
    try { for (var i = 0; i < Math.min(3, parts.length); i++) decoded.push(String(URLDecoder.decode(parts[i], "utf-8"))); }
    catch (ignored) { cycFail("旧次元城收藏格式无效，请重新搜索并收藏"); }
    return { url: decoded[0] || "", title: decoded[1] || "", cover: decoded[2] || "" };
}
function cycRemoteId(summary) {
    var value = cycText(summary.id), modern = /^cyc-v2:(\d+)$/.exec(value);
    if (modern) return cycPositive(modern[1], 0) || cycFail("番剧 ID 无效");
    if (value.indexOf("cyc-v2:") == 0) cycFail("次元城番剧 ID 无效，请重新搜索");
    var legacy = cycLegacy(value), route = null;
    try { route = /^\/anime\/(\d+)\/?$/.exec(cycText(URI.create(legacy.url).getPath())); } catch (ignoredUri) {}
    if (route && cycPositive(route[1], 0)) return Number(route[1]);
    var title = cycText(legacy.title);
    if (!title) cycFail("旧次元城收藏无法自动迁移，请重新搜索并收藏");
    var match = {}, count = 0;
    for (var page = 1; page <= CYC_MAX_PAGES; page++) {
        var data = cycApi("/videos/search?q=" + encodeURIComponent(title) + "&page=" + page + "&page_size=" + CYC_PAGE_SIZE);
        var paged = cycVideoPage(data, page, CYC_PAGE_SIZE);
        for (var i = 0; i < paged.list.length; i++) {
            var item = paged.list[i], id = cycVideoId(item);
            if (id && cycText(item.title) == title && !match[String(id)]) { match[String(id)] = true; count++; }
        }
        if (!paged.more) {
            if (count == 1) { for (var found in match) if (Object.prototype.hasOwnProperty.call(match, found)) return Number(found); }
            cycFail("旧次元城收藏没有唯一同名作品，请重新搜索并收藏");
        }
    }
    cycFail("旧次元城收藏搜索结果过多，请重新搜索并收藏");
}
function cycSections(remoteId, code) {
    var result = [], seen = {}, ordinal = 0;
    for (var page = 1; page <= CYC_MAX_PAGES; page++) {
        var data = cycApi("/videos/" + remoteId + "/sections?player_code=" + encodeURIComponent(code) + "&page=" + page + "&page_size=" + CYC_SECTION_PAGE_SIZE);
        var paged = cycPager(data, page, CYC_SECTION_PAGE_SIZE);
        for (var i = 0; i < paged.list.length; i++) {
            var item = paged.list[i], id = cycPositive(item && item.id, 0);
            if (!cycIsObject(item) || !id) cycFail("次元城选集条目格式无效");
            if (seen[String(id)]) cycFail("次元城选集分页重复，请刷新详情重试");
            seen[String(id)] = true;
            var order = cycPositive(item.order, (paged.page - 1) * paged.size + i + 1);
            result.push({ id: id, title: cycText(item.title) || "第 " + order + " 集", order: order, ordinal: ordinal++ });
        }
        if (!paged.more) {
            result.sort(function(a, b) { return a.order - b.order || a.ordinal - b.ordinal; });
            return result;
        }
    }
    cycFail("次元城选集分页过多，请稍后重试");
}
function DetailedComponent_getDetailed(summary) {
    var id = cycRemoteId(summary), detail = cycApi("/videos/" + id);
    if (!cycIsObject(detail) || !cycPositive(detail.id, 0) || Number(detail.id) != id) cycFail("次元城作品不存在或详情不匹配");
    if (typeof detail.title != "string" || !cycText(detail.title)) cycFail("次元城详情标题格式无效");
    if (detail.play_from != null && !cycIsArray(detail.play_from)) cycFail("次元城详情线路格式无效");
    var lines = new ArrayList(), sources = cycArray(detail.play_from), usedCodes = {};
    for (var i = 0; i < sources.length; i++) {
        if (sources[i] == null) continue;
        if (!cycIsObject(sources[i]) || (sources[i].code != null && typeof sources[i].code != "string")) cycFail("次元城详情线路条目格式无效");
        var code = cycText(sources[i].code);
        if (!code || usedCodes["code:" + code]) continue;
        usedCodes["code:" + code] = true;
        var sections = cycSections(id, code), episodes = new ArrayList();
        for (var j = 0; j < sections.length; j++) {
            var section = sections[j];
            episodes.add(new Episode("cyc-v2:" + id + ":" + encodeURIComponent(code) + ":" + section.id + ":" + section.order, section.title, j));
        }
        if (episodes.size() > 0) lines.add(new PlayLine("cyc-v2:" + encodeURIComponent(code), cycText(sources[i].title) || code, episodes));
    }
    var tags = cycArray(detail.categories).concat(cycArray(detail.tags));
    var cartoon = makeCartoon({ id: String(summary.id), source: source.key, url: cycUrl("anime/" + id), title: cycText(detail.title),
        cover: cycAbsolute(detail.cover_url), intro: cycText(detail.remarks), description: cycText(detail.description), genre: tags.join(", "),
        status: detail.completed === true ? Cartoon.STATUS_COMPLETED : (detail.completed === false ? Cartoon.STATUS_ONGOING : Cartoon.STATUS_UNKNOWN), updateStrategy: Cartoon.UPDATE_STRATEGY_ALWAYS });
    return new Pair(cartoon, lines);
}
function cycPlayContext(summary, playLine, episode) {
    var match = /^cyc-v2:(\d+):([^:]+):(\d+):(\d+)$/.exec(cycText(episode.id));
    if (!match) cycFail("旧次元城选集已失效，请刷新详情后重新选集");
    var id = cycRemoteId(summary), code = "";
    try { code = decodeURIComponent(match[2]); } catch (ignored) { cycFail("次元城线路 ID 无效"); }
    if (Number(match[1]) != id || cycText(playLine.id) != "cyc-v2:" + encodeURIComponent(code)) cycFail("次元城作品或线路不匹配，请刷新详情");
    var order = cycPositive(match[4], 0), sectionId = cycPositive(match[3], 0);
    if (!order || !sectionId || !code) cycFail("次元城选集 ID 无效");
    return { id: id, code: code, sectionId: sectionId, order: order,
        page: cycUrl("anime/" + id + "/play/" + order) + "?from=" + encodeURIComponent(code) };
}
function cycMediaInfo(url) {
    var value = cycText(url);
    if (!/^https?:\/\//i.test(value)) cycFail("次元城未返回可用媒体地址，请在原网页确认所选集数能播放");
    var info = new PlayerInfo(/\.m3u8(?:[?#]|$)/i.test(value) ? PlayerInfo.DECODE_TYPE_HLS : PlayerInfo.DECODE_TYPE_OTHER, value);
    // The site's player sets no-referrer for media requests.
    info.header = new HashMap();
    info.header.put("User-Agent", networkHelper.defaultAndroidUA);
    return info;
}
function cycIssuedPlay(context) {
    var data = cycApi("/v2/sections/" + context.sectionId + "/play-url");
    if (!data || !cycText(data.url)) cycFail("次元城暂无该集播放地址");
    return cycMediaInfo(data.url);
}
function PlayComponent_getPlayInfo(summary, playLine, episode) {
    var context = cycPlayContext(summary, playLine, episode);
    try { return cycIssuedPlay(context); }
    catch (error) {
        if (!error || !error.cycAuthRequired) throw error;
        var proxy = webProxyProvider.getWebProxy();
        proxy.loadUrl(context.page, networkHelper.defaultAndroidUA, null, null, false);
        proxy.waitingForPageLoaded();
        var state = cycCurrentPlayer(proxy, context);
        if (state && state.matched === true && /^https?:\/\//i.test(cycText(state.media))) return cycMediaInfo(state.media);
        proxy.needUserCheck("次元城要求登录后观看；请在原网页登录并播放当前作品、线路和集数，成功后点验证完成");
    }
}
function cycUnwrapJs(value) {
    var text = cycText(value);
    try { return JSON.parse(text); } catch (ignored) { return text; }
}
function cycCurrentPlayer(proxy, context) {
    // Read only the current original page's player. HLS uses a blob video URL,
    // so resolve its already-loaded Artplayer instance by the same video node.
    var expected = JSON.stringify(context.page);
    var check = "var e=new URL(" + expected + ");var q=new URLSearchParams(location.search);" +
        "var matched=location.origin+location.pathname===e.origin+e.pathname&&q.get('from')===e.searchParams.get('from');";
    var script = "(function(){" + check + "if(!matched)return {matched:false};" +
        "delete window.__easybangumiCycPlayer;var v=document.querySelector('.cyc-artplayer video');" +
        "var media=v?(v.currentSrc||v.src||''):'';if(/^https?:\\/\\//i.test(media))return {matched:true,media:media};" +
        "if(!v)return {matched:true,media:''};var entries=performance.getEntriesByType('resource'),asset='';" +
        "for(var i=entries.length-1;i>=0;i--){var u=new URL(entries[i].name);if(u.origin===e.origin&&/\\/assets\\/artplayer-[^/]+\\.js$/.test(u.pathname)){asset=u.href;break;}}" +
        "if(!asset)return {matched:true,media:''};" +
        "import(asset).then(function(m){var instances=m.default&&m.default.instances||[];var url='';" +
        "for(var i=0;i<instances.length;i++){var a=instances[i];if(!a.isDestroy&&a.video===v){url=a.option&&a.option.url||'';break;}}" +
        "window.__easybangumiCycPlayer={video:v,media:url};}).catch(function(){window.__easybangumiCycPlayer={video:v,media:''};});" +
        "return {matched:true,pending:true};})()";
    var state = cycUnwrapJs(proxy.executeJavaScript(script, 1000));
    if (!state || state.pending !== true) return state;
    var poll = "(function(){" + check + "if(!matched){delete window.__easybangumiCycPlayer;return {matched:false};}" +
        "var s=window.__easybangumiCycPlayer;if(!s)return {matched:true,pending:true};delete window.__easybangumiCycPlayer;" +
        "var v=document.querySelector('.cyc-artplayer video');return {matched:s.video===v,media:s.media};})()";
    for (var i = 0; i < 5; i++) {
        proxy.delay(200);
        state = cycUnwrapJs(proxy.executeJavaScript(poll, 1000));
        if (!state || state.pending !== true) return state;
    }
    proxy.executeJavaScript("delete window.__easybangumiCycPlayer", 1000);
    return { matched: true, media: "" };
}
function PlayComponent_getPlayInfoWithCheck(summary, playLine, episode, proxy) {
    var context = cycPlayContext(summary, playLine, episode);
    proxy.waitingForPageLoaded();
    var state = cycCurrentPlayer(proxy, context);
    if (!state || state.matched !== true) proxy.needUserCheck("请回到当前作品的原线路和所选集数，播放成功后点验证完成");
    if (state && /^https?:\/\//i.test(cycText(state.media))) return cycMediaInfo(state.media);
    proxy.needUserCheck("次元城尚未返回当前选集的播放地址；请确认已登录且原网页可以播放，再点验证完成");
}
