/**
 * A股潜力股观察系统 - 主应用逻辑
 * 初始化、事件绑定、Tab切换、搜索、自选股、刷新
 */

const App = (() => {
    'use strict';

    // 应用状态
    const state = {
        currentTab: 'market',
        currentPage: 1,
        pageSize: 30,
        sortField: 'f3',
        sortOrder: 0,
        marketFilter: 'all',
        stocks: [],
        totalStocks: 0,
        watchlist: [],
        refreshTimer: null,
        searchTimer: null,
        techSecid: '1.600519',
        techPeriod: '101',
        capitalSecid: '1.600519',
        detailSecid: null,
        detailData: null,
        isRefreshing: false
    };

    // DOM 元素缓存
    const dom = {};

    /**
     * 初始化应用
     */
    function init() {
        cacheDom();
        loadWatchlist();
        bindEvents();
        updateMarketStatus();
        updateClock();
        setInterval(updateClock, 1000);
        setInterval(updateMarketStatus, 30000);
        loadStockList();
        startAutoRefresh();
    }

    /**
     * 缓存 DOM 元素
     */
    function cacheDom() {
        dom.marketStatus = document.getElementById('marketStatus');
        dom.headerTime = document.getElementById('headerTime');
        dom.searchInput = document.getElementById('searchInput');
        dom.searchClear = document.getElementById('searchClear');
        dom.searchResults = document.getElementById('searchResults');
        dom.stockListBody = document.getElementById('stockListBody');
        dom.sortField = document.getElementById('sortField');
        dom.sortOrderBtn = document.getElementById('sortOrderBtn');
        dom.prevPage = document.getElementById('prevPage');
        dom.nextPage = document.getElementById('nextPage');
        dom.pageInfo = document.getElementById('pageInfo');
        dom.pagination = document.getElementById('pagination');
        dom.statusDot = document.getElementById('statusDot');
        dom.statusText = document.getElementById('statusText');
        dom.lastUpdateTime = document.getElementById('lastUpdateTime');
        dom.dataSource = document.getElementById('dataSource');
        dom.stockCount = document.getElementById('stockCount');
        dom.filterResultCount = document.getElementById('filterResultCount');
        dom.filterResultBody = document.getElementById('filterResultBody');
        dom.filterSortField = document.getElementById('filterSortField');

        // 技术分析
        dom.techStockInput = document.getElementById('techStockInput');
        dom.techStockBtn = document.getElementById('techStockBtn');
        dom.techStockName = document.getElementById('techStockName');
        dom.techStockPrice = document.getElementById('techStockPrice');
        dom.techStockChange = document.getElementById('techStockChange');
        dom.klineCanvas = document.getElementById('klineCanvas');
        dom.indicatorLegend = document.getElementById('indicatorLegend');
        dom.techIndicatorsGrid = document.getElementById('techIndicatorsGrid');

        // 资金监控
        dom.capitalStockInput = document.getElementById('capitalStockInput');
        dom.capitalStockBtn = document.getElementById('capitalStockBtn');
        dom.shFlow = document.getElementById('shFlow');
        dom.szFlow = document.getElementById('szFlow');
        dom.totalFlow = document.getElementById('totalFlow');
        dom.northFlowCanvas = document.getElementById('northFlowCanvas');
        dom.mainForceFlow = document.getElementById('mainForceFlow');
        dom.superLargeFlow = document.getElementById('superLargeFlow');
        dom.largeFlow = document.getElementById('largeFlow');
        dom.mediumFlow = document.getElementById('mediumFlow');
        dom.smallFlow = document.getElementById('smallFlow');
        dom.fundFlowCanvas = document.getElementById('fundFlowCanvas');

        // 基本面筛选
        dom.runFundamentalFilter = document.getElementById('runFundamentalFilter');

        // 智能选股
        dom.runSmartPick = document.getElementById('runSmartPick');
        dom.smartLoading = document.getElementById('smartLoading');
        dom.smartResults = document.getElementById('smartResults');
        dom.smartTopPicks = document.getElementById('smartTopPicks');

        // 详情面板
        dom.detailOverlay = document.getElementById('detailOverlay');
        dom.detailPanel = document.getElementById('detailPanel');
        dom.detailClose = document.getElementById('detailClose');
        dom.detailStockName = document.getElementById('detailStockName');
        dom.detailStockCode = document.getElementById('detailStockCode');
        dom.detailPrice = document.getElementById('detailPrice');
        dom.detailChange = document.getElementById('detailChange');
        dom.detailQuoteGrid = document.getElementById('detailQuoteGrid');
        dom.detailFundamentalGrid = document.getElementById('detailFundamentalGrid');
        dom.scoreGaugeCanvas = document.getElementById('scoreGaugeCanvas');
        dom.scoreDetails = document.getElementById('scoreDetails');
        dom.detailKlineCanvas = document.getElementById('detailKlineCanvas');
        dom.detailFundFlowCanvas = document.getElementById('detailFundFlowCanvas');
        dom.btnAddWatchlist = document.getElementById('btnAddWatchlist');
        dom.watchlistBtnText = document.getElementById('watchlistBtnText');

        // 自选股
        dom.watchlistFab = document.getElementById('watchlistFab');
        dom.watchlistBadge = document.getElementById('watchlistBadge');
        dom.watchlistPanel = document.getElementById('watchlistPanel');
        dom.watchlistClose = document.getElementById('watchlistClose');
        dom.watchlistBody = document.getElementById('watchlistBody');
    }

    /**
     * 绑定事件
     */
    function bindEvents() {
        // Tab 切换
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        // 搜索
        dom.searchInput.addEventListener('input', onSearchInput);
        dom.searchClear.addEventListener('click', clearSearch);

        // 排序
        dom.sortField.addEventListener('change', () => {
            state.sortField = dom.sortField.value;
            state.currentPage = 1;
            loadStockList();
        });

        dom.sortOrderBtn.addEventListener('click', () => {
            state.sortOrder = state.sortOrder === 0 ? 1 : 0;
            dom.sortOrderBtn.textContent = state.sortOrder === 0 ? '▼' : '▲';
            state.currentPage = 1;
            loadStockList();
        });

        // 市场过滤
        document.querySelectorAll('.market-filter .filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.market-filter .filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.marketFilter = btn.dataset.market;
                state.currentPage = 1;
                loadStockList();
            });
        });

        // 分页
        dom.prevPage.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                loadStockList();
            }
        });

        dom.nextPage.addEventListener('click', () => {
            const maxPage = Math.ceil(state.totalStocks / state.pageSize);
            if (state.currentPage < maxPage) {
                state.currentPage++;
                loadStockList();
            }
        });

        // 技术分析
        dom.techStockBtn.addEventListener('click', loadTechAnalysis);
        dom.techStockInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loadTechAnalysis();
        });

        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.techPeriod = btn.dataset.period;
                loadTechAnalysis();
            });
        });

        // 资金监控
        dom.capitalStockBtn.addEventListener('click', loadCapitalFlow);
        dom.capitalStockInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loadCapitalFlow();
        });

        // 基本面筛选
        dom.runFundamentalFilter.addEventListener('click', runFundamentalScreen);
        dom.filterSortField.addEventListener('change', () => {
            // 重新排序筛选结果
            sortFilterResults();
        });

        // 智能选股
        dom.runSmartPick.addEventListener('click', runSmartPicks);
        
        // 智能选股周期切换
        document.querySelectorAll('.period-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const period = tab.dataset.period;
                state.smartPeriod = period;
                document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                // 重新渲染走势图
                if (state.smartPicks && state.smartPicks.length > 0) {
                    state.smartPicks.forEach(item => {
                        const canvas = document.getElementById(`chart-${item.stock.code}`);
                        if (canvas && item.klines && item.klines.length > 5) {
                            try {
                                Charts.drawMiniChart(canvas, item.klines, period);
                            } catch (e) {
                                console.error('重绘迷你图失败:', item.stock.code, e);
                            }
                        }
                    });
                }
            });
        });

        // 详情面板
        dom.detailOverlay.addEventListener('click', closeDetail);
        dom.detailClose.addEventListener('click', closeDetail);
        dom.btnAddWatchlist.addEventListener('click', toggleWatchlistFromDetail);

        // 自选股面板
        dom.watchlistFab.addEventListener('click', toggleWatchlistPanel);
        dom.watchlistClose.addEventListener('click', toggleWatchlistPanel);

        // 窗口大小变化时重绘图表
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (state.currentTab === 'technical') loadTechAnalysis();
                if (state.currentTab === 'capital') loadCapitalFlow();
            }, 300);
        });
    }

    /**
     * 切换 Tab
     */
    function switchTab(tabName) {
        state.currentTab = tabName;

        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab-item[data-tab="${tabName}"]`).classList.add('active');

        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${tabName}`).classList.add('active');

        // 按需加载数据
        if (tabName === 'technical') {
            setTimeout(loadTechAnalysis, 100);
        } else if (tabName === 'capital') {
            setTimeout(loadCapitalFlow, 100);
        }
    }

    /**
     * 更新市场状态
     */
    function updateMarketStatus() {
        const { status, text } = API.getMarketStatus();
        dom.marketStatus.textContent = text;
        dom.marketStatus.className = 'market-status ' + status;
    }

    /**
     * 更新时钟
     */
    function updateClock() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        dom.headerTime.textContent = `${h}:${m}:${s}`;
    }

    /**
     * 更新数据时间显示
     */
    function updateDataTime() {
        const now = new Date();
        const timeStr = now.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        if (dom.lastUpdateTime) {
            dom.lastUpdateTime.textContent = `更新时间：${timeStr}`;
        }
    }

    /**
     * 更新数据源显示
     */
    function updateDataSource() {
        if (dom.dataSource) {
            const sourceName = API.getCurrentDataSource();
            dom.dataSource.textContent = `数据来源：${sourceName}`;
        }
    }

    /**
     * 设置状态
     */
    function setStatus(text, type = 'idle') {
        dom.statusText.textContent = text;
        dom.statusDot.className = 'status-dot ' + type;
    }

    /**
     * 加载股票列表
     */
    async function loadStockList() {
        setStatus('加载中...', 'loading');
        dom.stockListBody.innerHTML = '<tr class="loading-row"><td colspan="5">加载中...</td></tr>';

        try {
            const result = await API.fetchStockList(
                state.currentPage,
                state.pageSize,
                state.sortField,
                state.sortOrder,
                state.marketFilter
            );

            state.stocks = result.stocks;
            state.totalStocks = result.total;

            renderStockList();
            updatePagination();
            updateStockCount();
            updateDataTime();
            updateDataSource();
            setStatus('就绪', 'online');
        } catch (e) {
            dom.stockListBody.innerHTML = '<tr class="loading-row"><td colspan="5">加载失败，请重试</td></tr>';
            setStatus('加载失败', 'idle');
        }
    }

    /**
     * 渲染股票列表
     */
    function renderStockList() {
        if (state.stocks.length === 0) {
            dom.stockListBody.innerHTML = '<tr class="loading-row"><td colspan="5">暂无数据</td></tr>';
            return;
        }

        dom.stockListBody.innerHTML = state.stocks.map(stock => {
            const priceClass = API.getPriceClass(stock.changePercent);
            const changeText = stock.changePercent != null ? API.formatPercent(stock.changePercent) : '--';
            const priceText = stock.price != null ? stock.price.toFixed(2) : '--';
            const amountText = API.formatAmount(stock.turnover);

            return `
                <tr data-secid="${stock.marketCode || ''}" data-code="${stock.code}" data-name="${stock.name}">
                    <td class="col-name">
                        <div class="stock-name-cell">
                            <span class="stock-name-text">${escapeHtml(stock.name)}</span>
                            <span class="stock-code-text">${stock.code}</span>
                        </div>
                    </td>
                    <td class="col-code" style="display:none;">${stock.code}</td>
                    <td class="col-price ${priceClass}">${priceText}</td>
                    <td class="col-change ${priceClass}">${changeText}</td>
                    <td class="col-vol">${amountText}</td>
                </tr>
            `;
        }).join('');

        // 绑定点击事件
        dom.stockListBody.querySelectorAll('tr[data-secid]').forEach(row => {
            row.addEventListener('click', () => {
                const secid = row.dataset.secid;
                if (secid) openDetail(secid, row.dataset.name, row.dataset.code);
            });
        });
    }

    /**
     * 更新分页
     */
    function updatePagination() {
        const maxPage = Math.ceil(state.totalStocks / state.pageSize);
        dom.pageInfo.textContent = `${state.currentPage}/${maxPage}`;
        dom.prevPage.disabled = state.currentPage <= 1;
        dom.nextPage.disabled = state.currentPage >= maxPage;
    }

    /**
     * 更新股票数量
     */
    function updateStockCount() {
        dom.stockCount.textContent = `共 ${state.totalStocks} 只`;
    }

    /**
     * 搜索输入
     */
    function onSearchInput() {
        const keyword = dom.searchInput.value.trim();
        dom.searchClear.style.display = keyword ? 'block' : 'none';

        clearTimeout(state.searchTimer);
        if (keyword.length === 0) {
            dom.searchResults.style.display = 'none';
            return;
        }

        state.searchTimer = setTimeout(async () => {
            const results = await API.searchStock(keyword);
            renderSearchResults(results);
        }, 300);
    }

    /**
     * 渲染搜索结果
     */
    function renderSearchResults(results) {
        if (!results || results.length === 0) {
            dom.searchResults.style.display = 'none';
            return;
        }

        dom.searchResults.innerHTML = results.map(item => `
            <div class="search-result-item" data-secid="${item.secid}" data-name="${item.name}" data-code="${item.code}">
                <div>
                    <div class="search-result-name">${escapeHtml(item.name)}</div>
                    <div class="search-result-code">${item.code} ${item.market}</div>
                </div>
                <div class="search-result-price">
                    点击查看
                </div>
            </div>
        `).join('');

        dom.searchResults.style.display = 'block';

        dom.searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const secid = item.dataset.secid;
                dom.searchResults.style.display = 'none';
                dom.searchInput.value = '';
                dom.searchClear.style.display = 'none';
                openDetail(secid, item.dataset.name, item.dataset.code);
            });
        });
    }

    /**
     * 清除搜索
     */
    function clearSearch() {
        dom.searchInput.value = '';
        dom.searchClear.style.display = 'none';
        dom.searchResults.style.display = 'none';
    }

    /**
     * 加载技术分析
     */
    async function loadTechAnalysis() {
        const secid = dom.techStockInput.value.trim();
        if (!secid) return;

        state.techSecid = secid;

        // 获取K线数据
        setStatus('加载K线数据...', 'loading');
        const klines = await API.fetchKline(secid, state.techPeriod, 120);

        if (!klines || klines.length < 5) {
            dom.techStockName.textContent = '数据不足';
            return;
        }

        // 获取股票基本信息
        const detail = await API.fetchStockDetail(secid);
        if (detail) {
            dom.techStockName.textContent = detail.name;
            dom.techStockPrice.textContent = detail.price != null ? detail.price.toFixed(2) : '--';
            dom.techStockPrice.className = API.getPriceClass(detail.changePercent);
            dom.techStockChange.textContent = detail.changePercent != null ? API.formatPercent(detail.changePercent) : '--';
            dom.techStockChange.className = API.getPriceClass(detail.changePercent);
        }

        // 计算指标
        const indicators = Indicators.calcAll(klines);
        const latest = Indicators.getLatestIndicators(klines);

        // 绘制简化版迷你走势图（不卡）
        Charts.drawMiniChart(dom.klineCanvas, klines, 'day');

        // 更新图例（简化）
        dom.indicatorLegend.innerHTML = '<span class="legend-item" style="color:#58a6ff;">走势图</span>';

        // 更新技术指标概览
        updateTechSummary(latest);

        setStatus('就绪', 'online');
    }

    /**
     * 更新指标图例
     */
    function updateIndicatorLegend(latest) {
        if (!latest) return;
        dom.indicatorLegend.innerHTML = `
            <span class="legend-item" style="color:#f5c842;">MA5: ${latest.ma5 ? latest.ma5.toFixed(2) : '--'}</span>
            <span class="legend-item" style="color:#4dc9f6;">MA10: ${latest.ma10 ? latest.ma10.toFixed(2) : '--'}</span>
            <span class="legend-item" style="color:#f67280;">MA20: ${latest.ma20 ? latest.ma20.toFixed(2) : '--'}</span>
            <span class="legend-item" style="color:#a78bfa;">MA60: ${latest.ma60 ? latest.ma60.toFixed(2) : '--'}</span>
        `;
    }

    /**
     * 更新技术指标概览
     */
    function updateTechSummary(latest) {
        if (!latest) return;

        const items = [];

        // MACD
        items.push({
            label: 'MACD',
            value: latest.macd != null ? latest.macd.toFixed(3) : '--',
            signal: latest.dif != null && latest.dea != null
                ? (latest.dif > latest.dea ? '多头' : '空头')
                : '--',
            signalClass: latest.dif != null && latest.dea != null
                ? (latest.dif > latest.dea ? 'signal-bullish' : 'signal-bearish')
                : 'signal-neutral'
        });

        // DIF
        items.push({
            label: 'DIF',
            value: latest.dif != null ? latest.dif.toFixed(3) : '--',
            signal: latest.prevDif != null
                ? (latest.dif > latest.prevDif ? '上升' : '下降')
                : '--',
            signalClass: latest.prevDif != null
                ? (latest.dif > latest.prevDif ? 'signal-bullish' : 'signal-bearish')
                : 'signal-neutral'
        });

        // KDJ
        items.push({
            label: 'KDJ',
            value: latest.k != null ? `K:${latest.k.toFixed(1)} D:${latest.d.toFixed(1)} J:${latest.j.toFixed(1)}` : '--',
            signal: latest.j != null
                ? (latest.j < 20 ? '超卖' : latest.j > 80 ? '超买' : '中性')
                : '--',
            signalClass: latest.j != null
                ? (latest.j < 20 ? 'signal-bullish' : latest.j > 80 ? 'signal-bearish' : 'signal-neutral')
                : 'signal-neutral'
        });

        // RSI
        items.push({
            label: 'RSI(14)',
            value: latest.rsi14 != null ? latest.rsi14.toFixed(1) : '--',
            signal: latest.rsi14 != null
                ? (latest.rsi14 < 30 ? '超卖' : latest.rsi14 > 70 ? '超买' : '中性')
                : '--',
            signalClass: latest.rsi14 != null
                ? (latest.rsi14 < 30 ? 'signal-bullish' : latest.rsi14 > 70 ? 'signal-bearish' : 'signal-neutral')
                : 'signal-neutral'
        });

        // RSI(6)
        items.push({
            label: 'RSI(6)',
            value: latest.rsi6 != null ? latest.rsi6.toFixed(1) : '--',
            signal: latest.rsi6 != null
                ? (latest.rsi6 < 20 ? '超卖' : latest.rsi6 > 80 ? '超买' : '中性')
                : '--',
            signalClass: latest.rsi6 != null
                ? (latest.rsi6 < 20 ? 'signal-bullish' : latest.rsi6 > 80 ? 'signal-bearish' : 'signal-neutral')
                : 'signal-neutral'
        });

        // 布林带
        items.push({
            label: 'BOLL',
            value: latest.bollUpper != null
                ? `${latest.bollUpper.toFixed(2)}/${latest.bollMiddle.toFixed(2)}/${latest.bollLower.toFixed(2)}`
                : '--',
            signal: '--',
            signalClass: 'signal-neutral'
        });

        dom.techIndicatorsGrid.innerHTML = items.map(item => `
            <div class="tech-indicator-card">
                <div class="tech-indicator-label">${item.label}</div>
                <div class="tech-indicator-value">${item.value}</div>
                <div class="tech-indicator-signal ${item.signalClass}">${item.signal}</div>
            </div>
        `).join('');
    }

    /**
     * 加载资金监控
     */
    async function loadCapitalFlow() {
        setStatus('加载资金数据...', 'loading');

        // 加载北向资金
        const northFlow = await API.fetchNorthFlow();
        if (northFlow && northFlow.latest) {
            dom.shFlow.textContent = formatFlowValue(northFlow.shNet);
            dom.shFlow.className = 'flow-value ' + API.getPriceClass(northFlow.shNet);
            dom.szFlow.textContent = formatFlowValue(northFlow.szNet);
            dom.szFlow.className = 'flow-value ' + API.getPriceClass(northFlow.szNet);
            dom.totalFlow.textContent = formatFlowValue(northFlow.totalNet);
            dom.totalFlow.className = 'flow-value ' + API.getPriceClass(northFlow.totalNet);

            Charts.drawNorthFlowChart(dom.northFlowCanvas, northFlow.flowData);
        }

        // 加载个股资金流向
        const secid = dom.capitalStockInput.value.trim();
        if (secid) {
            state.capitalSecid = secid;
            const fundFlow = await API.fetchFundFlow(secid);

            if (fundFlow) {
                const latest = fundFlow.flowData.length > 0 ? fundFlow.flowData[fundFlow.flowData.length - 1] : null;
                if (latest) {
                    dom.mainForceFlow.textContent = formatFlowValue(latest.mainForceNet);
                    dom.mainForceFlow.className = 'flow-value ' + API.getPriceClass(latest.mainForceNet);
                    dom.superLargeFlow.textContent = formatFlowValue(latest.superLargeNet);
                    dom.superLargeFlow.className = 'flow-value ' + API.getPriceClass(latest.superLargeNet);
                    dom.largeFlow.textContent = formatFlowValue(latest.largeNet);
                    dom.largeFlow.className = 'flow-value ' + API.getPriceClass(latest.largeNet);
                    dom.mediumFlow.textContent = formatFlowValue(latest.mediumNet);
                    dom.mediumFlow.className = 'flow-value ' + API.getPriceClass(latest.mediumNet);
                    dom.smallFlow.textContent = formatFlowValue(latest.smallNet);
                    dom.smallFlow.className = 'flow-value ' + API.getPriceClass(latest.smallNet);
                }

                Charts.drawFundFlowChart(dom.fundFlowCanvas, fundFlow.flowData);
            }
        }

        setStatus('就绪', 'online');
    }

    /**
     * 格式化资金流向值
     */
    function formatFlowValue(value) {
        if (value == null) return '--';
        const abs = Math.abs(value);
        const sign = value >= 0 ? '+' : '';
        if (abs >= 100000000) return sign + (value / 100000000).toFixed(2) + '亿';
        if (abs >= 10000) return sign + (value / 10000).toFixed(0) + '万';
        return sign + value.toFixed(0);
    }

    /**
     * 运行基本面筛选
     */
    async function runFundamentalScreen() {
        setStatus('筛选中...', 'loading');
        dom.filterResultBody.innerHTML = '<tr class="loading-row"><td colspan="5">正在筛选...</td></tr>';

        const filters = {
            peMin: parseFloat(document.getElementById('peMin').value) || null,
            peMax: parseFloat(document.getElementById('peMax').value) || null,
            pbMin: parseFloat(document.getElementById('pbMin').value) || null,
            pbMax: parseFloat(document.getElementById('pbMax').value) || null,
            roeMin: parseFloat(document.getElementById('roeMin').value) || null,
            roeMax: parseFloat(document.getElementById('roeMax').value) || null,
            revGrowthMin: parseFloat(document.getElementById('revGrowthMin').value) || null,
            revGrowthMax: parseFloat(document.getElementById('revGrowthMax').value) || null,
            mcapMin: parseFloat(document.getElementById('mcapMin').value) || null,
            mcapMax: parseFloat(document.getElementById('mcapMax').value) || null
        };

        try {
            // 获取更多数据用于筛选（多页）
            let allStocks = [];
            const pagesToFetch = 5;
            const promises = [];
            for (let i = 1; i <= pagesToFetch; i++) {
                promises.push(API.fetchStockList(i, 100, 'f3', 0, 'all'));
            }

            const results = await Promise.all(promises);
            results.forEach(r => {
                allStocks = allStocks.concat(r.stocks);
            });

            // 去重
            const seen = new Set();
            allStocks = allStocks.filter(s => {
                if (seen.has(s.code)) return false;
                seen.add(s.code);
                return true;
            });

            // 筛选
            const filtered = Screener.screenByFundamentals(allStocks, filters);

            // 评分
            const scored = filtered.map(stock => {
                const result = Screener.calculateCompositeScore(stock);
                return { stock, ...result };
            }).sort((a, b) => b.score - a.score);

            // 存储筛选结果
            state.filterResults = scored;

            renderFilterResults(scored);
            setStatus('就绪', 'online');
        } catch (e) {
            dom.filterResultBody.innerHTML = '<tr class="loading-row"><td colspan="5">筛选失败，请重试</td></tr>';
            setStatus('筛选失败', 'idle');
        }
    }

    /**
     * 渲染筛选结果
     */
    function renderFilterResults(results) {
        dom.filterResultCount.textContent = results.length;

        if (results.length === 0) {
            dom.filterResultBody.innerHTML = '<tr class="loading-row"><td colspan="5">没有符合条件的结果</td></tr>';
            return;
        }

        dom.filterResultBody.innerHTML = results.slice(0, 100).map(item => {
            const stock = item.stock;
            const priceClass = API.getPriceClass(stock.changePercent);
            const changeText = stock.changePercent != null ? API.formatPercent(stock.changePercent) : '--';
            const priceText = stock.price != null ? stock.price.toFixed(2) : '--';
            const scoreColor = item.score >= 70 ? 'text-up' : item.score >= 40 ? 'text-accent' : 'text-down';

            return `
                <tr data-secid="${stock.marketCode || ''}" data-code="${stock.code}" data-name="${stock.name}">
                    <td class="col-name">
                        <div class="stock-name-cell">
                            <span class="stock-name-text">${escapeHtml(stock.name)}</span>
                            <span class="stock-code-text">${stock.code}</span>
                        </div>
                    </td>
                    <td class="col-code" style="display:none;">${stock.code}</td>
                    <td class="col-price ${priceClass}">${priceText}</td>
                    <td class="col-change ${priceClass}">${changeText}</td>
                    <td class="col-score ${scoreColor}">${item.score}</td>
                </tr>
            `;
        }).join('');

        dom.filterResultBody.querySelectorAll('tr[data-secid]').forEach(row => {
            row.addEventListener('click', () => {
                const secid = row.dataset.secid;
                if (secid) openDetail(secid, row.dataset.name, row.dataset.code);
            });
        });
    }

    /**
     * 排序筛选结果
     */
    function sortFilterResults() {
        if (!state.filterResults) return;

        const field = dom.filterSortField.value;
        const sorted = [...state.filterResults].sort((a, b) => {
            switch (field) {
                case 'score': return b.score - a.score;
                case 'pe': return (a.stock.pe || 999) - (b.stock.pe || 999);
                case 'pb': return (a.stock.pb || 999) - (b.stock.pb || 999);
                case 'roe': return (b.stock.roe || 0) - (a.stock.roe || 0);
                case 'revGrowth': return (b.stock.revenueGrowth || 0) - (a.stock.revenueGrowth || 0);
                case 'change': return (b.stock.changePercent || 0) - (a.stock.changePercent || 0);
                default: return 0;
            }
        });

        renderFilterResults(sorted);
    }

    /**
     * 运行智能选股 - 优化版带进度显示
     */
    async function runSmartPicks() {
        dom.smartLoading.style.display = 'flex';
        dom.smartResults.style.display = 'none';
        setStatus('智能选股分析中...', 'loading');

        try {
            // 获取涨幅榜前160只股票（减少数量，从240减到160）
            const promises = [];
            for (let i = 1; i <= 2; i++) {
                promises.push(API.fetchStockList(i, 80, 'f6', 0, 'all'));
            }

            const results = await Promise.all(promises);
            let allStocks = [];
            results.forEach(r => {
                allStocks = allStocks.concat(r.stocks);
            });

            // 去重
            const seen = new Set();
            allStocks = allStocks.filter(s => {
                if (seen.has(s.code)) return false;
                seen.add(s.code);
                return true;
            });

            // 智能选股，带进度回调
            const picks = await Screener.getSmartPicks(allStocks, 10, (current, total) => {
                const progress = Math.round((current / total) * 100);
                setStatus(`智能选股分析中... ${progress}%`, 'loading');
            });

            renderSmartPicks(picks);
            dom.smartLoading.style.display = 'none';
            dom.smartResults.style.display = 'block';
            setStatus('就绪', 'online');
        } catch (e) {
            console.error('智能选股失败:', e);
            dom.smartLoading.style.display = 'none';
            dom.smartResults.style.display = 'block';
            dom.smartTopPicks.innerHTML = '<p style="text-align:center;color:#8b949e;padding:20px;">分析失败，请重试</p>';
            setStatus('分析失败', 'idle');
        }
    }

    /**
     * 渲染智能选股结果
     */
    function renderSmartPicks(picks) {
        if (!picks || picks.length === 0) {
            dom.smartTopPicks.innerHTML = '<p style="text-align:center;color:#8b949e;padding:20px;">未找到符合条件的股票</p>';
            return;
        }

        // 保存当前选股结果用于周期切换
        state.smartPicks = picks;

        dom.smartTopPicks.innerHTML = picks.map((item, idx) => {
            const stock = item.stock;
            const priceClass = API.getPriceClass(stock.changePercent);
            const scoreColor = item.score >= 70 ? '#22c55e' : item.score >= 40 ? '#3b82f6' : '#ef4444';
            const rank = idx + 1;
            const rankLabel = rank <= 3 ? ['🥇', '🥈', '🥉'][idx] : `#${rank}`;

            const reasonsHtml = (item.reasons || []).slice(0, 4).map(r =>
                `<span class="smart-pick-reason ${r.type}">${escapeHtml(r.text)}</span>`
            ).join('');

            // 完整数据展示
            const price = stock.price != null ? stock.price.toFixed(2) : '--';
            const changePercent = stock.changePercent != null ? API.formatPercent(stock.changePercent) : '--';
            const changeAmount = stock.changeAmount != null ? (stock.changeAmount > 0 ? '+' : '') + stock.changeAmount.toFixed(2) : '--';
            
            // 基本面数据
            const peValue = stock.pe != null ? (stock.pe > 0 ? stock.pe.toFixed(1) : '亏损') : '--';
            const pbValue = stock.pb != null ? stock.pb.toFixed(2) : '--';
            const turnoverValue = stock.turnoverRate != null ? stock.turnoverRate.toFixed(2) + '%' : '--';
            const volumeRatioValue = stock.volumeRatio != null ? stock.volumeRatio.toFixed(2) : '--';
            
            // 市值和流通
            const marketCap = API.formatMarketCap(stock.totalMarketCap);
            const circulatingCap = API.formatMarketCap(stock.circulatingMarketCap || stock.totalMarketCap * 0.7);
            
            // 主力净流入
            const mainForceFlow = stock.mainForceNetInflow || 0;
            const flowText = mainForceFlow >= 100000000 ? (mainForceFlow / 100000000).toFixed(2) + '亿' : 
                            mainForceFlow >= 10000 ? (mainForceFlow / 10000).toFixed(0) + '万' : 
                            mainForceFlow > 0 ? mainForceFlow.toFixed(0) : '0';
            const flowClass = mainForceFlow > 0 ? 'up' : mainForceFlow < 0 ? 'down' : '';
            
            // 颜色标注
            const peColor = stock.pe != null ? (stock.pe < 15 ? 'highlight-up' : stock.pe > 40 ? 'highlight-down' : '') : '';
            const turnoverColor = stock.turnoverRate != null ? (stock.turnoverRate > 5 ? 'highlight-up' : stock.turnoverRate < 1 ? 'highlight-down' : '') : '';
            const volumeColor = stock.volumeRatio != null ? (stock.volumeRatio > 2 ? 'highlight-up' : stock.volumeRatio < 0.8 ? 'highlight-down' : '') : '';

            // 构建secid
            const secid = stock.secid || (stock.code?.startsWith('6') ? `1.${stock.code}` : `0.${stock.code}`);

            return `
                <div class="smart-pick-card" data-secid="${secid}" data-code="${stock.code}" data-name="${stock.name}" data-idx="${idx}">
                    <!-- 头部：排名、名称、代码、评分 -->
                    <div class="smart-pick-header">
                        <div class="smart-pick-title">
                            <span class="smart-pick-rank">${rankLabel}</span>
                            <span class="smart-pick-name">${escapeHtml(stock.name)}</span>
                            <span class="smart-pick-code">${stock.code}</span>
                        </div>
                        <div class="smart-pick-score-wrap">
                            <span class="smart-pick-score-label">综合评分</span>
                            <span class="smart-pick-score" style="color:${scoreColor}">${item.score}</span>
                        </div>
                    </div>
                    
                    <!-- 价格信息行 -->
                    <div class="smart-pick-price-section">
                        <div class="smart-pick-main-price">
                            <span class="smart-pick-price ${priceClass}">${price}</span>
                            <span class="smart-pick-change ${priceClass}">${changePercent}</span>
                            <span class="smart-pick-change-amount ${priceClass}">${changeAmount}</span>
                        </div>
                        <div class="smart-pick-market-cap">
                            <div>总市值: ${marketCap}</div>
                            <div>流通市值: ${circulatingCap}</div>
                        </div>
                    </div>
                    
                    <!-- 核心指标网格 -->
                    <div class="smart-pick-metrics-grid">
                        <div class="smart-pick-metric">
                            <span class="smart-pick-metric-label">市盈率 PE</span>
                            <span class="smart-pick-metric-value ${peColor}">${peValue}</span>
                        </div>
                        <div class="smart-pick-metric">
                            <span class="smart-pick-metric-label">市净率 PB</span>
                            <span class="smart-pick-metric-value">${pbValue}</span>
                        </div>
                        <div class="smart-pick-metric">
                            <span class="smart-pick-metric-label">换手率</span>
                            <span class="smart-pick-metric-value ${turnoverColor}">${turnoverValue}</span>
                        </div>
                        <div class="smart-pick-metric">
                            <span class="smart-pick-metric-label">量比</span>
                            <span class="smart-pick-metric-value ${volumeColor}">${volumeRatioValue}</span>
                        </div>
                        <div class="smart-pick-metric">
                            <span class="smart-pick-metric-label">主力净流入</span>
                            <span class="smart-pick-metric-value ${flowClass}">${flowText}</span>
                        </div>
                        <div class="smart-pick-metric">
                            <span class="smart-pick-metric-label">成交额</span>
                            <span class="smart-pick-metric-value">${API.formatAmount(stock.turnover || 0)}</span>
                        </div>
                    </div>
                    
                    <!-- 迷你走势图 -->
                    <div class="smart-pick-chart-container">
                        <canvas id="chart-${stock.code}" class="smart-pick-chart-canvas"></canvas>
                        <div class="smart-pick-chart-label">近60日走势</div>
                    </div>
                    
                    <!-- 选股理由标签 -->
                    <div class="smart-pick-reasons">${reasonsHtml}</div>
                    
                    <!-- 四维评分 -->
                    <div class="smart-pick-dimension-scores">
                        <div class="smart-pick-dimension">
                            <div class="smart-pick-dimension-bar" style="width:${item.techScore}%;background:${getScoreColor(item.techScore)}"></div>
                            <span class="smart-pick-dimension-label">技术 ${item.techScore}</span>
                        </div>
                        <div class="smart-pick-dimension">
                            <div class="smart-pick-dimension-bar" style="width:${item.fundScore}%;background:${getScoreColor(item.fundScore)}"></div>
                            <span class="smart-pick-dimension-label">基本面 ${item.fundScore}</span>
                        </div>
                        <div class="smart-pick-dimension">
                            <div class="smart-pick-dimension-bar" style="width:${item.capitalScore}%;background:${getScoreColor(item.capitalScore)}"></div>
                            <span class="smart-pick-dimension-label">资金 ${item.capitalScore}</span>
                        </div>
                        <div class="smart-pick-dimension">
                            <div class="smart-pick-dimension-bar" style="width:${item.momentumScore}%;background:${getScoreColor(item.momentumScore)}"></div>
                            <span class="smart-pick-dimension-label">动量 ${item.momentumScore}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // 绑定点击事件
        dom.smartTopPicks.querySelectorAll('.smart-pick-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // 如果点击的是canvas，不触发详情
                if (e.target.tagName === 'CANVAS') return;
                const secid = card.dataset.secid;
                if (secid) openDetail(secid, card.dataset.name, card.dataset.code);
            });
        });

        // 绘制迷你走势图
        requestAnimationFrame(() => {
            picks.forEach((item, idx) => {
                const canvas = document.getElementById(`chart-${item.stock.code}`);
                if (canvas && item.klines && item.klines.length > 5) {
                    try {
                        Charts.drawMiniChart(canvas, item.klines, state.smartPeriod || 'day');
                    } catch (e) {
                        console.error('绘制迷你图失败:', item.stock.code, e);
                    }
                }
            });
        });
    }

    // 辅助函数：根据分数获取颜色
    function getScoreColor(score) {
        if (score >= 70) return '#22c55e';
        if (score >= 50) return '#3b82f6';
        if (score >= 30) return '#f59e0b';
        return '#ef4444';
    }

    /**
     * 打开股票详情面板
     */
    async function openDetail(secid, name, code) {
        state.detailSecid = secid;
        dom.detailPanel.classList.add('show');
        dom.detailOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';

        dom.detailStockName.textContent = name || '加载中...';
        dom.detailStockCode.textContent = code || secid;
        dom.detailPrice.textContent = '--';
        dom.detailChange.textContent = '--';

        // 更新自选按钮状态
        updateWatchlistButton(secid);

        try {
            // 获取详情
            const detail = await API.fetchStockDetail(secid);
            if (detail) {
                state.detailData = detail;
                dom.detailStockName.textContent = detail.name;
                dom.detailStockCode.textContent = detail.code;

                dom.detailPrice.textContent = detail.price != null ? detail.price.toFixed(2) : '--';
                dom.detailPrice.className = 'detail-price ' + API.getPriceClass(detail.changePercent);
                dom.detailChange.textContent = detail.changePercent != null
                    ? `${API.formatPercent(detail.changePercent)} (${detail.changeAmount != null ? (detail.changeAmount > 0 ? '+' : '') + detail.changeAmount.toFixed(2) : ''})`
                    : '--';
                dom.detailChange.className = 'detail-change ' + API.getPriceClass(detail.changePercent);

                // 行情数据
                dom.detailQuoteGrid.innerHTML = `
                    <div class="detail-grid-item">
                        <span class="detail-grid-label">今开</span>
                        <span class="detail-grid-value">${detail.open != null ? detail.open.toFixed(2) : '--'}</span>
                    </div>
                    <div class="detail-grid-item">
                        <span class="detail-grid-label">最高</span>
                        <span class="detail-grid-value ${API.getPriceClass(1)}">${detail.high != null ? detail.high.toFixed(2) : '--'}</span>
                    </div>
                    <div class="detail-grid-item">
                        <span class="detail-grid-label">最低</span>
                        <span class="detail-grid-value ${API.getPriceClass(-1)}">${detail.low != null ? detail.low.toFixed(2) : '--'}</span>
                    </div>
                    <div class="detail-grid-item">
                        <span class="detail-grid-label">昨收</span>
                        <span class="detail-grid-value">${detail.prevClose != null ? detail.prevClose.toFixed(2) : '--'}</span>
                    </div>
                    <div class="detail-grid-item">
                        <span class="detail-grid-label">成交量</span>
                        <span class="detail-grid-value">${API.formatAmount(detail.volume)}</span>
                    </div>
                    <div class="detail-grid-item">
                        <span class="detail-grid-label">成交额</span>
                        <span class="detail-grid-value">${API.formatAmount(detail.turnover)}</span>
                    </div>
                    <div class="detail-grid-item">
                        <span class="detail-grid-label">换手率</span>
                        <span class="detail-grid-value">${detail.turnoverRate != null ? detail.turnoverRate.toFixed(2) + '%' : '--'}</span>
                    </div>
                    <div class="detail-grid-item">
                        <span class="detail-grid-label">量比</span>
                        <span class="detail-grid-value">${detail.volumeRatio || '--'}</span>
                    </div>
                `;

                // 基本面数据
                dom.detailFundamentalGrid.innerHTML = `
                    <div class="detail-grid-item">
                        <span class="detail-grid-label">市盈率 PE</span>
                        <span class="detail-grid-value">${detail.pe != null ? detail.pe.toFixed(2) : '--'}</span>
                    </div>
                    <div class="detail-grid-item">
                        <span class="detail-grid-label">市净率 PB</span>
                        <span class="detail-grid-value">${detail.pb != null ? detail.pb.toFixed(2) : '--'}</span>
                    </div>
                    <div class="detail-grid-item">
                        <span class="detail-grid-label">ROE</span>
                        <span class="detail-grid-value">${detail.roe != null ? detail.roe.toFixed(2) + '%' : '--'}</span>
                    </div>
                    <div class="detail-grid-item">
                        <span class="detail-grid-label">EPS</span>
                        <span class="detail-grid-value">${detail.eps != null ? detail.eps.toFixed(2) : '--'}</span>
                    </div>
                    <div class="detail-grid-item">
                        <span class="detail-grid-label">营收增长</span>
                        <span class="detail-grid-value ${API.getPriceClass(detail.revenueGrowth)}">${detail.revenueGrowth != null ? API.formatPercent(detail.revenueGrowth) : '--'}</span>
                    </div>
                    <div class="detail-grid-item">
                        <span class="detail-grid-label">利润增长</span>
                        <span class="detail-grid-value ${API.getPriceClass(detail.profitGrowth)}">${detail.profitGrowth != null ? API.formatPercent(detail.profitGrowth) : '--'}</span>
                    </div>
                    <div class="detail-grid-item">
                        <span class="detail-grid-label">总市值</span>
                        <span class="detail-grid-value">${API.formatMarketCap(detail.totalMarketCap)}</span>
                    </div>
                    <div class="detail-grid-item">
                        <span class="detail-grid-label">流通市值</span>
                        <span class="detail-grid-value">${API.formatMarketCap(detail.circulatingMarketCap)}</span>
                    </div>
                `;

                // 计算评分
                const scoreResult = Screener.calculateCompositeScore(detail);
                Charts.drawScoreGauge(dom.scoreGaugeCanvas, scoreResult.score);

                dom.scoreDetails.innerHTML = `
                    <div class="score-detail-item">
                        <span class="score-detail-label">技术面 (30%)</span>
                        <span class="score-detail-value">${scoreResult.techScore}</span>
                        <div class="score-detail-bar"><div class="score-detail-bar-fill" style="width:${scoreResult.techScore}%;background:${getScoreColor(scoreResult.techScore)}"></div></div>
                    </div>
                    <div class="score-detail-item">
                        <span class="score-detail-label">基本面 (30%)</span>
                        <span class="score-detail-value">${scoreResult.fundScore}</span>
                        <div class="score-detail-bar"><div class="score-detail-bar-fill" style="width:${scoreResult.fundScore}%;background:${getScoreColor(scoreResult.fundScore)}"></div></div>
                    </div>
                    <div class="score-detail-item">
                        <span class="score-detail-label">资金面 (25%)</span>
                        <span class="score-detail-value">${scoreResult.capitalScore}</span>
                        <div class="score-detail-bar"><div class="score-detail-bar-fill" style="width:${scoreResult.capitalScore}%;background:${getScoreColor(scoreResult.capitalScore)}"></div></div>
                    </div>
                    <div class="score-detail-item">
                        <span class="score-detail-label">动量 (15%)</span>
                        <span class="score-detail-value">${scoreResult.momentumScore}</span>
                        <div class="score-detail-bar"><div class="score-detail-bar-fill" style="width:${scoreResult.momentumScore}%;background:${getScoreColor(scoreResult.momentumScore)}"></div></div>
                    </div>
                `;
            }

            // 获取K线并绘制
            const klines = await API.fetchKline(secid, '101', 120);
            if (klines && klines.length >= 5) {
                const indicators = Indicators.calcAll(klines);
                Charts.drawKlineChart(dom.detailKlineCanvas, klines, indicators, { height: 360 });

                // 重新计算带技术指标的评分
                if (detail) {
                    const latest = Indicators.getLatestIndicators(klines);
                    const fundFlow = await API.fetchFundFlow(secid);
                    const scoreResult = Screener.calculateCompositeScore(detail, latest, fundFlow);
                    Charts.drawScoreGauge(dom.scoreGaugeCanvas, scoreResult.score);

                    dom.scoreDetails.innerHTML = `
                        <div class="score-detail-item">
                            <span class="score-detail-label">技术面 (30%)</span>
                            <span class="score-detail-value">${scoreResult.techScore}</span>
                            <div class="score-detail-bar"><div class="score-detail-bar-fill" style="width:${scoreResult.techScore}%;background:${getScoreColor(scoreResult.techScore)}"></div></div>
                        </div>
                        <div class="score-detail-item">
                            <span class="score-detail-label">基本面 (30%)</span>
                            <span class="score-detail-value">${scoreResult.fundScore}</span>
                            <div class="score-detail-bar"><div class="score-detail-bar-fill" style="width:${scoreResult.fundScore}%;background:${getScoreColor(scoreResult.fundScore)}"></div></div>
                        </div>
                        <div class="score-detail-item">
                            <span class="score-detail-label">资金面 (25%)</span>
                            <span class="score-detail-value">${scoreResult.capitalScore}</span>
                            <div class="score-detail-bar"><div class="score-detail-bar-fill" style="width:${scoreResult.capitalScore}%;background:${getScoreColor(scoreResult.capitalScore)}"></div></div>
                        </div>
                        <div class="score-detail-item">
                            <span class="score-detail-label">动量 (15%)</span>
                            <span class="score-detail-value">${scoreResult.momentumScore}</span>
                            <div class="score-detail-bar"><div class="score-detail-bar-fill" style="width:${scoreResult.momentumScore}%;background:${getScoreColor(scoreResult.momentumScore)}"></div></div>
                        </div>
                    `;
                }
            }

            // 获取资金流向并绘制
            const fundFlow = await API.fetchFundFlow(secid);
            if (fundFlow && fundFlow.flowData.length > 0) {
                Charts.drawFundFlowChart(dom.detailFundFlowCanvas, fundFlow.flowData);
            }

        } catch (e) {
            console.error('加载详情失败:', e);
        }
    }

    /**
     * 关闭详情面板
     */
    function closeDetail() {
        dom.detailPanel.classList.remove('show');
        dom.detailOverlay.classList.remove('show');
        document.body.style.overflow = '';
        state.detailSecid = null;
        state.detailData = null;
    }

    /**
     * 获取评分颜色
     */
    function getScoreColor(score) {
        if (score >= 70) return '#22c55e';
        if (score >= 40) return '#3b82f6';
        return '#ef4444';
    }

    // ===== 自选股管理 =====

    /**
     * 加载自选股
     */
    function loadWatchlist() {
        try {
            const saved = localStorage.getItem('stock_watchlist');
            state.watchlist = saved ? JSON.parse(saved) : [];
        } catch (e) {
            state.watchlist = [];
        }
        updateWatchlistBadge();
    }

    /**
     * 保存自选股
     */
    function saveWatchlist() {
        localStorage.setItem('stock_watchlist', JSON.stringify(state.watchlist));
        updateWatchlistBadge();
    }

    /**
     * 更新自选股角标
     */
    function updateWatchlistBadge() {
        if (state.watchlist.length > 0) {
            dom.watchlistBadge.style.display = 'flex';
            dom.watchlistBadge.textContent = state.watchlist.length;
        } else {
            dom.watchlistBadge.style.display = 'none';
        }
    }

    /**
     * 更新自选按钮状态
     */
    function updateWatchlistButton(secid) {
        const inList = state.watchlist.some(w => w.secid === secid);
        if (inList) {
            dom.watchlistBtnText.textContent = '已加入自选';
            dom.btnAddWatchlist.classList.add('added');
        } else {
            dom.watchlistBtnText.textContent = '+ 加入自选';
            dom.btnAddWatchlist.classList.remove('added');
        }
    }

    /**
     * 切换自选股（从详情面板）
     */
    function toggleWatchlistFromDetail() {
        if (!state.detailSecid) return;

        const idx = state.watchlist.findIndex(w => w.secid === state.detailSecid);
        if (idx >= 0) {
            state.watchlist.splice(idx, 1);
        } else {
            state.watchlist.push({
                secid: state.detailSecid,
                name: dom.detailStockName.textContent,
                code: dom.detailStockCode.textContent,
                addedAt: Date.now()
            });
        }

        saveWatchlist();
        updateWatchlistButton(state.detailSecid);
    }

    /**
     * 切换自选股面板
     */
    function toggleWatchlistPanel() {
        const panel = dom.watchlistPanel;
        if (panel.classList.contains('show')) {
            panel.classList.remove('show');
        } else {
            renderWatchlist();
            panel.classList.add('show');
        }
    }

    /**
     * 渲染自选股列表
     */
    async function renderWatchlist() {
        if (state.watchlist.length === 0) {
            dom.watchlistBody.innerHTML = `
                <div class="watchlist-empty">
                    <p>暂无自选股</p>
                    <p class="watchlist-hint">点击股票详情中的"加入自选"按钮添加</p>
                </div>
            `;
            return;
        }

        dom.watchlistBody.innerHTML = '<div style="text-align:center;padding:20px;color:#8b949e;">加载中...</div>';

        // 批量获取最新行情
        const items = [];
        for (const w of state.watchlist) {
            try {
                const detail = await API.fetchStockDetail(w.secid);
                if (detail) {
                    items.push({ ...w, detail });
                }
            } catch (e) {
                items.push(w);
            }
        }

        dom.watchlistBody.innerHTML = items.map(item => {
            const detail = item.detail;
            const name = detail ? detail.name : item.name;
            const code = detail ? detail.code : item.code;
            const price = detail && detail.price != null ? detail.price.toFixed(2) : '--';
            const change = detail && detail.changePercent != null ? API.formatPercent(detail.changePercent) : '--';
            const priceClass = detail ? API.getPriceClass(detail.changePercent) : 'price-flat';

            return `
                <div class="watchlist-item" data-secid="${item.secid}">
                    <div class="watchlist-item-left">
                        <span class="watchlist-item-name">${escapeHtml(name)}</span>
                        <span class="watchlist-item-code">${code}</span>
                    </div>
                    <div style="display:flex;align-items:center;">
                        <div class="watchlist-item-right">
                            <span class="watchlist-item-price ${priceClass}">${price}</span>
                            <span class="watchlist-item-change ${priceClass}">${change}</span>
                        </div>
                        <button class="watchlist-item-remove" data-secid="${item.secid}" title="删除">&#10005;</button>
                    </div>
                </div>
            `;
        }).join('');

        // 点击查看详情
        dom.watchlistBody.querySelectorAll('.watchlist-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('watchlist-item-remove')) return;
                const secid = item.dataset.secid;
                toggleWatchlistPanel();
                openDetail(secid);
            });
        });

        // 删除按钮
        dom.watchlistBody.querySelectorAll('.watchlist-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const secid = btn.dataset.secid;
                state.watchlist = state.watchlist.filter(w => w.secid !== secid);
                saveWatchlist();
                renderWatchlist();
            });
        });
    }

    /**
     * 自动刷新
     */
    function startAutoRefresh() {
        if (state.refreshTimer) clearInterval(state.refreshTimer);
        state.refreshTimer = setInterval(() => {
            if (state.currentTab === 'market' && !state.isRefreshing) {
                loadStockList();
            }
        }, 30000);
    }

    /**
     * HTML 转义
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return {
        init
    };
})();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
