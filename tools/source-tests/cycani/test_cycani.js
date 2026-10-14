/* Offline adapter contract tests; fixtures are public, unauthenticated responses. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = __dirname;
const adapter = process.argv[2] || path.join(root, 'kazumi-ciyuancheng.js');
const fixtureRoot = process.argv[3] || path.join(root, 'sanitized-fixtures');
function fixture(name) { return JSON.parse(fs.readFileSync(path.join(fixtureRoot, name), 'utf8')); }
const data = {};
for (const name of ['recommend','zones','search','detail-3870','detail-3488','detail-2109','sections-3870-0','sections-3488-0','sections-2109-0','weekday','category-1','play-unauthenticated','sections-3870-size2-page1','sections-3870-size2-page2']) data[name] = fixture(name + '.json');
class List extends Array { add(value) { this.push(value); } size() { return this.length; } get(index) { return this[index]; } }
class Map { constructor() { this.values = {}; } put(key,value) { this.values[key] = value; } }
class ParserException extends Error {}
class UserCheck extends Error { constructor(message, proxy) { super(message); this.proxy = proxy; } }
function URI(value) {
    if (/\s/.test(value)) throw new Error('invalid URI');
    const u = new URL(value);
    return {
        getScheme: () => u.protocol.slice(0,-1), getHost: () => u.hostname,
        getRawUserInfo: () => u.username || u.password ? u.username + ':' + u.password : null,
        getPort: () => u.port ? Number(u.port) : -1,
        getRawAuthority: () => u.host, getRawPath: () => u.pathname,
        getPath: () => decodeURIComponent(u.pathname), getRawQuery: () => u.search ? u.search.slice(1) : null
    };
}
const originalSource = fs.readFileSync(adapter, 'utf8');
function harness(host='https://www.cycani.org') {
    const requests = [], routes = {}, proxies = [];
    let closed = 0;
    const context = {
        Inject_NetworkHelper: { defaultAndroidUA:'fixture-android-ua' },
        Inject_PreferenceHelper: { get: (_key, fallback) => host == null ? fallback : host },
        Inject_OkhttpHelper: { client: { newCall: request => ({ execute() {
            requests.push(request);
            const route = routes[request.url];
            if (!route) throw new Error('Unmocked API ' + request.url);
            const result = typeof route == 'function' ? route(request) : route;
            const status = result.status || 200;
            return { code: () => status, isSuccessful: () => status>=200 && status<300,
                body: () => result.nullBody ? null : ({ string: () => result.text != null ? result.text : JSON.stringify(result.json) }),
                close() { closed++; } };
        } }) } },
        Inject_WebProxyProvider: { getWebProxy() { const proxy = makeProxy(); proxies.push(proxy); return proxy; } },
        OkhttpUtils: { get: (url,headers) => ({ url,headers }) },
        ArrayList: List, HashMap: Map, URI: { create: URI },
        URLDecoder: { decode: value => decodeURIComponent(value.replace(/\+/g, ' ')) },
        ParserException, Pair: function(first,second) { this.first=first; this.second=second; },
        MainTab: Object.assign(function(label,type) { this.label=label;this.type=type; }, { MAIN_TAB_GROUP:0 }),
        SubTab: function(label,isCover,ext) { Object.assign(this,{ label,isCover,ext }); },
        SourcePreference: { Edit: function(label,key,value) { Object.assign(this,{ label,key,value }); } },
        Episode: function(id,label,order) { Object.assign(this,{ id,label,order }); },
        PlayLine: function(id,label,episode) { Object.assign(this,{ id,label,episode }); },
        PlayerInfo: Object.assign(function(type,url) { Object.assign(this,{ type,url }); }, { DECODE_TYPE_HLS:1, DECODE_TYPE_OTHER:0 }),
        Cartoon: { STATUS_COMPLETED:2, STATUS_ONGOING:1, STATUS_UNKNOWN:0, UPDATE_STRATEGY_ALWAYS:0 },
        makeCartoonCover: value => value, makeCartoon: value => value,
        SourceUtils: { urlParser: (base,value) => new URL(value,base).href }, source:{ key:'kazumi.ciyuancheng' }
    };
    function makeProxy() {
        return { loaded:[], captured:[], scripts:[], state:{matched:true,media:''}, response:null, states:null,
            loadUrl(...args) { this.loaded.push(args); }, waitingForPageLoaded() { return true; },
            needUserCheck(message) { throw new UserCheck(message,this); },
            executeJavaScript(script) { this.script=script;this.scripts.push(script);return JSON.stringify(this.states && this.states.length ? this.states.shift() : this.state); }, delay() {},
             };
    }
    vm.createContext(context); vm.runInContext(originalSource,context,{filename:adapter});
    return { c:context, requests, routes, proxies, makeProxy, get closed() {return closed;},
        mock(api,json,status) { routes[context.cycUrl('api'+api)]={json,status}; },
        mockRaw(api,text,status) { routes[context.cycUrl('api'+api)]={text,status}; } };
}
let passed=0;
function test(name,fn) { fn();passed++; console.log('ok ' + passed + ' - ' + name); }
const q = (title,page=1) => '/videos/search?q='+encodeURIComponent(title)+'&page='+page+'&page_size=24';
const sectionPath = (id,code='cychub',page=1) => '/videos/'+id+'/sections?player_code='+encodeURIComponent(code)+'&page='+page+'&page_size=100';
const modernSummary = id => ({id:'cyc-v2:'+id,source:'kazumi.ciyuancheng',title:'fallback'});
const legacyId = (url,title) => [url,title,''].map(encodeURIComponent).join('|');
const envelope = data => ({code:0,msg:'',data});
function detailedHarness(id=3870) { const h=harness();h.mock('/videos/'+id,data['detail-'+id]);h.mock(sectionPath(id),data['sections-'+id+'-0']);return h; }
test('metadata keeps source key and increments adapter version',()=>{
    assert.match(originalSource,/\/\/ @key kazumi\.ciyuancheng/);assert.match(originalSource,/\/\/ @versionName 2\.1/);assert.match(originalSource,/\/\/ @versionCode 20100/);
});
test('Host normalizes blanks, scheme, query, hash, slash, port and path',()=>{
    const c=harness().c;
    for (const [input,expected] of [['','https://www.cycani.org'],['  mirror.example///?q=1#x  ','https://mirror.example'],['http://localhost:8080/base///?q=1','http://localhost:8080/base'],['mirror.example:8443','https://mirror.example:8443'],['//mirror.example/','https://mirror.example']]) assert.equal(c.normalizeRootUrl(input),expected);
});
test('Host rejects other schemes, credentials and malformed hosts',()=>{
    const c=harness().c;for(const input of ['ftp://example.org','javascript:alert(1)','https://bad host','https://user:pass@example.org','https://example.org:99999']) assert.throws(()=>c.normalizeRootUrl(input),/Host/);
});
test('main tabs and preference require no network',()=>{
    const h=harness(),tabs=h.c.PageComponent_getMainTabs(),prefs=h.c.PreferenceComponent_getPreference();assert.equal(tabs.length,3);assert.equal(h.requests.length,0);assert.equal(prefs[0].key,'Host');
});
test('real home groups preserve order and first item 3870',()=>{
    const h=harness();h.mock('/index/recommend',data.recommend);const tab=h.c.PageComponent_getMainTabs()[0],groups=h.c.PageComponent_getSubTabs(tab),home=h.c.PageComponent_getContent(tab,groups[0],0);assert.equal(groups[0].label,'TV番组');assert.equal(home.second[0].id,'cyc-v2:3870');assert.equal(home.second[0].title,'天是红河岸');assert.equal(home.first,null);assert.equal(h.c.PageComponent_getContent(tab,groups[0],1).second.length,0);
});
test('all station URLs and API headers follow custom Host; CDN stays unchanged',()=>{
    const h=harness('  mirror.example:8443/base///?ignore=1#x');h.mock(q('孤独摇滚'),data.search);const result=h.c.SearchComponent_search(0,'孤独摇滚');assert.equal(result.second[0].url,'https://mirror.example:8443/base/anime/3488');assert.equal(result.second[0].cover,data.search.data.list[0].cover_url);assert.equal(h.requests[0].headers.values.Referer,'https://mirror.example:8443/base/');assert.equal(h.requests[0].headers.values['X-App-Name'],'cyc_web');assert.equal(h.requests[0].headers.values['X-App-Version'],'cycweb');assert.equal(h.requests[0].headers.values['X-Time-Zone'],'Asia/Shanghai');assert.equal(h.c.cycAbsolute('https://www.cycani.org/pic.jpg?q=1'),'https://mirror.example:8443/base/pic.jpg?q=1');assert.equal(h.c.cycAbsolute(''),'');
});
test('real category list uses site zone order and zero-based page contract',()=>{
    const h=harness();h.mock('/video-zones',data.zones);const tab=h.c.PageComponent_getMainTabs()[1],zones=h.c.PageComponent_getSubTabs(tab);assert.equal(zones[0].ext,'zone:1');assert.equal(zones[1].ext,'zone:2');h.mock('/videos?page=1&page_size=24&zone_id=1&order_by=update_time',data['category-1']);const result=h.c.PageComponent_getContent(tab,zones[0],0);assert.equal(result.second[0].id,'cyc-v2:'+data['category-1'].data.list[0].video_id);assert.equal(result.first,1);
});
test('real weekday item mapping',()=>{
    const h=harness();h.mock('/index/weekday?weekday=1',data.weekday);const tab=h.c.PageComponent_getMainTabs()[2],days=h.c.PageComponent_getSubTabs(tab);assert.equal(days.length,7);const result=h.c.PageComponent_getContent(tab,days[0],0);assert.equal(result.second[0].id,'cyc-v2:'+data.weekday.data.list.find(d=>d.weekday===1).videos[0].video_id);
});
test('real search preserves first movie then TV instead of choosing TV',()=>{
    const h=harness();h.mock(q('孤独摇滚'),data.search);const result=h.c.SearchComponent_search(0,'孤独摇滚');assert.equal(result.first,null);assert.deepEqual(Array.from(result.second,item=>item.id),['cyc-v2:3488','cyc-v2:2109']);assert.equal(h.closed,1);
});
test('search follows next page and terminates by pager total',()=>{
    const h=harness();h.mock(q('分页'),envelope({list:data.search.data.list,pager:{page:1,page_size:2,total:3}}));h.mock(q('分页',2),envelope({list:[data.search.data.list[1]],pager:{page:2,page_size:2,total:3}}));assert.equal(h.c.SearchComponent_search(0,'分页').first,1);assert.equal(h.c.SearchComponent_search(1,'分页').first,null);assert.equal(h.requests.length,2);
});
test('real first home detail returns all 15 correctly labelled episodes',()=>{
    const h=detailedHarness(),result=h.c.DetailedComponent_getDetailed(modernSummary(3870));assert.equal(result.first.title,'天是红河岸');assert.equal(result.second[0].label,'CYC_Main');assert.equal(result.second[0].episode.length,15);assert.equal(result.second[0].episode[0].id,'cyc-v2:3870:cychub:51496:1');assert.equal(result.second[0].episode[14].id,'cyc-v2:3870:cychub:52527:15');
});
test('real first search movie detail returns its two parts, not TV episodes',()=>{
    const h=detailedHarness(3488),result=h.c.DetailedComponent_getDetailed(modernSummary(3488));assert.equal(result.second[0].episode.length,2);assert.equal(result.second[0].episode[0].label,'Re:(前篇)');
});
test('real small-page captures aggregate every episode across eight pages',()=>{
    const h=harness();h.c.CYC_SECTION_PAGE_SIZE=2;const all=data['sections-3870-0'].data.list;
    for(let page=1;page<=8;page++)h.mock('/videos/3870/sections?player_code=cychub&page='+page+'&page_size=2',page<=2?data['sections-3870-size2-page'+page]:envelope({list:all.slice((page-1)*2,page*2),pager:{page,page_size:2,total:15}}));
    const result=h.c.cycSections(3870,'cychub');assert.equal(h.requests.length,8);assert.equal(result.length,15);assert.equal(result[2].id,51498);assert.deepEqual(Array.from(result,item=>item.id),all.map(item=>item.id));
});
test('multi-page sections use pager size and stable episode order',()=>{
    const h=harness();h.mock(sectionPath(7,'z',1),envelope({list:[{id:13,title:'三',order:3},{id:11,title:'一',order:1}],pager:{page:1,page_size:2,total:4}}));h.mock(sectionPath(7,'z',2),envelope({list:[{id:12,title:'二甲',order:2},{id:14,title:'二乙',order:2}],pager:{page:2,page_size:2,total:4}}));const result=h.c.cycSections(7,'z');assert.deepEqual(Array.from(result,item=>item.id),[11,12,14,13]);assert.equal(h.requests.length,2);
});
test('missing episode orders use global page offsets',()=>{
    const h=harness();h.mock(sectionPath(7,'z',1),envelope({list:[{id:1},{id:2}],pager:{page:1,page_size:2,total:3}}));h.mock(sectionPath(7,'z',2),envelope({list:[{id:3}],pager:{page:2,page_size:2,total:3}}));assert.deepEqual(Array.from(h.c.cycSections(7,'z'),item=>item.order),[1,2,3]);
});
test('pagination rejects repeated page and duplicate sections',()=>{
    const h=harness();h.mock(sectionPath(7,'z',1),envelope({list:[{id:1}],pager:{page:1,page_size:1,total:2}}));h.mock(sectionPath(7,'z',2),envelope({list:[{id:1}],pager:{page:2,page_size:1,total:2}}));assert.throws(()=>h.c.cycSections(7,'z'),/分页重复/);assert.throws(()=>h.c.cycPager({list:[{}],pager:{page:1,page_size:2,total:4}},2,2),/不一致/);
});
test('empty lines are omitted and available lines keep API order',()=>{
    const h=harness();h.mock('/videos/7',envelope({id:7,title:'线路',play_from:[{code:'b',title:'先返回'},{code:'empty',title:'空线路'},{code:'a',title:'后返回'},{code:''}]}));for(const code of ['b','a'])h.mock(sectionPath(7,code),envelope({list:[{id:1,title:code}],pager:{page:1,page_size:100,total:1}}));h.mock(sectionPath(7,'empty'),envelope({list:[],pager:{page:1,page_size:100,total:0}}));const result=h.c.DetailedComponent_getDetailed(modernSummary(7));assert.deepEqual(Array.from(result.second,line=>line.label),['先返回','后返回']);assert.equal(result.second[0].episode[0].order,0);
});
test('missing play_from gives empty lines without crashing',()=>{
    const h=harness();h.mock('/videos/7',envelope({id:7,title:'暂未更新'}));assert.equal(h.c.DetailedComponent_getDetailed(modernSummary(7)).second.length,0);
});
test('legacy new /anime/:id URL migrates without ID guessing or search',()=>{
    const h=detailedHarness(2109),id=legacyId('https://old-host.example/anime/2109','旧标题');const result=h.c.DetailedComponent_getDetailed({id,title:'旧标题'});assert.equal(result.first.id,id);assert.equal(result.first.title,'孤独摇滚！');assert.equal(h.requests.length,2);
});
test('legacy MacCMS numeric ID resolves by a unique exact old title',()=>{
    const h=detailedHarness(2109);h.mock(q('孤独摇滚！'),data.search);const id=legacyId('https://www.cycani.org/voddetail/3488.html','孤独摇滚！');const result=h.c.DetailedComponent_getDetailed({id,title:'孤独摇滚！'});assert.equal(result.first.url,'https://www.cycani.org/anime/2109');assert.equal(result.second[0].episode.length,12);assert.ok(!h.requests.some(r=>r.url.endsWith('/videos/3488')));
});
test('legacy title migration checks all pages before accepting uniqueness',()=>{
    const h=harness();const item={video_id:1,title:'完全同名'};h.mock(q('完全同名'),envelope({list:[item],pager:{page:1,page_size:1,total:2}}));h.mock(q('完全同名',2),envelope({list:[{video_id:2,title:'完全同名'}],pager:{page:2,page_size:1,total:2}}));assert.throws(()=>h.c.cycRemoteId({id:legacyId('/voddetail/1.html','完全同名')}),/唯一同名/);assert.equal(h.requests.length,2);
});
test('legacy fuzzy-only result and bare old numeric ID cannot map directly',()=>{
    const h=harness();h.mock(q('孤独摇滚'),data.search);assert.throws(()=>h.c.cycRemoteId({id:legacyId('/voddetail/2109.html','孤独摇滚')}),/重新搜索/);assert.throws(()=>h.c.cycRemoteId({id:'2109'}),/重新搜索/);assert.ok(!h.requests.some(r=>r.url.endsWith('/videos/2109')));
});
test('malformed modern ID cannot be treated as a legacy title',()=>{
    const h=harness();assert.throws(()=>h.c.cycRemoteId({id:'cyc-v2:bad',title:'孤独摇滚！'}),/ID 无效/);assert.equal(h.requests.length,0);
});
test('legacy episode IDs require refreshing detail',()=>{
    const h=harness();assert.throws(()=>h.c.cycPlayContext(modernSummary(3870),{id:'1'},{id:legacyId('/vodplay/3870-1-1.html','')}),/刷新详情/);
});
test('public unauthenticated play opens exact normal route and preserves proxy',()=>{
    const h=detailedHarness(),detail=h.c.DetailedComponent_getDetailed(modernSummary(3870)),line=detail.second[0],ep=line.episode[0];h.mock('/v2/sections/51496/play-url',data['play-unauthenticated'],401);let failure;try{h.c.PlayComponent_getPlayInfo(modernSummary(3870),line,ep);}catch(e){failure=e;}assert.ok(failure instanceof UserCheck);assert.match(failure.message,/登录后观看/);assert.equal(h.proxies[0].loaded[0][0],'https://www.cycani.org/anime/3870/play/1?from=cychub');assert.equal(failure.proxy,h.proxies[0]);assert.equal(h.proxies[0].loaded[0][4],false);assert.equal(h.closed,3);
});
test('API body auth code triggers user check even with HTTP 200',()=>{
    const h=harness();h.mock('/v2/sections/51496/play-url',data['play-unauthenticated']);assert.throws(()=>h.c.PlayComponent_getPlayInfo(modernSummary(3870),{id:'cyc-v2:cychub'},{id:'cyc-v2:3870:cychub:51496:1'}),UserCheck);
});
test('public issued media preserves CDN URL and uses no referrer',()=>{
    const h=harness();h.mock('/v2/sections/51496/play-url',envelope({name:'CYC_Main',url:'https://cdn.example/media.m3u8?sig=a'}));const result=h.c.PlayComponent_getPlayInfo(modernSummary(3870),{id:'cyc-v2:cychub'},{id:'cyc-v2:3870:cychub:51496:1'});assert.equal(result.url,'https://cdn.example/media.m3u8?sig=a');assert.equal(result.type,1);assert.equal(result.header.values.Referer,undefined);
});
test('play rejects title or line mismatch before requesting media',()=>{
    const h=harness();assert.throws(()=>h.c.cycPlayContext(modernSummary(3870),{id:'cyc-v2:other'},{id:'cyc-v2:3870:cychub:51496:1'}),/不匹配/);assert.throws(()=>h.c.cycPlayContext(modernSummary(3488),{id:'cyc-v2:cychub'},{id:'cyc-v2:3870:cychub:51496:1'}),/不匹配/);assert.equal(h.requests.length,0);
});
test('check callback reuses proxy and reads only exact-route video',()=>{
    const h=harness(),proxy=h.makeProxy();proxy.state={matched:true,media:'https://cdn.example/v.mp4'};const result=h.c.PlayComponent_getPlayInfoWithCheck(modernSummary(3870),{id:'cyc-v2:cychub'},{id:'cyc-v2:3870:cychub:51496:1'},proxy);assert.equal(result.url,'https://cdn.example/v.mp4');assert.equal(h.proxies.length,0);assert.equal(proxy.loaded.length,0);assert.match(proxy.script,/location.origin\+location.pathname/);assert.match(proxy.script,/q.get\('from'\)/);assert.doesNotMatch(proxy.script,/localStorage|sessionStorage|cookie|Authorization/);
});
test('blob media reads same video Artplayer instance, without network or token access',()=>{
    const h=harness(),proxy=h.makeProxy();proxy.states=[{matched:true,pending:true},{matched:true,media:'https://cdn.example/loaded-player.m3u8'}];const result=h.c.PlayComponent_getPlayInfoWithCheck(modernSummary(3870),{id:'cyc-v2:cychub'},{id:'cyc-v2:3870:cychub:51496:1'},proxy);assert.equal(result.type,1);assert.equal(h.requests.length,0);assert.equal(proxy.loaded.length,0);new vm.Script(proxy.scripts[0]);new vm.Script(proxy.scripts[1]);assert.match(proxy.scripts[0],/m.default.instances/);assert.match(proxy.scripts[0],/a.video===v/);assert.match(proxy.scripts[0],/a.option.url/);assert.match(proxy.scripts[1],/s.video===v/);assert.doesNotMatch(originalSource,/waitingForBlobText|localStorage|sessionStorage|Authorization|file_url/);
});
test('wrong route or no authenticated result asks user to continue on same proxy',()=>{
    const h=harness(),proxy=h.makeProxy();proxy.state={matched:false};const play=()=>h.c.PlayComponent_getPlayInfoWithCheck(modernSummary(3870),{id:'cyc-v2:cychub'},{id:'cyc-v2:3870:cychub:51496:1'},proxy);assert.throws(play,UserCheck);assert.equal(proxy.captured.length,0);proxy.state={matched:true,media:''};proxy.response={second:JSON.stringify(data['play-unauthenticated'])};assert.throws(play,/确认已登录/);assert.equal(h.proxies.length,0);assert.equal(proxy.loaded.length,0);
});
test('invalid API payload and HTTP errors close responses with clear error',()=>{
    const h=harness();h.mockRaw('/bad','<html>challenge</html>',200);assert.throws(()=>h.c.cycApi('/bad'),/格式无效/);h.mock('/bad',envelope(null),500);assert.throws(()=>h.c.cycApi('/bad'),/HTTP 500/);assert.equal(h.closed,2);
});
for (const item of fixture('invalid-response-cases.json').cases) test('search rejects malformed HTTP 200: '+item.name,()=>{
    const h=harness();h.mockRaw(q('malformed'),item.raw,200);assert.throws(()=>h.c.SearchComponent_search(0,'malformed'),ParserException);assert.equal(h.closed,1);
});
test('search rejects a null HTTP body and closes the response',()=>{
    const h=harness();h.routes[h.c.cycUrl('api'+q('null-body'))]={nullBody:true};assert.throws(()=>h.c.SearchComponent_search(0,'null-body'),/格式无效/);assert.equal(h.closed,1);
});
test('search accepts a genuine empty list with a valid zero-total pager',()=>{
    const h=harness();h.mock(q('empty'),envelope({list:[],pager:{page:1,page_size:24,total:0}}));const result=h.c.SearchComponent_search(0,'empty');assert.equal(result.first,null);assert.equal(result.second.length,0);assert.equal(h.closed,1);
});
test('home and categories reject missing lists instead of succeeding empty',()=>{
    const h=harness();h.mock('/index/recommend',envelope({}));h.mock('/video-zones',envelope({}));const tabs=h.c.PageComponent_getMainTabs();assert.throws(()=>h.c.PageComponent_getSubTabs(tabs[0]),/格式无效/);assert.throws(()=>h.c.PageComponent_getSubTabs(tabs[1]),/格式无效/);assert.equal(h.closed,2);
});
test('home rejects malformed groups and video lists',()=>{
    for(const groups of [[{}],[{id:1,name:'group'}],[{id:1,name:'group',videos:{}}],[{id:1,name:'group',videos:[{}]}]]){const h=harness();h.mock('/index/recommend',envelope({list:groups}));assert.throws(()=>h.c.PageComponent_getSubTabs(h.c.PageComponent_getMainTabs()[0]),/格式无效/);assert.equal(h.closed,1);}
});
test('home accepts an explicitly empty recommendation group or group list',()=>{
    const h=harness(),tab=h.c.PageComponent_getMainTabs()[0];h.mock('/index/recommend',envelope({list:[{id:1,name:'empty',videos:[]}]}));const groups=h.c.PageComponent_getSubTabs(tab);assert.equal(groups.length,1);assert.equal(h.c.PageComponent_getContent(tab,groups[0],0).second.length,0);h.mock('/index/recommend',envelope({list:[]}));assert.equal(h.c.PageComponent_getSubTabs(tab).length,0);
});
test('removed home group asks for a refresh instead of returning empty content',()=>{
    const h=harness();h.mock('/index/recommend',envelope({list:[]}));assert.throws(()=>h.c.PageComponent_getContent(h.c.PageComponent_getMainTabs()[0],{ext:'recommend:17'},0),/分组已变化/);
});
test('weekday rejects malformed lists but accepts an explicitly empty schedule',()=>{
    const h=harness(),tab=h.c.PageComponent_getMainTabs()[2],day=h.c.PageComponent_getSubTabs(tab)[0];for(const invalid of [{},{list:[{weekday:1}]},{list:[{weekday:9,videos:[]}]}]){h.mock('/index/weekday?weekday=1',envelope(invalid));assert.throws(()=>h.c.PageComponent_getContent(tab,day,0),/格式无效/);}h.mock('/index/weekday?weekday=1',envelope({list:[{weekday:1,videos:[]}]}));assert.equal(h.c.PageComponent_getContent(tab,day,0).second.length,0);
});
test('detail rejects invalid data, missing titles and invalid line arrays',()=>{
    for(const detail of [{},{id:7},{id:7,title:'valid',play_from:{}},{id:7,title:'valid',play_from:'invalid'},{id:7,title:'valid',play_from:[42]}]){const h=harness();h.mock('/videos/7',envelope(detail));assert.throws(()=>h.c.DetailedComponent_getDetailed(modernSummary(7)),ParserException);assert.equal(h.closed,1);}
});
test('detail accepts no available lines represented by null or empty arrays',()=>{
    for(const lines of [null,[]]){const h=harness();h.mock('/videos/7',envelope({id:7,title:'not-yet-available',play_from:lines}));assert.equal(h.c.DetailedComponent_getDetailed(modernSummary(7)).second.length,0);}
});
test('sections reject malformed lists, pagers and records instead of empty lines',()=>{
    for(const sections of [{},{list:null},{list:[]},{list:[],pager:{}},{list:[{}],pager:{page:1,page_size:100,total:1}},{list:[],pager:{page:1,page_size:100,total:1}}]){const h=harness();h.mock(sectionPath(7,'z'),envelope(sections));assert.throws(()=>h.c.cycSections(7,'z'),ParserException);assert.equal(h.closed,1);}
});
test('sections accept a genuine empty paged line and complete array contract',()=>{
    const h=harness();h.mock(sectionPath(7,'z'),envelope({list:[],pager:{page:1,page_size:100,total:0}}));assert.equal(h.c.cycSections(7,'z').length,0);const complete=Array.from({length:101},(_,i)=>({id:i+1,title:'episode '+(i+1)}));h.mock(sectionPath(7,'z'),envelope(complete));const result=h.c.cycSections(7,'z');assert.equal(result.length,101);assert.equal(h.requests.length,2);assert.equal(result[100].order,101);
});
test('legacy migration rejects an invalid later page before accepting uniqueness',()=>{
    const h=harness();h.mock(q('exact'),envelope({list:[{video_id:7,title:'exact'}],pager:{page:1,page_size:1,total:2}}));h.mock(q('exact',2),envelope({}));assert.throws(()=>h.c.cycRemoteId({id:legacyId('/voddetail/7.html','exact')}),/格式无效/);assert.equal(h.requests.length,2);
});
test('native summary boundary never reads an unsupported title property',()=>{
    function nativeLike(id){return {id,source:'kazumi.ciyuancheng',get title(){throw new Error('CartoonSummary has no title property');}};}
    const empty=harness();assert.throws(()=>empty.c.cycRemoteId(nativeLike(legacyId('/voddetail/2109.html',''))),/重新搜索/);assert.equal(empty.requests.length,0);
    const legacy=detailedHarness(2109);legacy.mock(q('孤独摇滚！'),data.search);assert.equal(legacy.c.DetailedComponent_getDetailed(nativeLike(legacyId('/voddetail/2109.html','孤独摇滚！'))).first.title,'孤独摇滚！');
    const modern=detailedHarness(2109);assert.equal(modern.c.DetailedComponent_getDetailed(nativeLike('cyc-v2:2109')).first.title,'孤独摇滚！');assert.doesNotMatch(originalSource,/summary\.title/);
});
console.log('\n' + passed + ' Cycani fixture tests passed');
