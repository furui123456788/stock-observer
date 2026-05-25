/**
 * A股潜力股观察系统 - 技术指标计算
 * 包含 MA, EMA, MACD, KDJ, RSI, BOLL, VOLMA, OBV
 */

const Indicators = (() => {
    'use strict';

    /**
     * 简单移动平均线 (SMA)
     * @param {number[]} closes - 收盘价数组
     * @param {number} period - 周期
     * @returns {number[]} MA数组（前period-1个为null）
     */
    function calcMA(closes, period) {
        const result = [];
        for (let i = 0; i < closes.length; i++) {
            if (i < period - 1) {
                result.push(null);
            } else {
                let sum = 0;
                for (let j = i - period + 1; j <= i; j++) {
                    sum += closes[j];
                }
                result.push(sum / period);
            }
        }
        return result;
    }

    /**
     * 指数移动平均线 (EMA)
     * @param {number[]} closes - 收盘价数组
     * @param {number} period - 周期
     * @returns {number[]} EMA数组
     */
    function calcEMA(closes, period) {
        if (closes.length === 0) return [];
        const result = [];
        const multiplier = 2 / (period + 1);

        // 第一个EMA值用SMA
        let sum = 0;
        for (let i = 0; i < Math.min(period, closes.length); i++) {
            sum += closes[i];
        }
        const firstEMA = sum / period;

        // 前period-1个为null
        for (let i = 0; i < period - 1; i++) {
            result.push(null);
        }
        result.push(firstEMA);

        // 后续用EMA公式
        for (let i = period; i < closes.length; i++) {
            const ema = (closes[i] - result[i - 1]) * multiplier + result[i - 1];
            result.push(ema);
        }
        return result;
    }

    /**
     * MACD 指标
     * @param {number[]} closes - 收盘价数组
     * @param {number} shortPeriod - 短期EMA周期，默认12
     * @param {number} longPeriod - 长期EMA周期，默认26
     * @param {number} signalPeriod - 信号线周期，默认9
     * @returns {{DIF: number[], DEA: number[], MACD: number[]}}
     */
    function calcMACD(closes, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
        const emaShort = calcEMA(closes, shortPeriod);
        const emaLong = calcEMA(closes, longPeriod);

        // DIF = EMA(short) - EMA(long)
        const DIF = [];
        for (let i = 0; i < closes.length; i++) {
            if (emaShort[i] === null || emaLong[i] === null) {
                DIF.push(null);
            } else {
                DIF.push(emaShort[i] - emaLong[i]);
            }
        }

        // DEA = EMA(DIF, signalPeriod)
        const validDIF = DIF.filter(v => v !== null);
        const deaOfValid = calcEMA(validDIF, signalPeriod);

        const DEA = [];
        let validIdx = 0;
        for (let i = 0; i < closes.length; i++) {
            if (DIF[i] === null) {
                DEA.push(null);
            } else {
                DEA.push(deaOfValid[validIdx] || null);
                validIdx++;
            }
        }

        // MACD柱 = (DIF - DEA) * 2
        const MACD = [];
        for (let i = 0; i < closes.length; i++) {
            if (DIF[i] === null || DEA[i] === null) {
                MACD.push(null);
            } else {
                MACD.push((DIF[i] - DEA[i]) * 2);
            }
        }

        return { DIF, DEA, MACD };
    }

    /**
     * KDJ 指标
     * @param {number[]} highs - 最高价数组
     * @param {number[]} lows - 最低价数组
     * @param {number[]} closes - 收盘价数组
     * @param {number} n - RSV周期，默认9
     * @param {number} m1 - K值平滑周期，默认3
     * @param {number} m2 - D值平滑周期，默认3
     * @returns {{K: number[], D: number[], J: number[]}}
     */
    function calcKDJ(highs, lows, closes, n = 9, m1 = 3, m2 = 3) {
        const len = closes.length;
        const K = [];
        const D = [];
        const J = [];
        let prevK = 50;
        let prevD = 50;

        for (let i = 0; i < len; i++) {
            if (i < n - 1) {
                K.push(null);
                D.push(null);
                J.push(null);
                continue;
            }

            // 计算n周期内的最高价和最低价
            let highest = -Infinity;
            let lowest = Infinity;
            for (let j = i - n + 1; j <= i; j++) {
                if (highs[j] > highest) highest = highs[j];
                if (lows[j] < lowest) lowest = lows[j];
            }

            // RSV
            const rsv = highest === lowest ? 50 : ((closes[i] - lowest) / (highest - lowest)) * 100;

            // K = (2/3) * prevK + (1/3) * RSV
            const k = (2 / 3) * prevK + (1 / 3) * rsv;
            // D = (2/3) * prevD + (1/3) * K
            const d = (2 / 3) * prevD + (1 / 3) * k;
            // J = 3*K - 2*D
            const j = 3 * k - 2 * d;

            K.push(k);
            D.push(d);
            J.push(j);

            prevK = k;
            prevD = d;
        }

        return { K, D, J };
    }

    /**
     * RSI 相对强弱指标
     * @param {number[]} closes - 收盘价数组
     * @param {number} period - 周期，默认14
     * @returns {number[]} RSI数组
     */
    function calcRSI(closes, period = 14) {
        const result = [];
        if (closes.length < period + 1) {
            return closes.map(() => null);
        }

        // 第一个值用SMA
        let gainSum = 0;
        let lossSum = 0;
        for (let i = 1; i <= period; i++) {
            const change = closes[i] - closes[i - 1];
            if (change > 0) {
                gainSum += change;
            } else {
                lossSum += Math.abs(change);
            }
        }

        // 前period个为null
        for (let i = 0; i < period; i++) {
            result.push(null);
        }

        let avgGain = gainSum / period;
        let avgLoss = lossSum / period;
        result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));

        // 后续用Wilder平滑法
        for (let i = period + 1; i < closes.length; i++) {
            const change = closes[i] - closes[i - 1];
            const gain = change > 0 ? change : 0;
            const loss = change < 0 ? Math.abs(change) : 0;

            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;

            result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
        }

        return result;
    }

    /**
     * BOLL 布林带
     * @param {number[]} closes - 收盘价数组
     * @param {number} period - 周期，默认20
     * @param {number} multiplier - 标准差倍数，默认2
     * @returns {{upper: number[], middle: number[], lower: number[]}}
     */
    function calcBOLL(closes, period = 20, multiplier = 2) {
        const middle = calcMA(closes, period);
        const upper = [];
        const lower = [];

        for (let i = 0; i < closes.length; i++) {
            if (middle[i] === null) {
                upper.push(null);
                lower.push(null);
            } else {
                // 计算标准差
                let sumSq = 0;
                for (let j = i - period + 1; j <= i; j++) {
                    sumSq += Math.pow(closes[j] - middle[i], 2);
                }
                const stdDev = Math.sqrt(sumSq / period);

                upper.push(middle[i] + multiplier * stdDev);
                lower.push(middle[i] - multiplier * stdDev);
            }
        }

        return { upper, middle, lower };
    }

    /**
     * 成交量移动平均
     * @param {number[]} volumes - 成交量数组
     * @param {number} period - 周期，默认5
     * @returns {number[]} VOLMA数组
     */
    function calcVOLMA(volumes, period = 5) {
        return calcMA(volumes, period);
    }

    /**
     * OBV 能量潮指标
     * @param {number[]} closes - 收盘价数组
     * @param {number[]} volumes - 成交量数组
     * @returns {number[]} OBV数组
     */
    function calcOBV(closes, volumes) {
        if (closes.length === 0 || volumes.length === 0) return [];
        const result = [0];

        for (let i = 1; i < closes.length; i++) {
            if (closes[i] > closes[i - 1]) {
                result.push(result[i - 1] + volumes[i]);
            } else if (closes[i] < closes[i - 1]) {
                result.push(result[i - 1] - volumes[i]);
            } else {
                result.push(result[i - 1]);
            }
        }

        return result;
    }

    /**
     * 计算所有常用指标（便捷方法）
     * @param {Array} klines - K线数据数组
     * @returns {Object} 包含所有指标的集合
     */
    function calcAll(klines) {
        if (!klines || klines.length < 30) return null;

        const closes = klines.map(k => k.close);
        const highs = klines.map(k => k.high);
        const lows = klines.map(k => k.low);
        const volumes = klines.map(k => k.volume);

        const ma5 = calcMA(closes, 5);
        const ma10 = calcMA(closes, 10);
        const ma20 = calcMA(closes, 20);
        const ma60 = calcMA(closes, 60);
        const macd = calcMACD(closes);
        const kdj = calcKDJ(highs, lows, closes);
        const rsi6 = calcRSI(closes, 6);
        const rsi14 = calcRSI(closes, 14);
        const rsi24 = calcRSI(closes, 24);
        const boll = calcBOLL(closes);
        const volMa5 = calcVOLMA(volumes, 5);
        const volMa10 = calcVOLMA(volumes, 10);
        const obv = calcOBV(closes, volumes);

        return {
            ma5, ma10, ma20, ma60,
            macd, kdj,
            rsi6, rsi14, rsi24,
            boll, volMa5, volMa10, obv
        };
    }

    /**
     * 获取最新指标值（用于评分）
     */
    function getLatestIndicators(klines) {
        const all = calcAll(klines);
        if (!all) return null;

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

        return {
            ma5: last(all.ma5),
            ma10: last(all.ma10),
            ma20: last(all.ma20),
            ma60: last(all.ma60),
            dif: last(all.macd.DIF),
            dea: last(all.macd.DEA),
            macd: last(all.macd.MACD),
            prevDif: prev(all.macd.DIF),
            prevDea: prev(all.macd.DEA),
            prevMacd: prev(all.macd.MACD),
            k: last(all.kdj.K),
            d: last(all.kdj.D),
            j: last(all.kdj.J),
            rsi6: last(all.rsi6),
            rsi14: last(all.rsi14),
            rsi24: last(all.rsi24),
            bollUpper: last(all.boll.upper),
            bollMiddle: last(all.boll.middle),
            bollLower: last(all.boll.lower),
            volMa5: last(all.volMa5),
            volMa10: last(all.volMa10),
            obv: last(all.obv),
            _all: all
        };
    }

    /**
     * 简化版技术指标概览 - 不需要K线数据
     * 根据股票基本信息生成概览
     */
    function getSimpleSummary(stock) {
        const pe = stock.pe;
        const pb = stock.pb;
        const volumeRatio = stock.volumeRatio;
        
        // 简单判断
        let peSignal = 'neutral';
        let pbSignal = 'neutral';
        let volSignal = 'neutral';
        let peAdvice = '合理';
        let pbAdvice = '合理';
        let volAdvice = '正常';
        
        if (pe != null) {
            if (pe < 15) {
                peSignal = 'bullish';
                peAdvice = '低估';
            } else if (pe > 40) {
                peSignal = 'bearish';
                peAdvice = '高估';
            }
        }
        
        if (pb != null) {
            if (pb < 2) {
                pbSignal = 'bullish';
                pbAdvice = '低估';
            } else if (pb > 8) {
                pbSignal = 'bearish';
                pbAdvice = '高估';
            }
        }
        
        if (volumeRatio != null) {
            if (volumeRatio > 2) {
                volSignal = 'bullish';
                volAdvice = '放量';
            } else if (volumeRatio < 0.5) {
                volSignal = 'bearish';
                volAdvice = '缩量';
            }
        }
        
        return {
            pe: pe,
            peAdvice: peAdvice,
            peSignal: peSignal,
            pb: pb,
            pbAdvice: pbAdvice,
            pbSignal: pbSignal,
            volumeRatio: volumeRatio,
            volAdvice: volAdvice,
            volSignal: volSignal,
            // 这些设为null表示不显示
            macd: null,
            dif: null,
            dea: null,
            kdj: null,
            rsi14: null
        };
    }

    return {
        calcMA,
        calcEMA,
        calcMACD,
        calcKDJ,
        calcRSI,
        calcBOLL,
        calcVOLMA,
        calcOBV,
        calcAll,
        getLatestIndicators,
        getSimpleSummary
    };
})();
