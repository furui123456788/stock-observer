/**
 * A股潜力股观察系统 - 数据层
 * 使用 JSONP 调用东方财富 API
 */

const API = (() => {
    'use strict';

    // JSONP 请求计数器
    let jsonpCounter = 0;

    /**
     * JSONP 请求封装
     * @param {string} url - 请求URL
     * @param {string} [cbParam='cb'] - JSONP回调参数名
     * @returns {Promise<any>}
     */
    function jsonpFetch(url, cbParam = 'cb') {
        return new Promise((resolve, reject) => {
            const callbackName = 'jsonp_cb_' + (++jsonpCounter) + '_' + Date.now();
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('JSONP 请求超时'));
            }, 15000);

            function cleanup() {
                clearTimeout(timeout);
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
     * 获取股票列表（批量行情）
     * @param {number} page - 页码 (从1开始)
     * @param {number} pageSize - 每页数量
     * @param {string} sortField - 排序字段
     * @param {number} sortOrder - 排序方向 (0=降序, 1=升序)
     * @param {string} market - 市场过滤 (all/sh/sz)
     * @returns {Promise<Object>}
     */
    async function fetchStockList(page = 1, pageSize = 30, sortField = 'f3', sortOrder = 0, market = 'all') {
        let fs = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23';
        if (market === 'sh') {
            fs = 'm:1+t:2,m:1+t:23';
        } else if (market === 'sz') {
            fs = 'm:0+t:6,m:0+t:80';
        }

        const fields = 'f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f26,f22,f11,f62,f115,f128,f136,f140,f141,f152,f162,f164,f167,f168,f169,f170,f171,f173,f183,f184,f185,f186,f187,f188,f189,f190,f191,f192';

        const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=${page}&pz=${pageSize}&po=1&np=1&fltt=2&invt=2&fid=${sortField}&fs=${encodeURIComponent(fs)}&fields=${fields}&_${Date.now()}`;

        try {
            const data = await jsonpFetch(url);
            if (data && data.data && data.data.diff) {
                return {
                    total: data.data.total || 0,
                    stocks: data.data.diff.map(parseStockItem)
                };
            }
            return { total: 0, stocks: [] };
        } catch (e) {
            console.error('获取股票列表失败:', e);
            return { total: 0, stocks: [] };
        }
    }

    /**
     * 解析单条股票数据
     */
    function parseStockItem(item) {
        return {
            code: item.f12 || '',
            name: item.f14 || '',
            price: item.f2 != null ? item.f2 / 100 : null,
            changePercent: item.f3 != null ? item.f3 / 100 : null,
            changeAmount: item.f4 != null ? item.f4 / 100 : null,
            volume: item.f5 || 0,
            turnover: item.f6 || 0,
            amplitude: item.f7 != null ? item.f7 / 100 : null,
            turnoverRate: item.f8 != null ? item.f8 / 100 : null,
            pe: item.f162 != null ? item.f162 / 100 : null,
            pb: item.f164 != null ? item.f164 / 100 : null,
            totalMarketCap: item.f20 || 0,
            circulatingMarketCap: item.f21 || 0,
            high: item.f15 != null ? item.f15 / 100 : null,
            low: item.f16 != null ? item.f16 / 100 : null,
            open: item.f17 != null ? item.f17 / 100 : null,
            prevClose: item.f18 != null ? item.f18 / 100 : null,
            volumeRatio: item.f10 || 0,
            secid: item.f13 || `${item.f13 ? '' : ''}`,
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
            _raw: item
        };
    }

    /**
     * 获取单只股票详情
     * @param {string} secid - 证券ID，格式 "1.600519"
     * @returns {Promise<Object>}
     */
    async function fetchStockDetail(secid) {
        const fields = 'f43,f44,f45,f46,f47,f48,f50,f51,f52,f55,f57,f58,f59,f60,f71,f84,f85,f92,f105,f116,f117,f162,f164,f167,f168,f169,f170,f171,f173,f183,f184,f185,f186,f187,f188,f189,f190,f191,f192,f292';

        const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=${fields}&fltt=2&invt=2&_${Date.now()}`;

        try {
            const data = await jsonpFetch(url);
            if (data && data.data) {
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
            return null;
        } catch (e) {
            console.error('获取股票详情失败:', e);
            return null;
        }
    }

    /**
     * 获取K线数据
     * @param {string} secid - 证券ID
     * @param {string} period - 周期: 101=日K, 102=周K, 103=月K
     * @param {number} limit - 数据条数
     * @returns {Promise<Array>}
     */
    async function fetchKline(secid, period = '101', limit = 120) {
        const fields1 = 'f1,f2,f3,f4,f5,f6';
        const fields2 = 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61';
        const klt = period === '101' ? '101' : period === '102' ? '102' : '103';
        const fqt = '1';

        const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=${fields1}&fields2=${fields2}&klt=${klt}&fqt=${fqt}&beg=0&end=20500101&lmt=${limit}&_${Date.now()}`;

        try {
            const data = await jsonpFetch(url);
            if (data && data.data && data.data.klines) {
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
            return [];
        } catch (e) {
            console.error('获取K线数据失败:', e);
            return [];
        }
    }

    /**
     * 获取资金流向数据
     * @param {string} secid - 证券ID
     * @returns {Promise<Object>}
     */
    async function fetchFundFlow(secid) {
        const lmt = '30';
        const klt = '101';
        const fields1 = 'f1,f2,f3,f7';
        const fields2 = 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65';

        const url = `https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?secid=${secid}&fields1=${fields1}&fields2=${fields2}&lmt=${lmt}&klt=${klt}&fqt=1&cb=&_${Date.now()}`;

        try {
            const data = await jsonpFetch(url);
            if (data && data.data) {
                const d = data.data;
                const klines = d.klines || [];
                const flowData = klines.map(line => {
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
                });

                return {
                    flowData: flowData,
                    latestMainForceNet: d.f62 || 0,
                    latestSuperLargeNet: d.f184 || 0,
                    latestLargeNet: d.f185 || 0,
                    latestMediumNet: d.f186 || 0,
                    latestSmallNet: d.f187 || 0
                };
            }
            return { flowData: [], latestMainForceNet: 0 };
        } catch (e) {
            console.error('获取资金流向失败:', e);
            return { flowData: [], latestMainForceNet: 0 };
        }
    }

    /**
     * 获取北向资金流向
     * @returns {Promise<Object>}
     */
    async function fetchNorthFlow() {
        const fields1 = 'f1,f2,f3';
        const fields2 = 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65';

        const url = `https://push2his.eastmoney.com/api/qt/kamt.kline/get?fields1=${fields1}&fields2=${fields2}&klt=101&fqt=1&beg=0&end=20500101&lmt=30&_${Date.now()}`;

        try {
            const data = await jsonpFetch(url);
            if (data && data.data && data.data.klines) {
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
            return { flowData: [], latest: null, shNet: 0, szNet: 0, totalNet: 0 };
        } catch (e) {
            console.error('获取北向资金失败:', e);
            return { flowData: [], latest: null, shNet: 0, szNet: 0, totalNet: 0 };
        }
    }

    /**
     * 搜索股票
     * @param {string} keyword - 搜索关键词（代码或名称）
     * @returns {Promise<Array>}
     */
    async function searchStock(keyword) {
        if (!keyword || keyword.trim().length === 0) return [];

        const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(keyword.trim())}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=10&_${Date.now()}`;

        try {
            const data = await jsonpFetch(url);
            if (data && data.QuotationCodeTable && data.QuotationCodeTable.Data) {
                return data.QuotationCodeTable.Data.filter(item => {
                    // 只保留A股
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
            return [];
        } catch (e) {
            console.error('搜索股票失败:', e);
            return [];
        }
    }

    /**
     * 格式化金额（亿）
     */
    function formatAmount(value) {
        if (value == null || value === 0) return '--';
        if (Math.abs(value) >= 100000000) {
            return (value / 100000000).toFixed(2) + '亿';
        } else if (Math.abs(value) >= 10000) {
            return (value / 10000).toFixed(2) + '万';
        }
        return value.toFixed(2);
    }

    /**
     * 格式化市值（亿）
     */
    function formatMarketCap(value) {
        if (value == null || value === 0) return '--';
        return (value / 100000000).toFixed(2) + '亿';
    }

    /**
     * 格式化百分比
     */
    function formatPercent(value, decimals = 2) {
        if (value == null) return '--';
        return (value > 0 ? '+' : '') + value.toFixed(decimals) + '%';
    }

    /**
     * 格式化价格
     */
    function formatPrice(value) {
        if (value == null) return '--';
        return value.toFixed(2);
    }

    /**
     * 获取价格CSS类名
     */
    function getPriceClass(value) {
        if (value == null) return 'price-flat';
        if (value > 0) return 'price-up';
        if (value < 0) return 'price-down';
        return 'price-flat';
    }

    /**
     * 判断市场状态
     */
    function getMarketStatus() {
        const now = new Date();
        const day = now.getDay();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const time = hours * 60 + minutes;

        if (day === 0 || day === 6) {
            return { status: 'closed', text: '休市' };
        }

        // 上午 9:30 - 11:30
        if (time >= 570 && time <= 690) {
            return { status: 'open', text: '交易中' };
        }
        // 下午 13:00 - 15:00
        if (time >= 780 && time <= 900) {
            return { status: 'open', text: '交易中' };
        }
        // 9:15 - 9:30 集合竞价
        if (time >= 555 && time < 570) {
            return { status: 'open', text: '集合竞价' };
        }
        // 11:30 - 13:00 午休
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
        getMarketStatus
    };
})();
