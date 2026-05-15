/**
 * A股潜力股观察系统 - 数据层
 * 通过 CORS 代理解决 HTTPS 混合内容问题
 */

const API = (() => {
    'use strict';

    // CORS 代理列表（按优先级排序）
    const PROXIES = [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?'
    ];
    let proxyIndex = 0;

    // 当前使用的数据源
    let currentDataSource = 'eastmoney';
    let currentProxy = '';

    /**
     * 带代理的 fetch 请求
     */
    async function proxyFetch(url) {
        // 先尝试直接请求（非HTTPS环境）
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
                const text = await res.text();
                currentProxy = '直连';
                return text;
            }
        } catch (e) {
            // 直接请求失败，使用代理
        }

        // 尝试各个代理
        for (let i = 0; i < PROXIES.length; i++) {
            const idx = (proxyIndex + i) % PROXIES.length;
            try {
                const proxyUrl = PROXIES[idx] + encodeURIComponent(url);
                const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
                if (res.ok) {
                    const text = await res.text();
                    currentProxy = PROXIES[idx].split('//')[1].split('/')[0];
                    proxyIndex = idx + 1;
                    return text;
                }
            } catch (e) {
                continue;
            }
        }
        throw new Error('所有代理都失败');
    }

    /**
     * JSONP 请求（通过代理）
     */
    async function jsonpFetch(url, cbParam = 'cb') {
        const separator = url.includes('?') ? '&' : '?';
        const fullUrl = url + separator + cbParam + '=callback';
        
        const text = await proxyFetch(fullUrl);
        
        // 提取 JSON 数据
        // 格式可能是: callback({...}) 或 callback({...});
        const jsonMatch = text.match(/callback\s*\(\s*({[\s\S]*})\s*\)/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1]);
        }
        
        // 尝试直接解析 JSON
        try {
            return JSON.parse(text);
        } catch (e) {
            throw new Error('JSONP 响应解析失败');
        }
    }

    /**
     * 带重试的请求
     */
    async function fetchWithRetry(fetchFn, maxRetries = 2) {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
            try {
                const result = await fetchFn();
                if (result && (result.stocks?.length > 0 || result.length > 0 || result.data)) {
                    return result;
                }
            } catch (e) {
                lastError = e;
                console.warn(`请求失败，重试 ${i + 1}/${maxRetries}:`, e.message);
                await new Promise(r => setTimeout(r, 500 * (i + 1)));
            }
        }
        throw lastError || new Error('所有重试都失败');
    }

    function getCurrentDataSource() {
        return currentDataSource === 'eastmoney' ? '东方财富' : 
               currentDataSource === 'sina' ? '新浪财经' : 
               currentDataSource === 'netease' ? '网易财经' : '未知';
    }

    function getCurrentProxy() {
        return currentProxy || '直连';
    }

    // ==================== 东方财富 API ====================

    async function fetchStockListEastmoney(page = 1, pageSize = 30, sortField = 'f3', sortOrder = 0, market = 'all') {
        let fs = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23';
        if (market === 'sh') fs = 'm:1+t:2,m:1+t:23';
        else if (market === 'sz') fs = 'm:0+t:6,m:0+t:80';

        const fields = 'f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18,f20,f21,f23,f62,f115,f162,f164,f167,f168,f169,f170';
        const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=${page}&pz=${pageSize}&po=1&np=1&fltt=2&invt=2&fid=${sortField}&fs=${encodeURIComponent(fs)}&fields=${fields}&cb=callback`;

        const data = await jsonpFetch(url);
        if (data?.data?.diff) {
            return {
                total: data.data.total || 0,
                stocks: data.data.diff.map(parseStockItem),
                source: 'eastmoney'
            };
        }
        throw new Error('东方财富数据格式错误');
    }

    // ==================== 网易 API ====================

    async function fetchStockListNetease(page = 1, pageSize = 30) {
        const url = `https://quotes.money.163.com/hs/service/diyrank.php?page=${page - 1}&query=STYPE:EQA&fields=SYMBOL,NAME,PRICE,UPDOWN,PERCENT,VOLUME,TURNOVER,PE,PB,MCAP&sort=PERCENT&order=desc&count=${pageSize}&callback=callback`;

        const data = await jsonpFetch(url, 'callback');
        if (data?.list) {
            return {
                total: data.total || data.list.length,
                stocks: data.list.map(item => ({
                    code: item.SYMBOL,
                    name: item.NAME,
                    price: item.PRICE,
                    changePercent: item.PERCENT,
                    changeAmount: item.UPDOWN,
                    volume: item.VOLUME,
                    turnover: item.TURNOVER,
                    pe: item.PE || null,
                    pb: item.PB || null,
                    totalMarketCap: item.MCAP || 0,
                    secid: item.SYMBOL?.startsWith('6') ? '1.' + item.SYMBOL : '0.' + item.SYMBOL,
                    marketCode: item.SYMBOL?.startsWith('6') ? '1' : '0',
                    source: 'netease'
                })),
                source: 'netease'
            };
        }
        throw new Error('网易数据格式错误');
    }

    // ==================== 统一接口 ====================

    async function fetchStockList(page = 1, pageSize = 30, sortField = 'f3', sortOrder = 0, market = 'all') {
        const sources = [
            { name: 'eastmoney', fn: () => fetchStockListEastmoney(page, pageSize, sortField, sortOrder, market) },
            { name: 'netease', fn: () => fetchStockListNetease(page, pageSize) }
        ];

        for (const source of sources) {
            try {
                const result = await fetchWithRetry(source.fn, 2);
                if (result?.stocks?.length > 0) {
                    currentDataSource = source.name;
                    console.log(`✅ 数据源: ${source.name}, ${result.stocks.length} 条数据, 代理: ${currentProxy}`);
                    return result;
                }
            } catch (e) {
                console.warn(`❌ ${source.name} 失败:`, e.message);
            }
        }

        console.error('所有数据源都失败');
        return { total: 0, stocks: [], source: 'none' };
    }

    /**
     * 解析股票数据
     */
    function parseStockItem(item) {
        const needDivide = item.f2 > 10000;
        const divisor = needDivide ? 100 : 1;

        return {
            code: item.f12 || '',
            name: item.f14 || '',
            price: item.f2 != null ? item.f2 / divisor : null,
            changePercent: item.f3 != null ? item.f3 / 100 : null,
            changeAmount: item.f4 != null ? item.f4 / divisor : null,
            volume: item.f5 || 0,
            turnover: item.f6 || 0,
            amplitude: item.f7 != null ? item.f7 / 100 : null,
            turnoverRate: item.f8 != null ? item.f8 / 100 : null,
            pe: item.f162 != null ? item.f162 / 100 : null,
            pb: item.f164 != null ? item.f164 / 100 : null,
            totalMarketCap: item.f20 || 0,
            circulatingMarketCap: item.f21 || 0,
            high: item.f15 != null ? item.f15 / divisor : null,
            low: item.f16 != null ? item.f16 / divisor : null,
            open: item.f17 != null ? item.f17 / divisor : null,
            prevClose: item.f18 != null ? item.f18 / divisor : null,
            volumeRatio: item.f10 || 0,
            secid: (item.f13 === 1 || item.f13 === '1') ? '1.' + item.f12 : '0.' + item.f12,
            marketCode: item.f13 || '',
            roe: item.f190 != null ? item.f190 / 100 : null,
            eps: item.f183 != null ? item.f183 / 100 : null,
            revenueGrowth: item.f184 != null ? item.f184 / 100 : null,
            profitGrowth: item.f185 != null ? item.f185 / 100 : null,
            grossMargin: item.f186 != null ? item.f186 / 100 : null,
            netMargin: item.f187 != null ? item.f187 / 100 : null,
            mainForceNetInflow: item.f62 || 0,
            _raw: item,
            source: 'eastmoney'
        };
    }

    /**
     * 获取单只股票详情
     */
    async function fetchStockDetail(secid) {
        const fields = 'f43,f44,f45,f46,f47,f48,f57,f58,f60,f116,f117,f162,f164,f167,f168,f169,f170,f183,f184,f185,f186,f187,f190,f192';
        const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=${fields}&fltt=2&invt=2&cb=callback`;

        try {
            const data = await jsonpFetch(url);
            if (data?.data) {
                const d = data.data;
                return {
                    code: d.f57 || '', name: d.f58 || '', secid,
                    price: d.f43 != null ? d.f43 / 100 : null,
                    changePercent: d.f170 != null ? d.f170 / 100 : null,
                    changeAmount: d.f169 != null ? d.f169 / 100 : null,
                    volume: d.f47 || 0, turnover: d.f48 || 0,
                    high: d.f44 != null ? d.f44 / 100 : null,
                    low: d.f45 != null ? d.f45 / 100 : null,
                    open: d.f46 != null ? d.f46 / 100 : null,
                    prevClose: d.f60 != null ? d.f60 / 100 : null,
                    turnoverRate: d.f168 != null ? d.f168 / 100 : null,
                    pe: d.f162 != null ? d.f162 / 100 : null,
                    pb: d.f164 != null ? d.f164 / 100 : null,
                    totalMarketCap: d.f116 || 0,
                    circulatingMarketCap: d.f117 || 0,
                    eps: d.f183 != null ? d.f183 / 100 : null,
                    revenueGrowth: d.f184 != null ? d.f184 / 100 : null,
                    profitGrowth: d.f185 != null ? d.f185 / 100 : null,
                    grossMargin: d.f186 != null ? d.f186 / 100 : null,
                    netMargin: d.f187 != null ? d.f187 / 100 : null,
                    roe: d.f190 != null ? d.f190 / 100 : null,
                    _raw: d
                };
            }
        } catch (e) {
            console.error('获取股票详情失败:', e);
        }
        return null;
    }

    /**
     * 获取K线数据
     */
    async function fetchKline(secid, period = '101', limit = 120) {
        const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=${period}&fqt=1&beg=0&end=20500101&lmt=${limit}&cb=callback`;

        try {
            const data = await jsonpFetch(url);
            if (data?.data?.klines) {
                return data.data.klines.map(line => {
                    const p = line.split(',');
                    return {
                        date: p[0], open: +p[1], close: +p[2], high: +p[3], low: +p[4],
                        volume: +p[5], turnover: +p[6], amplitude: +p[7] || 0,
                        changePercent: +p[8] || 0, changeAmount: +p[9] || 0, turnoverRate: +p[10] || 0
                    };
                });
            }
        } catch (e) {
            console.error('获取K线失败:', e);
        }
        return [];
    }

    /**
     * 获取资金流向
     */
    async function fetchFundFlow(secid) {
        const url = `https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?secid=${secid}&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63&lmt=30&klt=101&fqt=1&cb=callback`;

        try {
            const data = await jsonpFetch(url);
            if (data?.data?.klines) {
                return {
                    flowData: data.data.klines.map(line => {
                        const p = line.split(',');
                        return {
                            date: p[0], mainForceNet: +p[3] || 0, superLargeNet: +p[6] || 0,
                            largeNet: +p[9] || 0, mediumNet: +p[12] || 0, smallNet: +p[15] || 0
                        };
                    }),
                    latestMainForceNet: data.data.f62 || 0
                };
            }
        } catch (e) {
            console.error('获取资金流向失败:', e);
        }
        return { flowData: [], latestMainForceNet: 0 };
    }

    /**
     * 获取北向资金
     */
    async function fetchNorthFlow() {
        const url = `https://push2his.eastmoney.com/api/qt/kamt.kline/get?fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=1&beg=0&end=20500101&lmt=30&cb=callback`;

        try {
            const data = await jsonpFetch(url);
            if (data?.data?.klines) {
                const flowData = data.data.klines.map(line => {
                    const p = line.split(',');
                    return { date: p[0], shNet: +p[3] || 0, szNet: +p[6] || 0, totalNet: +p[7] || 0 };
                });
                const latest = flowData[flowData.length - 1];
                return { flowData, latest, shNet: latest?.shNet || 0, szNet: latest?.szNet || 0, totalNet: latest?.totalNet || 0 };
            }
        } catch (e) {
            console.error('获取北向资金失败:', e);
        }
        return { flowData: [], latest: null, shNet: 0, szNet: 0, totalNet: 0 };
    }

    /**
     * 搜索股票
     */
    async function searchStock(keyword) {
        if (!keyword?.trim()) return [];
        const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(keyword.trim())}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=10&cb=callback`;

        try {
            const data = await jsonpFetch(url);
            if (data?.QuotationCodeTable?.Data) {
                return data.QuotationCodeTable.Data
                    .filter(i => i.MktNum === '0' || i.MktNum === '1')
                    .map(i => ({
                        code: i.Code, name: i.Name,
                        secid: (i.MktNum === '1' ? '1' : '0') + '.' + i.Code,
                        market: i.MktNum === '1' ? 'SH' : 'SZ'
                    }));
            }
        } catch (e) {
            console.error('搜索失败:', e);
        }
        return [];
    }

    // ==================== 格式化工具 ====================

    function formatAmount(v) {
        if (!v) return '--';
        if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '亿';
        if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(2) + '万';
        return v.toFixed(2);
    }

    function formatMarketCap(v) {
        if (!v) return '--';
        return (v / 1e8).toFixed(2) + '亿';
    }

    function formatPercent(v, d = 2) {
        if (v == null) return '--';
        return (v > 0 ? '+' : '') + v.toFixed(d) + '%';
    }

    function formatPrice(v) {
        return v != null ? v.toFixed(2) : '--';
    }

    function getPriceClass(v) {
        if (v == null) return 'price-flat';
        if (v > 0) return 'price-up';
        if (v < 0) return 'price-down';
        return 'price-flat';
    }

    function getMarketStatus() {
        const now = new Date();
        const day = now.getDay();
        const t = now.getHours() * 60 + now.getMinutes();
        if (day === 0 || day === 6) return { status: 'closed', text: '休市' };
        if (t >= 570 && t <= 690) return { status: 'open', text: '交易中' };
        if (t >= 780 && t <= 900) return { status: 'open', text: '交易中' };
        if (t >= 555 && t < 570) return { status: 'open', text: '集合竞价' };
        if (t > 690 && t < 780) return { status: 'open', text: '午间休市' };
        return { status: 'closed', text: '已收盘' };
    }

    return {
        fetchStockList, fetchStockDetail, fetchKline, fetchFundFlow, fetchNorthFlow, searchStock,
        formatAmount, formatMarketCap, formatPercent, formatPrice, getPriceClass, getMarketStatus,
        getCurrentDataSource, getCurrentProxy
    };
})();
