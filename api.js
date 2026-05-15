/**
 * A股潜力股观察系统 - 数据层
 * 多数据源支持：东方财富、新浪、腾讯、网易
 */

const API = (() => {
    'use strict';

    // JSONP 请求计数器
    let jsonpCounter = 0;
    
    // 当前使用的数据源
    let currentDataSource = 'eastmoney';
    
    // 数据源配置
    const dataSources = {
        eastmoney: { name: '东方财富', priority: 1 },
        sina: { name: '新浪财经', priority: 2 },
        tencent: { name: '腾讯财经', priority: 3 },
        netease: { name: '网易财经', priority: 4 }
    };

    /**
     * JSONP 请求封装
     */
    function jsonpFetch(url, cbParam = 'cb', timeout = 10000) {
        return new Promise((resolve, reject) => {
            const callbackName = 'jsonp_cb_' + (++jsonpCounter) + '_' + Date.now();
            const timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error('JSONP 请求超时'));
            }, timeout);

            function cleanup() {
                clearTimeout(timeoutId);
                delete window[callbackName];
                const script = document.getElementById(callbackName);
                if (script) script.remove();
            }

            window[callbackName] = function(data) {
                cleanup();
                resolve(data);
            };

            const separator = url.includes('?') ? '&' : '?';
            const script = document.createElement('script');
            script.id = callbackName;
            script.src = url + separator + cbParam + '=' + callbackName;
            script.onerror = function() {
                cleanup();
                reject(new Error('JSONP 加载失败'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * 带重试的请求封装
     */
    async function fetchWithRetry(fetchFn, maxRetries = 3) {
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
                await sleep(500 * (i + 1));
            }
        }
        throw lastError || new Error('所有重试都失败');
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 获取当前数据源名称
     */
    function getCurrentDataSource() {
        return dataSources[currentDataSource]?.name || '未知';
    }

    /**
     * 切换数据源
     */
    function switchDataSource(source) {
        if (dataSources[source]) {
            currentDataSource = source;
            console.log(`切换到数据源: ${dataSources[source].name}`);
            return true;
        }
        return false;
    }

    // ==================== 东方财富 API ====================
    
    async function fetchStockListEastmoney(page = 1, pageSize = 30, sortField = 'f3', sortOrder = 0, market = 'all') {
        let fs = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23';
        if (market === 'sh') fs = 'm:1+t:2,m:1+t:23';
        else if (market === 'sz') fs = 'm:0+t:6,m:0+t:80';

        const fields = 'f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f26,f22,f11,f62,f115,f128,f136,f140,f141,f152,f162,f164,f167,f168,f169,f170,f171,f173,f183,f184,f185,f186,f187,f188,f189,f190,f191,f192';
        const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=${page}&pz=${pageSize}&po=1&np=1&fltt=2&invt=2&fid=${sortField}&fs=${encodeURIComponent(fs)}&fields=${fields}&_${Date.now()}`;

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

    // ==================== 新浪 API ====================
    
    async function fetchStockListSina(page = 1, pageSize = 30) {
        // 新浪使用不同的分页方式，这里获取沪深A股列表
        const url = `https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=sh000001&scale=240&ma=5&datalen=1&_${Date.now()}`;
        
        // 新浪的列表API需要特殊处理，使用其股票列表服务
        const listUrl = `https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?page=${page}&num=${pageSize}&node=hs_a&sort=changepercent&asc=0&_${Date.now()}`;
        
        try {
            const data = await jsonpFetch(listUrl, 'callback');
            if (Array.isArray(data)) {
                return {
                    total: data.length * 10, // 估算总数
                    stocks: data.map(item => ({
                        code: item.code,
                        name: item.name,
                        price: parseFloat(item.trade) || 0,
                        changePercent: parseFloat(item.changepercent) || 0,
                        changeAmount: parseFloat(item.pricechange) || 0,
                        volume: parseFloat(item.volume) || 0,
                        turnover: parseFloat(item.amount) || 0,
                        high: parseFloat(item.high) || 0,
                        low: parseFloat(item.low) || 0,
                        open: parseFloat(item.open) || 0,
                        prevClose: parseFloat(item.settlement) || 0,
                        pe: parseFloat(item.per) || null,
                        pb: parseFloat(item.pb) || null,
                        totalMarketCap: parseFloat(item.mktcap) * 10000 || 0, // 万转元
                        circulatingMarketCap: parseFloat(item.nmc) * 10000 || 0,
                        turnoverRate: parseFloat(item.turnoverratio) || 0,
                        secid: item.code.startsWith('6') ? '1.' + item.code : '0.' + item.code,
                        marketCode: item.code.startsWith('6') ? '1' : '0',
                        roe: null, // 新浪不提供
                        revenueGrowth: null,
                        source: 'sina'
                    })),
                    source: 'sina'
                };
            }
        } catch (e) {
            console.error('新浪API失败:', e);
        }
        throw new Error('新浪数据获取失败');
    }

    // ==================== 腾讯 API ====================
    
    async function fetchStockListTencent(codes) {
        // 腾讯支持批量查询，但一次最多60只
        if (!Array.isArray(codes)) {
            codes = ['000001', '000002', '600519', '000858', '002594', '300750'];
        }
        const codeStr = codes.map(c => c.startsWith('6') ? 'sh' + c : 'sz' + c).join(',');
        const url = `https://qt.gtimg.cn/q=${codeStr}`;
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => {
                const stocks = [];
                codes.forEach(code => {
                    const varName = 'v_' + (code.startsWith('6') ? 'sh' + code : 'sz' + code);
                    const data = window[varName];
                    if (data) {
                        const parts = data.split('~');
                        stocks.push({
                            code: code,
                            name: parts[1] || '',
                            price: parseFloat(parts[3]) || 0,
                            changePercent: parseFloat(parts[5]) || 0,
                            changeAmount: parseFloat(parts[4]) || 0,
                            volume: parseFloat(parts[6]) || 0,
                            turnover: parseFloat(parts[7]) || 0,
                            high: parseFloat(parts[33]) || 0,
                            low: parseFloat(parts[34]) || 0,
                            open: parseFloat(parts[5]) || 0,
                            prevClose: parseFloat(parts[4]) || 0,
                            pe: parseFloat(parts[39]) || null,
                            pb: parseFloat(parts[46]) || null,
                            totalMarketCap: parseFloat(parts[44]) * 10000 || 0,
                            circulatingMarketCap: parseFloat(parts[45]) * 10000 || 0,
                            turnoverRate: parseFloat(parts[38]) || 0,
                            secid: code.startsWith('6') ? '1.' + code : '0.' + code,
                            marketCode: code.startsWith('6') ? '1' : '0',
                            source: 'tencent'
                        });
                    }
                });
                resolve({ total: stocks.length, stocks, source: 'tencent' });
            };
            script.onerror = () => reject(new Error('腾讯API加载失败'));
            document.head.appendChild(script);
        });
    }

    // ==================== 网易 API ====================
    
    async function fetchStockListNetease(page = 1, pageSize = 30) {
        // 网易财经API
        const url = `https://quotes.money.163.com/hs/service/diyrank.php?page=${page - 1}&query=STYPE:EQA&fields=SYMBOL,NAME,PRICE,UPDOWN,PERCENT,VOLUME,TURNOVER,PE,PB,MCAP&sort=PERCENT&order=desc&count=${pageSize}&_=${Date.now()}`;
        
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
                    secid: item.SYMBOL.startsWith('6') ? '1.' + item.SYMBOL : '0.' + item.SYMBOL,
                    marketCode: item.SYMBOL.startsWith('6') ? '1' : '0',
                    source: 'netease'
                })),
                source: 'netease'
            };
        }
        throw new Error('网易数据格式错误');
    }

    // ==================== 统一接口 ====================

    async function fetchStockList(page = 1, pageSize = 30, sortField = 'f3', sortOrder = 0, market = 'all') {
        const errors = [];
        
        // 按优先级尝试各个数据源
        const sources = ['eastmoney', 'sina', 'netease'];
        
        for (const source of sources) {
            try {
                let result;
                switch (source) {
                    case 'eastmoney':
                        result = await fetchWithRetry(() => fetchStockListEastmoney(page, pageSize, sortField, sortOrder, market), 2);
                        break;
                    case 'sina':
                        result = await fetchWithRetry(() => fetchStockListSina(page, pageSize), 2);
                        break;
                    case 'netease':
                        result = await fetchWithRetry(() => fetchStockListNetease(page, pageSize), 2);
                        break;
                }
                
                if (result && result.stocks && result.stocks.length > 0) {
                    currentDataSource = source;
                    console.log(`使用数据源: ${dataSources[source].name}, 获取 ${result.stocks.length} 条数据`);
                    return result;
                }
            } catch (e) {
                errors.push(`${source}: ${e.message}`);
                console.warn(`${source} 失败:`, e.message);
            }
        }
        
        // 所有数据源都失败，返回空数据
        console.error('所有数据源都失败:', errors);
        return { total: 0, stocks: [], source: 'none', errors };
    }

    /**
     * 解析单条股票数据（东方财富格式）
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
            debtRatio: item.f188 != null ? item.f188 / 100 : null,
            currentRatio: item.f189 != null ? item.f189 / 100 : null,
            mainForceNetInflow: item.f62 || 0,
            superLargeNetInflow: item.f184 || 0,
            largeNetInflow: item.f62 || 0,
            _raw: item,
            source: 'eastmoney'
        };
    }

    /**
     * 获取单只股票详情
     */
    async function fetchStockDetail(secid) {
        const fields = 'f43,f44,f45,f46,f47,f48,f50,f51,f52,f55,f57,f58,f59,f60,f71,f84,f85,f92,f105,f116,f117,f162,f164,f167,f168,f169,f170,f171,f173,f183,f184,f185,f186,f187,f188,f189,f190,f191,f192,f292';
        const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=${fields}&fltt=2&invt=2&_${Date.now()}`;

        try {
            const data = await jsonpFetch(url);
            if (data?.data) {
                const d = data.data;
                return {
                    code: d.f57 || '',
                    name: d.f58 || '',
                    secid: secid,
                    price: d.f43 != null ? d.f43 / 100 : null,
                    changePercent: d.f170 != null ? d.f170 / 100 : null,
                    changeAmount: d.f169 != null ? d.f169 / 100 : null,
                    volume: d.f47 || 0,
                    turnover: d.f48 || 0,
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
                    debtRatio: d.f188 != null ? d.f188 / 100 : null,
                    roe: d.f190 != null ? d.f190 / 100 : null,
                    industry: d.f92 || '',
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
        const fields1 = 'f1,f2,f3,f4,f5,f6';
        const fields2 = 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61';
        const klt = period === '101' ? '101' : period === '102' ? '102' : '103';
        const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=${fields1}&fields2=${fields2}&klt=${klt}&fqt=1&beg=0&end=20500101&lmt=${limit}&_${Date.now()}`;

        try {
            const data = await jsonpFetch(url);
            if (data?.data?.klines) {
                return data.data.klines.map(line => {
                    const parts = line.split(',');
                    return {
                        date: parts[0],
                        open: parseFloat(parts[1]),
                        close: parseFloat(parts[2]),
                        high: parseFloat(parts[3]),
                        low: parseFloat(parts[4]),
                        volume: parseFloat(parts[5]),
                        turnover: parseFloat(parts[6]),
                        amplitude: parts[7] ? parseFloat(parts[7]) : 0,
                        changePercent: parts[8] ? parseFloat(parts[8]) : 0,
                        changeAmount: parts[9] ? parseFloat(parts[9]) : 0,
                        turnoverRate: parts[10] ? parseFloat(parts[10]) : 0
                    };
                });
            }
        } catch (e) {
            console.error('获取K线数据失败:', e);
        }
        return [];
    }

    /**
     * 获取资金流向数据
     */
    async function fetchFundFlow(secid) {
        const url = `https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?secid=${secid}&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65&lmt=30&klt=101&fqt=1&_${Date.now()}`;

        try {
            const data = await jsonpFetch(url);
            if (data?.data) {
                const klines = data.data.klines || [];
                return {
                    flowData: klines.map(line => {
                        const parts = line.split(',');
                        return {
                            date: parts[0],
                            mainForceInflow: parseFloat(parts[1]) || 0,
                            mainForceOutflow: parseFloat(parts[2]) || 0,
                            mainForceNet: parseFloat(parts[3]) || 0,
                            superLargeInflow: parseFloat(parts[4]) || 0,
                            superLargeOutflow: parseFloat(parts[5]) || 0,
                            superLargeNet: parseFloat(parts[6]) || 0,
                            largeInflow: parseFloat(parts[7]) || 0,
                            largeOutflow: parseFloat(parts[8]) || 0,
                            largeNet: parseFloat(parts[9]) || 0,
                            mediumInflow: parseFloat(parts[10]) || 0,
                            mediumOutflow: parseFloat(parts[11]) || 0,
                            mediumNet: parseFloat(parts[12]) || 0,
                            smallInflow: parseFloat(parts[13]) || 0,
                            smallOutflow: parseFloat(parts[14]) || 0,
                            smallNet: parseFloat(parts[15]) || 0
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
     * 获取北向资金流向
     */
    async function fetchNorthFlow() {
        const url = `https://push2his.eastmoney.com/api/qt/kamt.kline/get?fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65&klt=101&fqt=1&beg=0&end=20500101&lmt=30&_${Date.now()}`;

        try {
            const data = await jsonpFetch(url);
            if (data?.data?.klines) {
                const klines = data.data.klines;
                const flowData = klines.map(line => {
                    const parts = line.split(',');
                    return {
                        date: parts[0],
                        shInflow: parseFloat(parts[1]) || 0,
                        shOutflow: parseFloat(parts[2]) || 0,
                        shNet: parseFloat(parts[3]) || 0,
                        szInflow: parseFloat(parts[4]) || 0,
                        szOutflow: parseFloat(parts[5]) || 0,
                        szNet: parseFloat(parts[6]) || 0,
                        totalNet: parseFloat(parts[7]) || 0
                    };
                });

                const latest = flowData.length > 0 ? flowData[flowData.length - 1] : null;
                return {
                    flowData: flowData,
                    latest: latest,
                    shNet: latest ? latest.shNet : 0,
                    szNet: latest ? latest.szNet : 0,
                    totalNet: latest ? latest.totalNet : 0
                };
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
        if (!keyword || keyword.trim().length === 0) return [];

        const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(keyword.trim())}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=10&_${Date.now()}`;

        try {
            const data = await jsonpFetch(url);
            if (data?.QuotationCodeTable?.Data) {
                return data.QuotationCodeTable.Data.filter(item => {
                    return item.MktNum === '0' || item.MktNum === '1';
                }).map(item => {
                    const mkt = item.MktNum === '1' ? '1' : '0';
                    return {
                        code: item.Code,
                        name: item.Name,
                        secid: mkt + '.' + item.Code,
                        market: item.MktNum === '1' ? 'SH' : 'SZ'
                    };
                });
            }
        } catch (e) {
            console.error('搜索股票失败:', e);
        }
        return [];
    }

    // ==================== 格式化工具 ====================

    function formatAmount(value) {
        if (value == null || value === 0) return '--';
        if (Math.abs(value) >= 100000000) {
            return (value / 100000000).toFixed(2) + '亿';
        } else if (Math.abs(value) >= 10000) {
            return (value / 10000).toFixed(2) + '万';
        }
        return value.toFixed(2);
    }

    function formatMarketCap(value) {
        if (value == null || value === 0) return '--';
        return (value / 100000000).toFixed(2) + '亿';
    }

    function formatPercent(value, decimals = 2) {
        if (value == null) return '--';
        return (value > 0 ? '+' : '') + value.toFixed(decimals) + '%';
    }

    function formatPrice(value) {
        if (value == null) return '--';
        return value.toFixed(2);
    }

    function getPriceClass(value) {
        if (value == null) return 'price-flat';
        if (value > 0) return 'price-up';
        if (value < 0) return 'price-down';
        return 'price-flat';
    }

    function getMarketStatus() {
        const now = new Date();
        const day = now.getDay();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const time = hours * 60 + minutes;

        if (day === 0 || day === 6) {
            return { status: 'closed', text: '休市' };
        }

        if (time >= 570 && time <= 690) {
            return { status: 'open', text: '交易中' };
        }
        if (time >= 780 && time <= 900) {
            return { status: 'open', text: '交易中' };
        }
        if (time >= 555 && time < 570) {
            return { status: 'open', text: '集合竞价' };
        }
        if (time > 690 && time < 780) {
            return { status: 'open', text: '午间休市' };
        }

        return { status: 'closed', text: '已收盘' };
    }

    return {
        jsonpFetch,
        fetchStockList,
        fetchStockDetail,
        fetchKline,
        fetchFundFlow,
        fetchNorthFlow,
        searchStock,
        formatAmount,
        formatMarketCap,
        formatPercent,
        formatPrice,
        getPriceClass,
        getMarketStatus,
        getCurrentDataSource,
        switchDataSource,
        dataSources
    };
})();
