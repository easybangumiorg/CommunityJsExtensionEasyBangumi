// @key heyanle.milimili
// @label MiliMili
// @versionName 1.0
// @versionCode 1
// @libVersion 15
// @cover https://milimili.moe/favicon.ico

var networkHelper = Inject_NetworkHelper;
var okhttpHelper = Inject_OkhttpHelper;
var preferenceHelper = Inject_PreferenceHelper;
var webProxyProvider = Inject_WebProxyProvider;

var DEFAULT_HOST = "https://milimili.moe";
var RPC_PATH = "/milimili.platform.v1.PlatformService/";
var CATALOG_LIMIT = 24;
var PROOF_BLOCK_MESSAGE = "暂不支持 MiliMili 当前的播放方式，请在站点网页观看。登录后的应用内播放仍待验证。";
var LOGIN_TIPS = "MiliMili 观看需要登录。请在此页面正常登录，回到当前剧集并点击播放后返回。";

function PreferenceComponent_getPreference() {
    var list = new ArrayList();
    list.add(new SourcePreference.Edit("网页", "Host", DEFAULT_HOST));
    return list;
}

function PageComponent_getMainTabs() {
    var tabs = new ArrayList();
    tabs.add(new MainTab("最近更新", MainTab.MAIN_TAB_WITH_COVER, "latest_update"));
    tabs.add(new MainTab("高分推荐", MainTab.MAIN_TAB_WITH_COVER, "score"));
    return tabs;
}

function PageComponent_getSubTabs(mainTab) {
    return new ArrayList();
}

function PageComponent_getContent(mainTab, subTab, pageKey) {
    var offset = parseOffset(pageKey);
    var sort = mainTab != null ? trimText(mainTab.ext) : "";
    if (sort != "score") {
        sort = mainTab != null && String(mainTab.label) == "高分推荐" ? "score" : "latest_update";
    }
    var root = rpc("BrowseCatalog", {
        sectionSlug: "anime", sort: sort, offset: offset,
        limit: CATALOG_LIMIT, omitFacets: true
    }, false).data;
    return parseCatalog(root, offset);
}

function parseCatalog(root, offset) {
    var items = arrayValue(root.items);
    var list = new ArrayList();
    var seen = {};
    for (var i = 0; i < items.length; i++) {
        addCover(list, seen, items[i].video, episodeNote(items[i].latestEpisode));
    }
    var next = Number(root.nextOffset);
    var total = Number(root.totalCount);
    var nextKey = null;
    // Connect JSON may omit a zero nextOffset. Never invent the next offset.
    if (items.length > 0 && isFinite(next) && next > offset &&
            (!isFinite(total) || total <= 0 || next < total)) {
        nextKey = String(Math.floor(next));
    }
    return new Pair(nextKey, list);
}

function SearchComponent_search(pageKey, keyword) {
    if (pageKey != null && trimText(pageKey) != "" && String(pageKey) != "0") {
        return new Pair(null, new ArrayList());
    }
    var query = trimText(keyword);
    if (query.length == 0) {
        return new Pair(null, new ArrayList());
    }
    var root = rpc("SearchVideos", {
        query: query, limit: CATALOG_LIMIT, sectionSlug: "anime", contentType: "pgc"
    }, false).data;
    return parseSearch(root);
}

function parseSearch(root) {
    var videos = arrayValue(root.videos);
    var list = new ArrayList();
    var seen = {};
    for (var i = 0; i < videos.length; i++) {
        addCover(list, seen, videos[i], "");
    }
    // The public SearchVideos request has no pagination cursor or offset.
    return new Pair(null, list);
}

function addCover(list, seen, video, note) {
    if (video == null) {
        return;
    }
    var id = remoteShortId(video.shortId || video.detailPath, false);
    var title = trimText(video.title);
    if (id.length == 0 || title.length == 0 || seen[id]) {
        return;
    }
    seen[id] = true;
    list.add(makeCartoonCover({
        id: id, source: source.key, url: detailUrl(id), title: title,
        intro: note || videoIntro(video), cover: imageUrl(video.thumbnailUrl)
    }));
}

function DetailedComponent_getDetailed(summary) {
    var id = remoteShortId(summary.id, true);
    var root = rpc("GetBangumi", { shortId: id }, false).data;
    return parseDetailed(root, id);
}

function parseDetailed(root, id) {
    var video = root.video;
    if (video == null || trimText(video.title).length == 0) {
        throw new ParserException("MiliMili 详情响应缺少番剧信息", null);
    }
    var metadata = video.bangumiMetadata || {};
    var genre = arrayValue(metadata.tags).join(", ");
    var cartoon = makeCartoon({
        id: id, source: source.key, url: detailUrl(id), title: String(video.title),
        cover: imageUrl(video.thumbnailUrl || metadata.thumbnailUrl),
        intro: videoIntro(video), description: trimText(video.summary || metadata.summary),
        genre: genre,
        status: metadata.isOngoing === true ? Cartoon.STATUS_ONGOING : Cartoon.STATUS_UNKNOWN,
        updateStrategy: Cartoon.UPDATE_STRATEGY_ALWAYS
    });
    var entries = arrayValue(root.episodes);
    var ordered = [];
    for (var i = 0; i < entries.length; i++) {
        var episodeId = remoteEpisodeId(entries[i].ep, false);
        if (episodeId.length == 0 || (entries[i].status && entries[i].status != "published")) {
            continue;
        }
        var order = Number(entries[i].sortOrder);
        ordered.push({ data: entries[i], id: episodeId, index: i,
            order: isFinite(order) && order > 0 ? order : i + 1 });
    }
    ordered.sort(function(a, b) {
        return a.order == b.order ? a.index - b.index : a.order - b.order;
    });
    var episodes = new ArrayList();
    var seen = {};
    for (var j = 0; j < ordered.length; j++) {
        var item = ordered[j];
        if (seen[item.id]) {
            continue;
        }
        seen[item.id] = true;
        var data = item.data;
        var number = trimText(data.episodeLabel);
        // episodeOrder is inconsistent on the site; it must not determine order/labels.
        var label = number.length > 0 ? "第" + number + "集" : "第" + (episodes.size() + 1) + "集";
        var title = trimText(data.title);
        if (title.length > 0) {
            label += " " + title;
        }
        episodes.add(new Episode(item.id, label, episodes.size()));
    }
    var lines = new ArrayList();
    if (episodes.size() > 0) {
        lines.add(new PlayLine("main", "默认线路", episodes));
    }
    return new Pair(cartoon, lines);
}

function PlayComponent_getPlayInfo(summary, playLine, episode) {
    var ep = remoteEpisodeId(episode.id, true);
    // Observe the real public authentication result. Do not synthesize a playbackKey,
    // copy login credentials, or treat GetEpisodePreview metadata as playable media.
    var access = rpc("GetEpisode", { ep: ep }, true);
    var webProxy = webProxyProvider.getWebProxy();
    webProxy.loadUrl(watchUrl(ep), userAgent(), makeHeaders(), null, false);
    webProxy.waitingForPageLoaded(8000);
    return resolveWebPlayback(webProxy, ep, access.status == 401, false);
}

function PlayComponent_getPlayInfoWithCheck(summary, playLine, episode, webProxy) {
    var ep = remoteEpisodeId(episode.id, true);
    // Keep the exact WebProxy handed back by the verification window.
    // loadUrl() is one-shot; href() only returns this same window to the episode.
    var state = readPageState(webProxy, ep);
    if (state.path && state.matched !== true) {
        webProxy.href(watchUrl(ep), true);
    }
    webProxy.waitingForPageLoaded(8000);
    return resolveWebPlayback(webProxy, ep, false, true);
}

function resolveWebPlayback(webProxy, ep, apiNeedsLogin, afterCheck) {
    var state = readPageState(webProxy, ep);
    // API15 retains past requests even after href(). A request-list hit cannot
    // establish episode ownership. Poll only this exact page's current video.
    var attempts = afterCheck ? 40 : 4;
    for (var i = 0; i < attempts; i++) {
        if (state.login || (apiNeedsLogin && !state.hasVideo) ||
                (state.matched === true && (state.blobVideo || isHttpMedia(state.videoSrc)))) {
            break;
        }
        if (i + 1 < attempts) {
            webProxy.delay(200);
            state = readPageState(webProxy, ep);
        }
    }
    var candidate = state.matched === true && isHttpMedia(state.videoSrc) ? String(state.videoSrc) : "";
    if (hasPlaybackProof(candidate)) {
        throw new ParserException(PROOF_BLOCK_MESSAGE, null);
    }
    if (candidate.length > 0) {
        var info = validateStaticMedia(candidate);
        if (info != null) {
            webProxy.close();
            return info;
        }
    }
    if (state.login || (apiNeedsLogin && !state.hasVideo)) {
        // Do not close: needUserCheck transfers ownership of this exact window.
        webProxy.needUserCheck(LOGIN_TIPS);
    }
    if (!afterCheck) {
        webProxy.needUserCheck("请在 MiliMili 网页中正常登录并点击当前剧集播放，网页开始播放后返回。");
    }
    if (state.matched !== true) {
        webProxy.needUserCheck("请回到当前剧集的 MiliMili 网页并播放后返回。");
    }
    if (state.blobVideo) {
        throw new ParserException("暂不支持 MiliMili 当前的网页播放方式，请在站点网页观看。登录后的应用内播放仍待验证。", null);
    }
    throw new ParserException("暂未取得播放地址。请确认已登录，并在网页播放当前剧集后重试。登录后的应用内播放仍待验证。", null);
}

function readPageState(webProxy, ep) {
    // Only inspect visible page state and the video element. Never read cookies,
    // localStorage, IndexedDB, Nuxt session state, passwords, or JWTs.
    var expected = JSON.stringify(watchUrl(ep));
    var script = "(function(){var e=new URL(" + expected + ");var c=new URL(location.href);" +
        "var matched=c.origin===e.origin&&c.pathname===e.pathname&&c.searchParams.get('ep')===e.searchParams.get('ep')&&c.searchParams.getAll('ep').length===1;" +
        "var t=document.body?document.body.innerText:'';var v=matched?document.querySelector('video'):null;" +
        "var s=v?(v.currentSrc||v.src||''):'';return JSON.stringify({matched:matched,path:c.pathname," +
        "login:t.indexOf('登录后即可观看')>=0||t.indexOf('请先登录')>=0,hasVideo:!!v,blobVideo:s.indexOf('blob:')===0," +
        "videoSrc:s.indexOf('http://')===0||s.indexOf('https://')===0?s:''});})();";
    try {
        var value = webProxy.executeJavaScript(script, 100);
        if (value == null) {
            return {};
        }
        value = JSON.parse(String(value));
        if (typeof value == "string") {
            value = JSON.parse(value);
        }
        return value || {};
    } catch (e) {
        return {};
    }
}

function validateStaticMedia(url) {
    var headers = makeHeaders();
    if (/\.mp4(?:[?#]|$)/i.test(String(url))) {
        headers.put("Range", "bytes=0-0");
    }
    var response = okhttpHelper.client.newCall(OkhttpUtils.get(String(url), headers)).execute();
    try {
        if (!response.isSuccessful()) {
            return null;
        }
        var type = trimText(response.header("Content-Type")).toLowerCase();
        var decodeType = PlayerInfo.DECODE_TYPE_OTHER;
        if (type.indexOf("mpegurl") >= 0) {
            decodeType = PlayerInfo.DECODE_TYPE_HLS;
        } else if (type.indexOf("dash+xml") >= 0) {
            decodeType = PlayerInfo.DECODE_TYPE_DASH;
        } else if (type.indexOf("video/") != 0) {
            return null;
        }
        if (decodeType == PlayerInfo.DECODE_TYPE_HLS || decodeType == PlayerInfo.DECODE_TYPE_DASH) {
            var body = response.body();
            var manifest = body == null ? "" : String(body.string());
            if (/[?&](?:amp;)?(mk|mt|mp)=/i.test(manifest)) {
                throw new ParserException(PROOF_BLOCK_MESSAGE, null);
            }
            if ((decodeType == PlayerInfo.DECODE_TYPE_HLS && manifest.indexOf("#EXTM3U") < 0) ||
                    (decodeType == PlayerInfo.DECODE_TYPE_DASH && manifest.indexOf("<MPD") < 0)) {
                return null;
            }
        }
        var info = new PlayerInfo(decodeType, String(url));
        info.header = makeHeaders();
        return info;
    } finally {
        response.close();
    }
}

function hasPlaybackProof(url) {
    var text = trimText(url);
    return /[?&]mp=/i.test(text) || (/[?&]mk=/i.test(text) && /[?&]mt=/i.test(text));
}

function isHttpMedia(url) {
    var text = trimText(url);
    return /^https?:\/\//i.test(text) &&
        (/\.(m3u8|mp4|mpd)(?:[?#]|$)/i.test(text) || hasPlaybackProof(text));
}

function rpc(method, body, allowLogin) {
    var requestBody = RequestBody.create(MediaType.get("application/json; charset=utf-8"), JSON.stringify(body));
    var request = new Request.Builder()
        .url(siteUrl(RPC_PATH + method))
        .header("User-Agent", userAgent())
        .header("Referer", siteUrl("/"))
        .header("Connect-Protocol-Version", "1")
        .post(requestBody)
        .build();
    var response = okhttpHelper.client.newCall(request).execute();
    try {
        var status = response.code();
        // HTTP 401 itself is enough to open the original login window. An auth
        // response may legitimately have no body; it is not a successful RPC.
        if (status == 401 && allowLogin) {
            return { status: status, data: {} };
        }
        var responseBody = response.body();
        var text = responseBody == null ? "" : String(responseBody.string());
        var data = {};
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new ParserException("MiliMili " + method + " 返回了无效 JSON（HTTP " + status + "）", null);
        }
        if (data == null || Object.prototype.toString.call(data) != "[object Object]") {
            throw new ParserException("MiliMili " + method + " 返回了无效 JSON（HTTP " + status + "）", null);
        }
        if (!response.isSuccessful()) {
            var message = trimText(data.message);
            throw new ParserException("MiliMili " + method + " 请求失败（HTTP " + status + "）" +
                (message.length > 0 ? ": " + message.substring(0, 160) : ""), null);
        }
        return { status: status, data: data };
    } finally {
        response.close();
    }
}

function getRootUrl() {
    return normalizeHost(preferenceHelper.get("Host", DEFAULT_HOST));
}

function normalizeHost(input) {
    var value = trimText(input);
    if (value.length == 0) {
        value = DEFAULT_HOST;
    }
    value = value.split(/[?#]/)[0];
    if (value.indexOf("//") == 0) {
        value = "https:" + value;
    } else if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value) ||
            /^[^/?#:\s]+:[0-9]+(?:[/?#]|$)/.test(value)) {
        value = "https://" + value;
    }
    try {
        var uri = new URI(value);
        var scheme = uri.getScheme() == null ? "" : String(uri.getScheme()).toLowerCase();
        var host = uri.getHost() == null ? "" : String(uri.getHost());
        if ((scheme != "http" && scheme != "https") || host.length == 0 ||
                uri.getRawUserInfo() != null || uri.getPort() > 65535 || /\s/.test(value)) {
            throw new Error("invalid host");
        }
        var path = uri.getRawPath() == null ? "" : String(uri.getRawPath());
        return scheme + "://" + String(uri.getRawAuthority()) + path.replace(/\/+$/, "");
    } catch (e) {
        throw new ParserException("网页 Host 无效，请填写 http 或 https 网址（例如 " + DEFAULT_HOST + "）", null);
    }
}

function siteUrl(path) {
    return getRootUrl() + "/" + String(path == null ? "" : path).replace(/^\/+/, "");
}

function detailUrl(id) {
    return siteUrl("/bangumi/" + remoteShortId(id, true));
}

function watchUrl(ep) {
    return siteUrl("/watch?ep=" + remoteEpisodeId(ep, true));
}

function imageUrl(value) {
    var text = trimText(value);
    if (text.length == 0) {
        return "";
    }
    // Rebind only this site's origin. External image/media CDNs keep their host.
    if (text.indexOf("/") == 0 && text.indexOf("//") != 0) {
        return siteUrl(text);
    }
    try {
        var uri = new URI(text);
        if (uri.getHost() != null && String(uri.getHost()).toLowerCase() == "milimili.moe") {
            var path = uri.getRawPath() == null ? "/" : String(uri.getRawPath());
            return siteUrl(path) + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
        }
    } catch (e) {
        return "";
    }
    return String(SourceUtils.urlParser(siteUrl("/"), text));
}

function remoteShortId(value, required) {
    var text = trimText(value);
    if (/^ml[1-9][0-9]*$/.test(text)) {
        return text;
    }
    var match = text.match(/(?:^|\/)bangumi\/(ml[1-9][0-9]*)(?:[/?#]|$)/);
    if (match != null) {
        return String(match[1]);
    }
    if (required) {
        throw new ParserException("MiliMili 番剧 ID 无效", null);
    }
    return "";
}

function remoteEpisodeId(value, required) {
    var text = trimText(value);
    if (/^[1-9][0-9]*$/.test(text)) {
        return text;
    }
    var match = text.match(/(?:^|\/)watch\?(?:[^#]*&)?ep=([1-9][0-9]*)(?:[&#]|$)/);
    if (match != null) {
        return String(match[1]);
    }
    if (required) {
        throw new ParserException("MiliMili 剧集 ID 无效", null);
    }
    return "";
}

function parseOffset(value) {
    var text = trimText(value);
    if (text.length == 0) {
        return 0;
    }
    if (!/^[0-9]+$/.test(text) || Number(text) > 2147483647) {
        throw new ParserException("MiliMili 目录分页偏移无效", null);
    }
    return Number(text);
}

function episodeNote(episode) {
    if (episode == null) {
        return "";
    }
    var label = trimText(episode.episodeLabel);
    return label.length > 0 ? "更新至第" + label + "集" : trimText(episode.title);
}

function videoIntro(video) {
    var metadata = video.bangumiMetadata || {};
    var parts = [];
    if (metadata.workType) {
        parts.push(String(metadata.workType));
    }
    if (Number(metadata.releaseYear) > 0) {
        parts.push(String(metadata.releaseYear));
    }
    if (Number(metadata.bangumiScore) > 0) {
        parts.push("评分 " + metadata.bangumiScore);
    }
    if (Number(video.managedEpisodeCount) > 0) {
        parts.push("已收录 " + video.managedEpisodeCount + " 集");
    }
    return parts.join(" / ");
}

function makeHeaders() {
    var headers = new HashMap();
    headers.put("User-Agent", userAgent());
    headers.put("Referer", siteUrl("/"));
    return headers;
}

function userAgent() {
    return String(networkHelper.defaultLinuxUA);
}

function arrayValue(value) {
    return Object.prototype.toString.call(value) == "[object Array]" ? value : [];
}

function trimText(value) {
    return value == null ? "" : String(value).replace(/^\s+|\s+$/g, "");
}
