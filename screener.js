/**
 * A股潜力股观察系统 - 股票筛选与评分
 * 基本面筛选、技术面筛选、资金面筛选、综合评分
 */

const Screener = (() => {
    'use strict';

    /**
     * 基本面筛选
     * @param {Array} stocks - 股票列表
     * @param {Object} filters - 筛选条件
     * @returns {Array} 筛选后的股票
     */
    function screenByFundamentals(stocks, filters) {
        if (!stocks || stocks.length === 0) return [];

        return stocks.filter(stock => {
            // PE 筛选
            if (filters.peMin != null && filters.peMin !== '' && (stock.pe == null || stock.pe < filters.peMin)) return false;
            if (filters.peMax != null && filters.peMax !== '' && (stock.pe == null || stock.pe > filters.peMax)) return false;

            // PB 筛选
            if (filters.pbMin != null && filters.pbMin !== '' && (stock.pb == null || stock.pb < filters.pbMin)) return false;
            if (filters.pbMax != null && filters.pbMax !== '' && (stock.pb == null || stock.pb > filters.pbMax)) return false;

            // ROE 筛选
            if (filters.roeMin != null && filters.roeMin !== '' && (stock.roe == null || stock.roe < filters.roeMin)) return false;
            if (filters.roeMax != null && filters.roeMax !== '' && (stock.roe == null || stock.roe > filters.roeMax)) return false;

            // 营收增长率筛选
            if (filters.revGrowthMin != null && filters.revGrowthMin !== '' && (stock.revenueGrowth == null || stock.revenueGrowth < filters.revGrowthMin)) return false;
            if (filters.revGrowthMax != null && filters.revGrowthMax !== '' && (stock.revenueGrowth == null || stock.revenueGrowth > filters.revGrowthMax)) return false;

            // 总市值筛选（亿）
            if (filters.mcapMin != null && filters.mcapMin !== '') {
                const mcapYi = stock.totalMarketCap ? stock.totalMarketCap / 100000000 : 0;
                if (mcapYi < filters.mcapMin) return false;
            }
            if (filters.mcapMax != null && filters.mcapMax !== '') {
                const mcapYi = stock.totalMarketCap ? stock.totalMarketCap / 100000000 : Infinity;
                if (mcapYi > filters.mcapMax) return false;
            }

            // 排除ST股
            if (stock.name && stock.name.includes('ST')) return false;

            // 排除停牌股
            if (stock.price == null || stock.price === 0) return false;

            return true;
        });
    }

    /**
     * 技术面筛选（需要K线数据）
     * @param {Array} stocksWithKline - 带K线数据的股票数组 [{stock, klines, indicators}]
     * @returns {Array} 符合技术面条件的股票
     */
    function screenByTechnical(stocksWithKline) {
        if (!stocksWithKline || stocksWithKline.length === 0) return [];

        return stocksWithKline.filter(item => {
            const { klines, indicators } = item;
            if (!klines || klines.length < 60 || !indicators) return false;

            const last = (arr) => {
                for (let i = arr.length - 1; i >= 0; i--) {
                    if (arr[i] !== null) return arr[i];
                }
                return null;
            };

            const prev = (arr) => {
                for (let i = arr.length - 2; i >= 0; i--) {
                    if (arr[i] !== null) return arr[i];
                }
                return null;
            };

            let signals = 0;

            // 金叉信号：MA5上穿MA10
            if (indicators.ma5 && indicators.ma10) {
                const curMa5 = last(indicators.ma5);
                const curMa10 = last(indicators.ma10);
                const prevMa5 = prev(indicators.ma5);
                const prevMa10 = prev(indicators.ma10);
                if (curMa5 && curMa10 && prevMa5 && prevMa10) {
                    if (prevMa5 <= prevMa10 && curMa5 > curMa10) signals++;
                }
            }

            // MACD金叉
            if (indicators.macd) {
                const curDif = last(indicators.macd.DIF);
                const curDea = last(indicators.macd.DEA);
                const prevDif = prev(indicators.macd.DIF);
                const prevDea = prev(indicators.macd.DEA);
                if (curDif != null && curDea != null && prevDif != null && prevDea != null) {
                    if (prevDif <= prevDea && curDif > curDea) signals++;
                }
                // MACD绿柱缩短
                const curMacd = last(indicators.macd.MACD);
                const prevMacd = prev(indicators.macd.MACD);
                if (curMacd != null && prevMacd != null) {
                    if (prevMacd < 0 && curMacd > prevMacd) signals++;
                }
            }

            // RSI 超卖反弹
            if (indicators.rsi14) {
                const curRSI = last(indicators.rsi14);
                const prevRSI = prev(indicators.rsi14);
                if (curRSI != null && prevRSI != null) {
                    if (prevRSI < 30 && curRSI >= 30) signals++;
                }
            }

            // KDJ金叉
            if (indicators.kdj) {
                const curK = last(indicators.kdj.K);
                const curD = last(indicators.kdj.D);
                const prevK = prev(indicators.kdj.K);
                const prevD = prev(indicators.kdj.D);
                if (curK != null && curD != null && prevK != null && prevD != null) {
                    if (prevK <= prevD && curK > curD && curK < 50) signals++;
                }
            }

            // 至少满足一个技术信号
            return signals >= 1;
        });
    }

    /**
     * 资金面筛选
     * @param {Array} stocks - 股票列表（需要包含资金流向数据）
     * @returns {Array} 主力净流入的股票
     */
    function screenByCapitalFlow(stocks) {
        if (!stocks || stocks.length === 0) return [];

        return stocks.filter(stock => {
            // 主力净流入 > 0
            if (stock.mainForceNetInflow == null || stock.mainForceNetInflow <= 0) return false;
            return true;
        }).sort((a, b) => {
            return (b.mainForceNetInflow || 0) - (a.mainForceNetInflow || 0);
        });
    }

    /**
     * 计算综合评分（0-100）
     * @param {Object} stock - 股票数据
     * @param {Object} techIndicators - 技术指标数据（可选）
     * @param {Object} fundFlow - 资金流向数据（可选）
     * @returns {Object} { score, techScore, fundScore, capitalScore, momentumScore, reasons }
     */
    function calculateCompositeScore(stock, techIndicators, fundFlow) {
        let techScore = 50;
        let fundScore = 50;
        let capitalScore = 50;
        let momentumScore = 50;
        const reasons = [];

        // ===== 技术面评分 (30%) =====
        if (techIndicators) {
            techScore = calcTechnicalScore(techIndicators, reasons);
        } else {
            // 无K线数据时，基于简单价格数据粗略评估
            if (stock.changePercent != null) {
                if (stock.changePercent > 0 && stock.changePercent < 5) {
                    techScore += 5;
                    reasons.push({ text: '温和上涨', type: 'positive' });
                } else if (stock.changePercent >= 5 && stock.changePercent < 9.5) {
                    techScore += 10;
                    reasons.push({ text: '强势上涨', type: 'positive' });
                } else if (stock.changePercent >= 9.5) {
                    techScore -= 5;
                    reasons.push({ text: '涨停追高风险', type: 'negative' });
                } else if (stock.changePercent < -3) {
                    techScore -= 10;
                    reasons.push({ text: '大幅下跌', type: 'negative' });
                }
            }
        }

        // ===== 基本面评分 (30%) =====
        fundScore = calcFundamentalScore(stock, reasons);

        // ===== 资金面评分 (25%) =====
        if (fundFlow) {
            capitalScore = calcCapitalScore(fundFlow, reasons);
        } else if (stock.mainForceNetInflow != null) {
            // 使用列表中的主力净流入数据
            const inflow = stock.mainForceNetInflow;
            if (inflow > 50000000) {
                capitalScore = 80;
                reasons.push({ text: '主力大幅流入', type: 'positive' });
            } else if (inflow > 10000000) {
                capitalScore = 70;
                reasons.push({ text: '主力净流入', type: 'positive' });
            } else if (inflow > 0) {
                capitalScore = 60;
                reasons.push({ text: '主力小幅流入', type: 'positive' });
            } else if (inflow > -10000000) {
                capitalScore = 45;
            } else {
                capitalScore = 30;
                reasons.push({ text: '主力净流出', type: 'negative' });
            }
        }

        // ===== 动量评分 (15%) =====
        momentumScore = calcMomentumScore(stock, reasons);

        // 综合评分
        const score = Math.round(
            techScore * 0.30 +
            fundScore * 0.30 +
            capitalScore * 0.25 +
            momentumScore * 0.15
        );

        return {
            score: Math.max(0, Math.min(100, score)),
            techScore: Math.round(techScore),
            fundScore: Math.round(fundScore),
            capitalScore: Math.round(capitalScore),
            momentumScore: Math.round(momentumScore),
            reasons: reasons
        };
    }

    /**
     * 技术面评分子函数
     */
    function calcTechnicalScore(indicators, reasons) {
        let score = 50;
        const last = (arr) => {
            for (let i = arr.length - 1; i >= 0; i--) {
                if (arr[i] !== null) return arr[i];
            }
            return null;
        };
        const prev = (arr) => {
            for (let i = arr.length - 2; i >= 0; i--) {
                if (arr[i] !== null) return arr[i];
            }
            return null;
        };

        // MACD 信号 (0-30分)
        if (indicators.macd) {
            const dif = last(indicators.macd.DIF);
            const dea = last(indicators.macd.DEA);
            const macd = last(indicators.macd.MACD);
            const prevDif = prev(indicators.macd.DIF);
            const prevDea = prev(indicators.macd.DEA);

            if (dif != null && dea != null) {
                if (dif > dea && prevDif != null && prevDea != null && prevDif <= prevDea) {
                    score += 15;
                    reasons.push({ text: 'MACD金叉', type: 'positive' });
                } else if (dif > dea) {
                    score += 8;
                    reasons.push({ text: 'MACD多头', type: 'positive' });
                } else if (dif < dea && prevDif != null && prevDea != null && prevDif >= prevDea) {
                    score -= 15;
                    reasons.push({ text: 'MACD死叉', type: 'negative' });
                } else if (dif < dea) {
                    score -= 5;
                }

                // MACD柱状图
                if (macd != null) {
                    const prevMacd = prev(indicators.macd.MACD);
                    if (prevMacd != null && macd > prevMacd && macd < 0) {
                        score += 5;
                        reasons.push({ text: '绿柱缩短', type: 'positive' });
                    }
                }
            }
        }

        // MA 均线排列 (0-20分)
        if (indicators.ma5 && indicators.ma10 && indicators.ma20 && indicators.ma60) {
            const ma5 = last(indicators.ma5);
            const ma10 = last(indicators.ma10);
            const ma20 = last(indicators.ma20);
            const ma60 = last(indicators.ma60);

            if (ma5 && ma10 && ma20 && ma60) {
                if (ma5 > ma10 && ma10 > ma20 && ma20 > ma60) {
                    score += 20;
                    reasons.push({ text: '多头排列', type: 'positive' });
                } else if (ma5 > ma10 && ma10 > ma20) {
                    score += 12;
                    reasons.push({ text: '短期多头', type: 'positive' });
                } else if (ma5 < ma10 && ma10 < ma20 && ma20 < ma60) {
                    score -= 15;
                    reasons.push({ text: '空头排列', type: 'negative' });
                }
            }
        }

        // RSI 位置 (0-15分)
        if (indicators.rsi14) {
            const rsi = last(indicators.rsi14);
            if (rsi != null) {
                if (rsi < 30) {
                    score += 10;
                    reasons.push({ text: 'RSI超卖', type: 'positive' });
                } else if (rsi < 45) {
                    score += 5;
                } else if (rsi > 70) {
                    score -= 10;
                    reasons.push({ text: 'RSI超买', type: 'negative' });
                } else if (rsi > 80) {
                    score -= 15;
                    reasons.push({ text: 'RSI严重超买', type: 'negative' });
                }
            }
        }

        // KDJ 信号 (0-10分)
        if (indicators.kdj) {
            const k = last(indicators.kdj.K);
            const d = last(indicators.kdj.D);
            const j = last(indicators.kdj.J);
            const prevK = prev(indicators.kdj.K);
            const prevD = prev(indicators.kdj.D);

            if (k != null && d != null && prevK != null && prevD != null) {
                if (prevK <= prevD && k > d && k < 40) {
                    score += 10;
                    reasons.push({ text: 'KDJ低位金叉', type: 'positive' });
                } else if (prevK <= prevD && k > d) {
                    score += 5;
                    reasons.push({ text: 'KDJ金叉', type: 'positive' });
                }
                if (j != null && j < 0) {
                    score += 5;
                    reasons.push({ text: 'KDJ超卖', type: 'positive' });
                }
            }
        }

        // 布林带 (0-10分)
        if (indicators.boll) {
            const upper = last(indicators.boll.upper);
            const lower = last(indicators.boll.lower);
            const middle = last(indicators.boll.middle);
            // 这里需要当前价格，用ma5近似
            const price = last(indicators.ma5);
            if (upper && lower && middle && price) {
                const bollWidth = upper - lower;
                const bollMid = (upper + lower) / 2;
                if (price <= lower * 1.02) {
                    score += 8;
                    reasons.push({ text: '触及布林下轨', type: 'positive' });
                } else if (price >= upper * 0.98) {
                    score -= 8;
                    reasons.push({ text: '触及布林上轨', type: 'negative' });
                }
            }
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * 基本面评分子函数
     */
    function calcFundamentalScore(stock, reasons) {
        let score = 50;

        // PE 估值 (0-25分)
        if (stock.pe != null && stock.pe > 0) {
            if (stock.pe < 15) {
                score += 15;
                reasons.push({ text: 'PE低估(' + stock.pe.toFixed(1) + ')', type: 'positive' });
            } else if (stock.pe < 25) {
                score += 8;
                reasons.push({ text: 'PE合理(' + stock.pe.toFixed(1) + ')', type: 'positive' });
            } else if (stock.pe < 40) {
                score += 0;
            } else if (stock.pe < 80) {
                score -= 8;
                reasons.push({ text: 'PE偏高(' + stock.pe.toFixed(1) + ')', type: 'negative' });
            } else {
                score -= 15;
                reasons.push({ text: 'PE极高(' + stock.pe.toFixed(1) + ')', type: 'negative' });
            }
        } else if (stock.pe != null && stock.pe < 0) {
            score -= 10;
            reasons.push({ text: '亏损', type: 'negative' });
        }

        // PB 估值 (0-15分)
        if (stock.pb != null && stock.pb > 0) {
            if (stock.pb < 1) {
                score += 12;
                reasons.push({ text: '破净(' + stock.pb.toFixed(2) + ')', type: 'positive' });
            } else if (stock.pb < 2) {
                score += 8;
            } else if (stock.pb < 5) {
                score += 3;
            } else {
                score -= 5;
            }
        }

        // ROE 质量 (0-20分)
        if (stock.roe != null) {
            if (stock.roe > 20) {
                score += 20;
                reasons.push({ text: 'ROE优秀(' + stock.roe.toFixed(1) + '%)', type: 'positive' });
            } else if (stock.roe > 15) {
                score += 15;
                reasons.push({ text: 'ROE良好(' + stock.roe.toFixed(1) + '%)', type: 'positive' });
            } else if (stock.roe > 10) {
                score += 8;
            } else if (stock.roe > 5) {
                score += 3;
            } else {
                score -= 5;
                reasons.push({ text: 'ROE偏低(' + stock.roe.toFixed(1) + '%)', type: 'negative' });
            }
        }

        // 营收增长率 (0-20分)
        if (stock.revenueGrowth != null) {
            if (stock.revenueGrowth > 30) {
                score += 20;
                reasons.push({ text: '高增长(' + stock.revenueGrowth.toFixed(1) + '%)', type: 'positive' });
            } else if (stock.revenueGrowth > 15) {
                score += 12;
                reasons.push({ text: '稳健增长(' + stock.revenueGrowth.toFixed(1) + '%)', type: 'positive' });
            } else if (stock.revenueGrowth > 5) {
                score += 5;
            } else if (stock.revenueGrowth < 0) {
                score -= 10;
                reasons.push({ text: '营收下滑(' + stock.revenueGrowth.toFixed(1) + '%)', type: 'negative' });
            }
        }

        // 利润增长率 (0-10分)
        if (stock.profitGrowth != null) {
            if (stock.profitGrowth > 30) {
                score += 10;
            } else if (stock.profitGrowth > 15) {
                score += 6;
            } else if (stock.profitGrowth < 0) {
                score -= 8;
            }
        }

        // 市值适中加分 (0-10分)
        if (stock.totalMarketCap) {
            const mcapYi = stock.totalMarketCap / 100000000;
            if (mcapYi > 100 && mcapYi < 2000) {
                score += 5; // 中大盘股稳定性好
            }
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * 资金面评分子函数
     */
    function calcCapitalScore(fundFlow, reasons) {
        let score = 50;

        if (!fundFlow || !fundFlow.flowData || fundFlow.flowData.length === 0) return score;

        const recentDays = Math.min(5, fundFlow.flowData.length);
        let netInflowSum = 0;
        let inflowDays = 0;

        for (let i = fundFlow.flowData.length - recentDays; i < fundFlow.flowData.length; i++) {
            const d = fundFlow.flowData[i];
            netInflowSum += d.mainForceNet;
            if (d.mainForceNet > 0) inflowDays++;
        }

        // 连续流入天数
        if (inflowDays === recentDays) {
            score += 25;
            reasons.push({ text: '连续' + recentDays + '日主力流入', type: 'positive' });
        } else if (inflowDays >= recentDays * 0.6) {
            score += 15;
            reasons.push({ text: '近期主力偏多', type: 'positive' });
        } else if (inflowDays <= 1) {
            score -= 15;
            reasons.push({ text: '主力持续流出', type: 'negative' });
        }

        // 流入金额
        if (netInflowSum > 500000000) {
            score += 15;
            reasons.push({ text: '大额资金流入', type: 'positive' });
        } else if (netInflowSum > 100000000) {
            score += 8;
        } else if (netInflowSum < -100000000) {
            score -= 10;
            reasons.push({ text: '大额资金流出', type: 'negative' });
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * 动量评分子函数
     */
    function calcMomentumScore(stock, reasons) {
        let score = 50;

        // 涨跌幅动量
        if (stock.changePercent != null) {
            if (stock.changePercent > 3 && stock.changePercent < 7) {
                score += 15;
                reasons.push({ text: '上涨动量良好', type: 'positive' });
            } else if (stock.changePercent > 0 && stock.changePercent <= 3) {
                score += 8;
            } else if (stock.changePercent > 7 && stock.changePercent < 9.5) {
                score += 5;
                reasons.push({ text: '强势拉升', type: 'positive' });
            } else if (stock.changePercent >= 9.5) {
                score -= 5;
                reasons.push({ text: '涨停', type: 'neutral' });
            } else if (stock.changePercent < -3) {
                score -= 15;
                reasons.push({ text: '下跌动量强', type: 'negative' });
            } else if (stock.changePercent < 0) {
                score -= 5;
            }
        }

        // 量比
        if (stock.volumeRatio != null) {
            if (stock.volumeRatio > 1 && stock.volumeRatio < 3) {
                score += 10;
                reasons.push({ text: '放量(' + stock.volumeRatio.toFixed(1) + ')', type: 'positive' });
            } else if (stock.volumeRatio >= 3) {
                score += 5;
                reasons.push({ text: '巨量(' + stock.volumeRatio.toFixed(1) + ')', type: 'neutral' });
            } else if (stock.volumeRatio < 0.5) {
                score -= 5;
                reasons.push({ text: '缩量', type: 'negative' });
            }
        }

        // 换手率
        if (stock.turnoverRate != null) {
            if (stock.turnoverRate > 3 && stock.turnoverRate < 15) {
                score += 5;
            } else if (stock.turnoverRate >= 20) {
                score -= 5;
                reasons.push({ text: '换手率过高', type: 'negative' });
            }
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * 智能选股
     * 获取综合评分最高的股票
     * @param {Array} stocks - 股票列表
     * @param {number} topN - 返回前N只
     * @returns {Promise<Array>} 带评分的股票列表
     */
    async function getSmartPicks(stocks, topN = 10) {
        if (!stocks || stocks.length === 0) return [];

        // 过滤掉无效数据
        const validStocks = stocks.filter(s =>
            s.code && s.name &&
            s.price != null && s.price > 0 &&
            !s.name.includes('ST')
        );

        // 先用基本面快速评分排序，取前topN*3只做深度分析
        const preScored = validStocks.map(stock => {
            const result = calculateCompositeScore(stock);
            return { stock, ...result };
        }).sort((a, b) => b.score - a.score);

        const candidates = preScored.slice(0, topN * 3);

        // 对候选股票获取K线和资金流向数据做深度评分
        const deepScored = [];
        const batchSize = 3;

        for (let i = 0; i < candidates.length; i += batchSize) {
            const batch = candidates.slice(i, i + batchSize);
            const promises = batch.map(async (item) => {
                try {
                    // 获取K线数据
                    const secid = item.stock.marketCode || `1.${item.stock.code}`;
                    const klines = await API.fetchKline(secid, '101', 120);

                    let techIndicators = null;
                    let fundFlow = null;

                    if (klines && klines.length >= 30) {
                        techIndicators = Indicators.getLatestIndicators(klines);
                    }

                    // 获取资金流向
                    try {
                        fundFlow = await API.fetchFundFlow(secid);
                    } catch (e) {
                        // 忽略资金流向获取失败
                    }

                    // 重新计算综合评分
                    const result = calculateCompositeScore(item.stock, techIndicators, fundFlow);

                    return {
                        stock: item.stock,
                        klines: klines,
                        ...result
                    };
                } catch (e) {
                    return { stock: item.stock, ...item };
                }
            });

            const results = await Promise.all(promises);
            deepScored.push(...results);
        }

        // 最终排序
        deepScored.sort((a, b) => b.score - a.score);

        return deepScored.slice(0, topN);
    }

    return {
        screenByFundamentals,
        screenByTechnical,
        screenByCapitalFlow,
        calculateCompositeScore,
        getSmartPicks
    };
})();
