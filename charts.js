/**
 * A股潜力股观察系统 - 图表渲染
 * 基于 Canvas 的K线图、资金流向图、评分仪表盘
 */

const Charts = (() => {
    'use strict';

    // 颜色常量
    const COLORS = {
        bg: '#161b22',
        bgLight: '#1c2333',
        grid: '#21262d',
        text: '#8b949e',
        textLight: '#e6edf3',
        up: '#ef4444',
        upFill: 'rgba(239, 68, 68, 0.8)',
        down: '#22c55e',
        downFill: 'rgba(34, 197, 94, 0.8)',
        ma5: '#f5c842',
        ma10: '#4dc9f6',
        ma20: '#f67280',
        ma60: '#a78bfa',
        dif: '#f5c842',
        dea: '#4dc9f6',
        macdUp: '#ef4444',
        macdDown: '#22c55e',
        crosshair: 'rgba(255, 255, 255, 0.3)',
        crosshairText: '#e6edf3',
        crosshairBg: 'rgba(22, 27, 34, 0.9)',
        bollUpper: 'rgba(168, 85, 247, 0.5)',
        bollMiddle: 'rgba(168, 85, 247, 0.3)',
        bollLower: 'rgba(168, 85, 247, 0.5)',
        flowMain: '#ef4444',
        flowRetail: '#22c55e',
        gaugeBg: '#30363d',
        gaugeFill: '#3b82f6',
        gaugeGood: '#22c55e',
        gaugeWarn: '#f59e0b',
        gaugeBad: '#ef4444'
    };

    /**
     * 设置 Canvas 高清渲染
     */
    function setupCanvas(canvas, width, height) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        return ctx;
    }

    /**
     * 绘制K线图
     * @param {HTMLCanvasElement} canvas
     * @param {Array} klines - K线数据
     * @param {Object} indicators - 指标数据
     * @param {Object} options - 可选配置
     */
    function drawKlineChart(canvas, klines, indicators, options = {}) {
        if (!klines || klines.length < 2) return;

        const container = canvas.parentElement;
        const width = container.clientWidth || 360;
        const height = options.height || 480;
        const ctx = setupCanvas(canvas, width, height);

        // 布局参数
        const padding = { top: 20, right: 56, bottom: 20, left: 4 };
        const chartWidth = width - padding.left - padding.right;
        const klineHeight = Math.floor((height - padding.top - padding.bottom) * 0.52);
        const volHeight = Math.floor((height - padding.top - padding.bottom) * 0.18);
        const macdHeight = Math.floor((height - padding.top - padding.bottom) * 0.22);
        const gap = 6;
        const klineTop = padding.top;
        const volTop = klineTop + klineHeight + gap;
        const macdTop = volTop + volHeight + gap;

        // 可见数据范围
        let visibleCount = options.visibleCount || Math.min(klines.length, 40);
        let startIdx = Math.max(0, klines.length - visibleCount);
        if (options.startIdx !== undefined) {
            startIdx = Math.max(0, Math.min(options.startIdx, klines.length - 10));
            visibleCount = Math.min(klines.length - startIdx, visibleCount);
        }
        const endIdx = startIdx + visibleCount;
        const visibleKlines = klines.slice(startIdx, endIdx);

        // 计算价格范围
        let minPrice = Infinity, maxPrice = -Infinity;
        let maxVol = 0;
        let maxMACD = 0;

        visibleKlines.forEach(k => {
            if (k.low < minPrice) minPrice = k.low;
            if (k.high > maxPrice) maxPrice = k.high;
            if (k.volume > maxVol) maxVol = k.volume;
        });

        // 考虑MA线的范围
        if (indicators) {
            [indicators.ma5, indicators.ma10, indicators.ma20, indicators.ma60].forEach(ma => {
                if (ma) {
                    for (let i = startIdx; i < endIdx; i++) {
                        if (ma[i] !== null) {
                            if (ma[i] < minPrice) minPrice = ma[i];
                            if (ma[i] > maxPrice) maxPrice = ma[i];
                        }
                    }
                }
            });

            if (indicators.macd) {
                for (let i = startIdx; i < endIdx; i++) {
                    if (indicators.macd.MACD && indicators.macd.MACD[i] !== null) {
                        const absVal = Math.abs(indicators.macd.MACD[i]);
                        if (absVal > maxMACD) maxMACD = absVal;
                    }
                    if (indicators.macd.DIF && indicators.macd.DIF[i] !== null) {
                        const absVal = Math.abs(indicators.macd.DIF[i]);
                        if (absVal > maxMACD) maxMACD = absVal;
                    }
                    if (indicators.macd.DEA && indicators.macd.DEA[i] !== null) {
                        const absVal = Math.abs(indicators.macd.DEA[i]);
                        if (absVal > maxMACD) maxMACD = absVal;
                    }
                }
            }
        }

        const priceRange = maxPrice - minPrice || 1;
        const pricePadding = priceRange * 0.08;
        minPrice -= pricePadding;
        maxPrice += pricePadding;
        maxVol *= 1.1;
        maxMACD *= 1.2;
        if (maxMACD === 0) maxMACD = 1;

        // 坐标转换函数
        const candleWidth = chartWidth / visibleCount;
        const bodyWidth = Math.max(1, candleWidth * 0.7);

        function priceToY(price) {
            return klineTop + klineHeight - ((price - minPrice) / (maxPrice - minPrice)) * klineHeight;
        }

        function volToY(vol) {
            return volTop + volHeight - (vol / maxVol) * volHeight;
        }

        function macdToY(val) {
            const mid = macdTop + macdHeight / 2;
            return mid - (val / maxMACD) * (macdHeight / 2);
        }

        function idxToX(i) {
            return padding.left + (i - startIdx + 0.5) * candleWidth;
        }

        // 清空画布
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, width, height);

        // 绘制网格线
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 0.5;

        // 价格区域网格
        for (let i = 0; i <= 4; i++) {
            const y = klineTop + (klineHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            // 价格标签
            const price = maxPrice - ((maxPrice - minPrice) / 4) * i;
            ctx.fillStyle = COLORS.text;
            ctx.font = '9px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(price.toFixed(2), width - padding.right + 4, y + 3);
        }

        // 成交量区域分隔线
        ctx.beginPath();
        ctx.moveTo(padding.left, volTop - 2);
        ctx.lineTo(width - padding.right, volTop - 2);
        ctx.stroke();

        // MACD区域分隔线
        ctx.beginPath();
        ctx.moveTo(padding.left, macdTop - 2);
        ctx.lineTo(width - padding.right, macdTop - 2);
        ctx.stroke();

        // MACD零轴
        const macdZeroY = macdTop + macdHeight / 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, macdZeroY);
        ctx.lineTo(width - padding.right, macdZeroY);
        ctx.stroke();

        // 绘制MA线
        function drawMALine(maArr, color) {
            if (!maArr) return;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            let started = false;
            for (let i = startIdx; i < endIdx; i++) {
                if (maArr[i] !== null) {
                    const x = idxToX(i);
                    const y = priceToY(maArr[i]);
                    if (!started) {
                        ctx.moveTo(x, y);
                        started = true;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            }
            ctx.stroke();
        }

        if (indicators) {
            drawMALine(indicators.ma5, COLORS.ma5);
            drawMALine(indicators.ma10, COLORS.ma10);
            drawMALine(indicators.ma20, COLORS.ma20);
            drawMALine(indicators.ma60, COLORS.ma60);
        }

        // 绘制K线蜡烛
        visibleKlines.forEach((k, i) => {
            const x = idxToX(startIdx + i);
            const isUp = k.close >= k.open;
            const color = isUp ? COLORS.up : COLORS.down;

            // 影线
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, priceToY(k.high));
            ctx.lineTo(x, priceToY(k.low));
            ctx.stroke();

            // 实体
            const bodyTop = priceToY(Math.max(k.open, k.close));
            const bodyBottom = priceToY(Math.min(k.open, k.close));
            const bodyH = Math.max(1, bodyBottom - bodyTop);

            if (isUp) {
                ctx.fillStyle = COLORS.bg;
                ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyH);
                ctx.strokeStyle = color;
                ctx.strokeRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyH);
            } else {
                ctx.fillStyle = color;
                ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyH);
            }

            // 成交量柱
            const volY = volToY(k.volume);
            ctx.fillStyle = isUp ? COLORS.upFill : COLORS.downFill;
            ctx.fillRect(x - bodyWidth / 2, volY, bodyWidth, volTop + volHeight - volY);
        });

        // 绘制MACD
        if (indicators && indicators.macd) {
            const { DIF, DEA, MACD } = indicators.macd;

            // MACD柱
            for (let i = startIdx; i < endIdx; i++) {
                if (MACD[i] !== null) {
                    const x = idxToX(i);
                    const val = MACD[i];
                    const y = macdToY(val);
                    ctx.fillStyle = val >= 0 ? COLORS.macdUp : COLORS.macdDown;
                    const barH = Math.abs(macdToY(val) - macdZeroY);
                    if (val >= 0) {
                        ctx.fillRect(x - bodyWidth / 2, y, bodyWidth, barH);
                    } else {
                        ctx.fillRect(x - bodyWidth / 2, macdZeroY, bodyWidth, barH);
                    }
                }
            }

            // DIF线
            ctx.strokeStyle = COLORS.dif;
            ctx.lineWidth = 1;
            ctx.beginPath();
            let difStarted = false;
            for (let i = startIdx; i < endIdx; i++) {
                if (DIF[i] !== null) {
                    const x = idxToX(i);
                    const y = macdToY(DIF[i]);
                    if (!difStarted) { ctx.moveTo(x, y); difStarted = true; }
                    else ctx.lineTo(x, y);
                }
            }
            ctx.stroke();

            // DEA线
            ctx.strokeStyle = COLORS.dea;
            ctx.lineWidth = 1;
            ctx.beginPath();
            let deaStarted = false;
            for (let i = startIdx; i < endIdx; i++) {
                if (DEA[i] !== null) {
                    const x = idxToX(i);
                    const y = macdToY(DEA[i]);
                    if (!deaStarted) { ctx.moveTo(x, y); deaStarted = true; }
                    else ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }

        // 存储绘制参数供交互使用
        canvas._chartParams = {
            klines, indicators, startIdx, endIdx, visibleCount,
            padding, klineTop, klineHeight, volTop, volHeight, macdTop, macdHeight,
            minPrice, maxPrice, maxVol, maxMACD,
            candleWidth, bodyWidth, width, height,
            priceToY, volToY, macdToY, idxToX, macdZeroY
        };

        // 绑定交互事件
        bindChartInteraction(canvas);
    }

    /**
     * 绑定图表交互（十字光标）
     */
    function bindChartInteraction(canvas) {
        // 防止重复绑定
        if (canvas._bindInteraction) return;
        canvas._bindInteraction = true;

        let isDragging = false;
        let lastTouchDist = 0;

        function handleMove(clientX) {
            const rect = canvas.getBoundingClientRect();
            const x = clientX - rect.left;
            const params = canvas._chartParams;
            if (!params) return;

            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;

            // 重绘（调用drawKlineChart会重绘）
            // 这里简单处理：绘制十字光标覆盖层
            // 实际项目中应该用双缓冲或重绘
            const idx = Math.floor((x - params.padding.left) / params.candleWidth) + params.startIdx;
            if (idx < params.startIdx || idx >= params.endIdx) return;

            const k = params.klines[idx];
            const cx = params.idxToX(idx);

            // 清除旧覆盖层
            if (canvas._overlayCanvas) {
                canvas._overlayCanvas.remove();
            }

            const overlay = document.createElement('canvas');
            overlay.className = 'chart-overlay';
            overlay.style.cssText = `position:absolute;top:0;left:0;width:${params.width}px;height:${params.height}px;pointer-events:none;`;
            overlay.width = params.width * dpr;
            overlay.height = params.height * dpr;
            const octx = overlay.getContext('2d');
            octx.scale(dpr, dpr);

            canvas._overlayCanvas = overlay;
            canvas.parentElement.style.position = 'relative';
            canvas.parentElement.appendChild(overlay);

            // 垂直线
            octx.strokeStyle = COLORS.crosshair;
            octx.lineWidth = 0.5;
            octx.setLineDash([3, 3]);
            octx.beginPath();
            octx.moveTo(cx, params.klineTop);
            octx.lineTo(cx, params.macdTop + params.macdHeight);
            octx.stroke();

            // 水平线（在K线区域）
            octx.beginPath();
            octx.moveTo(params.padding.left, params.priceToY(k.close));
            octx.lineTo(params.width - params.padding.right, params.priceToY(k.close));
            octx.stroke();
            octx.setLineDash([]);

            // 数据标签
            const isUp = k.close >= k.open;
            const labelColor = isUp ? COLORS.up : COLORS.down;
            const labelText = `${k.date} 开:${k.open.toFixed(2)} 高:${k.high.toFixed(2)} 低:${k.low.toFixed(2)} 收:${k.close.toFixed(2)} 量:${formatVol(k.volume)}`;

            octx.font = '10px monospace';
            const textWidth = octx.measureText(labelText).width;
            const labelX = Math.min(cx + 4, params.width - textWidth - 60);
            const labelY = params.klineTop + 14;

            octx.fillStyle = COLORS.crosshairBg;
            octx.fillRect(labelX - 2, labelY - 10, textWidth + 4, 14);
            octx.fillStyle = labelColor;
            octx.textAlign = 'left';
            octx.fillText(labelText, labelX, labelY);

            // 价格标签（右侧）
            const priceY = params.priceToY(k.close);
            octx.fillStyle = labelColor;
            octx.fillRect(params.width - params.padding.right, priceY - 7, params.padding.right, 14);
            octx.fillStyle = '#fff';
            octx.font = '9px monospace';
            octx.textAlign = 'left';
            octx.fillText(k.close.toFixed(2), params.width - params.padding.right + 3, priceY + 3);
        }

        function clearOverlay() {
            if (canvas._overlayCanvas) {
                canvas._overlayCanvas.remove();
                canvas._overlayCanvas = null;
            }
        }

        // 鼠标事件
        canvas.addEventListener('mousemove', (e) => {
            handleMove(e.clientX);
        });

        canvas.addEventListener('mouseleave', () => {
            clearOverlay();
        });

        // 触摸事件
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                handleMove(e.touches[0].clientX);
            }
            if (e.touches.length === 2) {
                lastTouchDist = getTouchDist(e.touches);
            }
        }, { passive: true });

        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                handleMove(e.touches[0].clientX);
            }
            if (e.touches.length === 2) {
                const dist = getTouchDist(e.touches);
                const params = canvas._chartParams;
                if (params && lastTouchDist > 0) {
                    const scale = dist / lastTouchDist;
                    let newCount = Math.round(params.visibleCount / scale);
                    newCount = Math.max(10, Math.min(params.klines.length, newCount));
                    const newStart = Math.max(0, params.startIdx + params.visibleCount - newCount);
                    clearOverlay();
                    drawKlineChart(canvas, params.klines, params.indicators, {
                        startIdx: newStart,
                        visibleCount: newCount,
                        height: params.height
                    });
                }
                lastTouchDist = dist;
            }
        }, { passive: true });

        canvas.addEventListener('touchend', () => {
            lastTouchDist = 0;
            setTimeout(clearOverlay, 2000);
        });
    }

    function getTouchDist(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function formatVol(vol) {
        if (vol >= 100000000) return (vol / 100000000).toFixed(1) + '亿';
        if (vol >= 10000) return (vol / 10000).toFixed(0) + '万';
        return vol.toFixed(0);
    }

    /**
     * 绘制资金流向图
     * @param {HTMLCanvasElement} canvas
     * @param {Array} fundData - 资金流向数据
     */
    function drawFundFlowChart(canvas, fundData) {
        if (!fundData || fundData.length < 2) return;

        const container = canvas.parentElement;
        const width = container.clientWidth || 360;
        const height = 200;
        const ctx = setupCanvas(canvas, width, height);

        const padding = { top: 20, right: 50, bottom: 30, left: 4 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // 找到最大绝对值
        let maxVal = 0;
        fundData.forEach(d => {
            const absMain = Math.abs(d.mainForceNet);
            const absSmall = Math.abs(d.smallNet);
            if (absMain > maxVal) maxVal = absMain;
            if (absSmall > maxVal) maxVal = absSmall;
        });
        maxVal *= 1.2;
        if (maxVal === 0) maxVal = 1;

        const barWidth = Math.max(2, (chartWidth / fundData.length) * 0.35);
        const groupWidth = chartWidth / fundData.length;

        // 清空
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, width, height);

        // 零轴
        const zeroY = padding.top + chartHeight / 2;
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(padding.left, zeroY);
        ctx.lineTo(width - padding.right, zeroY);
        ctx.stroke();

        // 网格
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
        }

        // 绘制柱状图
        fundData.forEach((d, i) => {
            const x = padding.left + i * groupWidth + groupWidth * 0.15;

            // 主力净流入
            const mainH = (d.mainForceNet / maxVal) * (chartHeight / 2);
            ctx.fillStyle = d.mainForceNet >= 0 ? COLORS.flowMain : COLORS.flowRetail;
            if (d.mainForceNet >= 0) {
                ctx.fillRect(x, zeroY - mainH, barWidth, mainH);
            } else {
                ctx.fillRect(x, zeroY, barWidth, -mainH);
            }

            // 小单净流入
            const smallH = (d.smallNet / maxVal) * (chartHeight / 2);
            ctx.fillStyle = d.smallNet >= 0 ? COLORS.flowRetail : COLORS.flowMain;
            const smallX = x + barWidth + 2;
            if (d.smallNet >= 0) {
                ctx.fillRect(smallX, zeroY - smallH, barWidth, smallH);
            } else {
                ctx.fillRect(smallX, zeroY, barWidth, -smallH);
            }

            // 日期标签（每隔几个显示）
            if (fundData.length <= 15 || i % Math.ceil(fundData.length / 8) === 0) {
                ctx.fillStyle = COLORS.text;
                ctx.font = '8px monospace';
                ctx.textAlign = 'center';
                const dateStr = d.date ? d.date.substring(5) : '';
                ctx.fillText(dateStr, x + barWidth, height - padding.bottom + 12);
            }
        });

        // 右侧刻度
        ctx.fillStyle = COLORS.text;
        ctx.font = '8px monospace';
        ctx.textAlign = 'left';
        const formatFlow = (v) => {
            if (Math.abs(v) >= 100000000) return (v / 100000000).toFixed(1) + '亿';
            if (Math.abs(v) >= 10000) return (v / 10000).toFixed(0) + '万';
            return v.toFixed(0);
        };
        ctx.fillText(formatFlow(maxVal), width - padding.right + 4, padding.top + 8);
        ctx.fillText('0', width - padding.right + 4, zeroY + 3);
        ctx.fillText(formatFlow(-maxVal), width - padding.right + 4, height - padding.bottom);

        // 图例
        ctx.font = '9px sans-serif';
        ctx.fillStyle = COLORS.flowMain;
        ctx.fillRect(padding.left, height - 12, 8, 8);
        ctx.fillText('主力', padding.left + 12, height - 4);
        ctx.fillStyle = COLORS.flowRetail;
        ctx.fillRect(padding.left + 50, height - 12, 8, 8);
        ctx.fillText('小单', padding.left + 62, height - 4);
    }

    /**
     * 绘制北向资金流向图
     * @param {HTMLCanvasElement} canvas
     * @param {Array} flowData - 北向资金数据
     */
    function drawNorthFlowChart(canvas, flowData) {
        if (!flowData || flowData.length < 2) return;

        const container = canvas.parentElement;
        const width = container.clientWidth || 360;
        const height = 180;
        const ctx = setupCanvas(canvas, width, height);

        const padding = { top: 20, right: 50, bottom: 30, left: 4 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        let maxVal = 0;
        flowData.forEach(d => {
            const absVal = Math.abs(d.totalNet);
            if (absVal > maxVal) maxVal = absVal;
        });
        maxVal *= 1.2;
        if (maxVal === 0) maxVal = 1;

        const barWidth = Math.max(4, (chartWidth / flowData.length) * 0.6);
        const groupWidth = chartWidth / flowData.length;

        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, width, height);

        const zeroY = padding.top + chartHeight / 2;
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(padding.left, zeroY);
        ctx.lineTo(width - padding.right, zeroY);
        ctx.stroke();

        flowData.forEach((d, i) => {
            const x = padding.left + i * groupWidth + (groupWidth - barWidth) / 2;
            const h = (d.totalNet / maxVal) * (chartHeight / 2);

            ctx.fillStyle = d.totalNet >= 0 ? COLORS.flowMain : COLORS.flowRetail;
            if (d.totalNet >= 0) {
                ctx.fillRect(x, zeroY - h, barWidth, h);
            } else {
                ctx.fillRect(x, zeroY, barWidth, -h);
            }

            if (flowData.length <= 15 || i % Math.ceil(flowData.length / 8) === 0) {
                ctx.fillStyle = COLORS.text;
                ctx.font = '8px monospace';
                ctx.textAlign = 'center';
                const dateStr = d.date ? d.date.substring(5) : '';
                ctx.fillText(dateStr, x + barWidth / 2, height - padding.bottom + 12);
            }
        });

        // 刻度
        ctx.fillStyle = COLORS.text;
        ctx.font = '8px monospace';
        ctx.textAlign = 'left';
        const formatFlow = (v) => {
            if (Math.abs(v) >= 100000000) return (v / 100000000).toFixed(1) + '亿';
            if (Math.abs(v) >= 10000) return (v / 10000).toFixed(0) + '万';
            return v.toFixed(0);
        };
        ctx.fillText(formatFlow(maxVal), width - padding.right + 4, padding.top + 8);
        ctx.fillText('0', width - padding.right + 4, zeroY + 3);
        ctx.fillText(formatFlow(-maxVal), width - padding.right + 4, height - padding.bottom);
    }

    /**
     * 绘制评分仪表盘
     * @param {HTMLCanvasElement} canvas
     * @param {number} score - 评分 0-100
     */
    function drawScoreGauge(canvas, score) {
        const width = 200;
        const height = 120;
        const ctx = setupCanvas(canvas, width, height);

        const centerX = width / 2;
        const centerY = height - 10;
        const radius = 75;
        const startAngle = Math.PI;
        const endAngle = 2 * Math.PI;

        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, width, height);

        // 背景弧
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.lineWidth = 12;
        ctx.strokeStyle = COLORS.gaugeBg;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 评分弧
        const scoreAngle = startAngle + (score / 100) * Math.PI;
        let gaugeColor;
        if (score >= 70) gaugeColor = COLORS.gaugeGood;
        else if (score >= 40) gaugeColor = COLORS.gaugeWarn;
        else gaugeColor = COLORS.gaugeBad;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, scoreAngle);
        ctx.lineWidth = 12;
        ctx.strokeStyle = gaugeColor;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 评分数字
        ctx.fillStyle = gaugeColor;
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(score.toFixed(0), centerX, centerY - 8);

        // 标签
        ctx.fillStyle = COLORS.text;
        ctx.font = '10px sans-serif';
        ctx.fillText('综合评分', centerX, centerY + 6);

        // 刻度标签
        ctx.font = '9px monospace';
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'left';
        ctx.fillText('0', centerX - radius - 5, centerY + 14);
        ctx.textAlign = 'center';
        ctx.fillText('50', centerX, centerY - radius - 8);
        ctx.textAlign = 'right';
        ctx.fillText('100', centerX + radius + 5, centerY + 14);
    }

    /**
     * 绘制迷你走势图（用于智能选股卡片）
     * @param {HTMLCanvasElement} canvas
     * @param {Array} klines - K线数据
     * @param {string} period - 'day'|'week'|'month'
     */
    function drawMiniChart(canvas, klines, period = 'day') {
        if (!klines || klines.length < 5) return;

        const container = canvas.parentElement;
        const width = container.clientWidth || 300;
        const height = container.clientHeight || 50;
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        // 取最近60个数据点
        const data = klines.slice(-60);
        if (data.length < 5) return;

        // 提取收盘价
        const closes = data.map(k => k.close);
        
        // 计算价格范围
        const minPrice = Math.min(...closes);
        const maxPrice = Math.max(...closes);
        const priceRange = maxPrice - minPrice || 1;
        
        // 判断涨跌
        const firstPrice = closes[0];
        const lastPrice = closes[closes.length - 1];
        const isUp = lastPrice >= firstPrice;
        const lineColor = isUp ? COLORS.up : COLORS.down;
        const fillColor = isUp ? COLORS.upFill.replace('0.8', '0.2') : COLORS.downFill.replace('0.8', '0.2');
        
        // 计算价格百分比变化
        const changePercent = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);
        const changeText = (changePercent >= 0 ? '+' : '') + changePercent + '%';

        // 绘制区域
        const padding = { left: 4, right: 4, top: 4, bottom: 4 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // 计算每个点的位置
        const points = [];
        closes.forEach((price, i) => {
            const x = padding.left + (i / (closes.length - 1)) * chartWidth;
            const y = padding.top + (1 - (price - minPrice) / priceRange) * chartHeight;
            points.push({ x, y });
        });

        // 绘制填充区域
        ctx.beginPath();
        ctx.moveTo(points[0].x, height - padding.bottom);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();

        // 绘制线条
        ctx.beginPath();
        points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // 绘制末端点
        const lastPoint = points[points.length - 1];
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();

        // 绘制涨跌幅标签
        ctx.fillStyle = lineColor;
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(changeText, width - padding.right - 2, padding.top + 2);
    }

    /**
     * 清除画布
     */
    function clearChart(canvas) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        const width = container ? container.clientWidth : 300;
        const height = container ? container.clientHeight : 200;
        ctx.clearRect(0, 0, width, height);
    }

    return {
        drawKlineChart,
        drawFundFlowChart,
        drawNorthFlowChart,
        drawScoreGauge,
        drawMiniChart,
        clearChart,
        COLORS,
        setupCanvas
    };
})();
