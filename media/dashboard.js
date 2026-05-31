/**
 * ModelSight Dashboard Frontend Controller (Optimized & Lightweight)
 * Runs in the VS Code webview sandbox. Features:
 * - Real-time metrics streaming with throttled UI refreshes.
 * - Dual-curve rendering (Training vs Validation) with dashed line overlays.
 * - Automatic local overfitting detection alerts.
 * - History list rendering and past run overlay comparisons.
 * - Local HTML/Markdown report exporter with vector graphics.
 * - Performance downsampling (caps SVG paths at 120 points maximum).
 */

(function () {
    const vscode = acquireVsCodeApi();

    // DOM Elements
    const statusBadge = document.getElementById('status-badge');
    const statusText = document.getElementById('status-text');
    const activeScriptWrapper = document.getElementById('active-script-wrapper');
    const activeScriptName = document.getElementById('active-script-name');
    const stopBtn = document.getElementById('stop-btn');
    const clearBtn = document.getElementById('clear-btn');
    const exportBtn = document.getElementById('export-btn');

    const valLoss = document.getElementById('val-loss');
    const footerLoss = document.getElementById('footer-loss');
    const valAccuracy = document.getElementById('val-accuracy');
    const barAccuracy = document.getElementById('bar-accuracy');
    const valLr = document.getElementById('val-lr');
    const footerLr = document.getElementById('footer-lr');
    const valGpu = document.getElementById('val-gpu');
    const barGpu = document.getElementById('bar-gpu');
    const valRam = document.getElementById('val-ram');
    const barRam = document.getElementById('bar-ram');
    const valOverfit = document.getElementById('val-overfit');
    const barOverfit = document.getElementById('bar-overfit');

    const etaBanner = document.getElementById('eta-banner');
    const valEta = document.getElementById('val-eta');
    const barProgress = document.getElementById('bar-progress');
    const progressText = document.getElementById('progress-text');
    const progressEpochs = document.getElementById('progress-epochs');

    const errorSection = document.getElementById('error-section');
    const errorIdle = document.getElementById('error-idle');
    const errorActive = document.getElementById('error-active');
    const errorCategory = document.getElementById('error-category');
    const errorRawLine = document.getElementById('error-raw-line');
    const errorSummaryText = document.getElementById('error-summary-text');
    const errorStepsList = document.getElementById('error-steps-list');

    const timelineList = document.getElementById('timeline-list');
    const timelinePlaceholder = document.getElementById('timeline-placeholder');

    const toggleConsoleBtn = document.getElementById('toggle-console-btn');
    const consoleOutputBody = document.getElementById('console-output-body');
    const consoleLogPre = document.getElementById('console-log-pre');

    const chartViewport = document.getElementById('chart-viewport');
    const tabButtons = document.querySelectorAll('.tab-btn');

    // Run History DOM
    const historyList = document.getElementById('history-list');
    const historyPlaceholder = document.getElementById('history-placeholder');
    const clearHistoryBtn = document.getElementById('clear-history-btn');

    // State Variables
    let metricsHistory = [];
    let pastRuns = [];
    let overlayRunIds = new Set(); // holds IDs of past runs to draw as overlays
    let activeChartTab = 'loss'; // 'loss' | 'accuracy' | 'lr'
    let isConsoleCollapsed = false;

    // Viewport Dimension Caching to prevent layout thrashing
    let cachedChartWidth = 0;
    let cachedChartHeight = 0;

    function updateViewportDimensions() {
        if (!chartViewport) return;
        const rect = chartViewport.getBoundingClientRect();
        cachedChartWidth = rect.width;
        cachedChartHeight = rect.height;
    }

    // Schedule chart updates via requestAnimationFrame for smooth painting
    let chartUpdatePending = false;
    function scheduleChartUpdate() {
        if (chartUpdatePending) return;
        chartUpdatePending = true;
        requestAnimationFrame(() => {
            updateChart();
            chartUpdatePending = false;
        });
    }

    // Initialize dimensions
    updateViewportDimensions();

    // Initialize Event Listeners
    stopBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'stopTraining' });
    });

    clearBtn.addEventListener('click', () => {
        metricsHistory = [];
        resetDashboardUI();
        vscode.postMessage({ command: 'clearData' });
    });

    clearHistoryBtn.addEventListener('click', () => {
        pastRuns = [];
        overlayRunIds.clear();
        updateHistoryUI();
        vscode.postMessage({ command: 'clearHistory' });
    });

    exportBtn.addEventListener('click', () => {
        exportHTMLReport();
    });

    toggleConsoleBtn.addEventListener('click', () => {
        isConsoleCollapsed = !isConsoleCollapsed;
        if (isConsoleCollapsed) {
            consoleOutputBody.classList.add('collapsed');
            toggleConsoleBtn.textContent = 'Expand';
        } else {
            consoleOutputBody.classList.remove('collapsed');
            toggleConsoleBtn.textContent = 'Collapse';
        }
    });

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeChartTab = btn.getAttribute('data-chart');
            scheduleChartUpdate();
        });
    });

    let resizeTimeout = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updateViewportDimensions();
            scheduleChartUpdate();
        }, 100);
    });

    // Message handler from Extension Backend
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'status':
                updateRunStatus(message.data);
                break;
            case 'metric':
                handleNewMetric(message.data.current, message.data.history);
                break;
            case 'history':
                metricsHistory = message.data;
                updateMetricsUI();
                scheduleChartUpdate();
                checkOverfitting();
                break;
            case 'historyList':
                pastRuns = message.data || [];
                updateHistoryUI();
                break;
            case 'error':
                handleCrashError(message.data.explanation, message.data.rawTraceback);
                break;
            case 'stdout':
                appendConsoleLog(message.data);
                break;
        }
    });

    function resetDashboardUI() {
        valLoss.textContent = '-';
        footerLoss.textContent = 'No data received';
        valAccuracy.textContent = '-';
        barAccuracy.style.width = '0%';
        valLr.textContent = '-';
        footerLr.textContent = 'No data received';
        valGpu.textContent = '-';
        barGpu.style.width = '0%';
        valRam.textContent = '-';
        barRam.style.width = '0%';
        if (valOverfit && barOverfit) {
            valOverfit.innerHTML = '<span style="color: var(--success)">Low</span>';
            barOverfit.style.width = '0%';
            barOverfit.className = 'progress-bar-fill progress-low';
        }
        window._lastCheckpointName = null;
        window._lastCheckpointTime = null;

        valEta.textContent = 'Calculating ETA...';
        barProgress.style.width = '0%';
        progressText.textContent = '0% Complete';
        progressEpochs.textContent = '-/- Epochs';

        errorSection.classList.remove('has-error');
        errorActive.classList.add('hidden');
        errorIdle.classList.remove('hidden');
        errorIdle.classList.add('active');

        timelineList.innerHTML = '';
        timelineList.appendChild(timelinePlaceholder);
        timelinePlaceholder.classList.remove('hidden');

        consoleLogPre.textContent = 'Welcome to ModelSight. Run a python script to begin streaming output here...';
        scheduleChartUpdate();
    }

    function updateRunStatus(status) {
        if (status.isTraining) {
            statusBadge.className = 'status-badge training';
            statusText.textContent = 'Training';
            activeScriptWrapper.classList.remove('hidden');
            activeScriptName.textContent = status.scriptName;
            stopBtn.classList.remove('hidden');
            
            consoleLogPre.textContent = `[ModelSight] Connected to ${status.scriptName} training run...\n\n`;
            errorSection.classList.remove('has-error');
            errorActive.classList.add('hidden');
            errorIdle.classList.remove('hidden');
            errorIdle.classList.add('active');
        } else {
            statusBadge.className = 'status-badge idle';
            statusText.textContent = 'Idle';
            stopBtn.classList.add('hidden');
        }
    }

    function appendConsoleLog(text) {
        const isAtBottom = (consoleOutputBody.scrollHeight - consoleOutputBody.clientHeight) <= (consoleOutputBody.scrollTop + 50);
        consoleLogPre.textContent += text;
        
        // Bounded console buffer to prevent lag in long training sessions (keep last ~40,000 characters)
        if (consoleLogPre.textContent.length > 50000) {
            consoleLogPre.textContent = "[Logs Truncated for Performance]\n" + consoleLogPre.textContent.slice(-40000);
        }

        if (isAtBottom) {
            consoleOutputBody.scrollTop = consoleOutputBody.scrollHeight;
        }
    }

    function handleNewMetric(current, history) {
        metricsHistory = history;
        updateMetricsUI(current);
        scheduleChartUpdate();
        checkOverfitting();

        if (current.checkpoint) {
            addCheckpointEvent(current.checkpoint);
        }
    }

    function updateMetricsUI(latestPoint) {
        if (metricsHistory.length === 0) return;
        const current = latestPoint || metricsHistory[metricsHistory.length - 1];

        // 1. Loss Card
        if (current.loss !== undefined) {
            valLoss.textContent = current.loss.toFixed(4);
            if (metricsHistory.length > 1) {
                const firstLoss = metricsHistory[0].loss;
                const change = current.loss - firstLoss;
                if (change < 0) {
                    footerLoss.innerHTML = `<span style="color: var(--success)">↓ ${(Math.abs(change)).toFixed(4)}</span> from start`;
                } else if (change > 0) {
                    footerLoss.innerHTML = `<span style="color: var(--danger)">↑ ${change.toFixed(4)}</span> from start`;
                } else {
                    footerLoss.textContent = 'Stable';
                }
            } else {
                footerLoss.textContent = 'Initial loss recorded';
            }
        }

        // 2. Accuracy Card
        if (current.accuracy !== undefined) {
            let rawAcc = current.accuracy;
            let percentVal = rawAcc <= 1.0 ? rawAcc * 100 : rawAcc;
            valAccuracy.textContent = `${percentVal.toFixed(2)}%`;
            barAccuracy.style.width = `${Math.min(100, percentVal)}%`;
        }

        // 3. Learning Rate Card
        if (current.lr !== undefined) {
            valLr.textContent = current.lr < 0.001 ? current.lr.toExponential(2) : current.lr.toString();
            footerLr.textContent = 'Currently active';
        }

        // 4. GPU Usage Card
        if (current.gpu_usage !== undefined) {
            valGpu.textContent = `${Math.round(current.gpu_usage)}%`;
            barGpu.style.width = `${Math.min(100, current.gpu_usage)}%`;
        } else {
            valGpu.textContent = 'N/A';
            barGpu.style.width = '0%';
        }

        // 4b. RAM Usage Card
        if (current.ram_usage !== undefined) {
            valRam.textContent = `${Math.round(current.ram_usage)}%`;
            barRam.style.width = `${Math.min(100, current.ram_usage)}%`;
        } else {
            valRam.textContent = 'N/A';
            barRam.style.width = '0%';
        }

        // 5. ETA / Progress Banner
        if (current.progress !== undefined && current.progress !== null) {
            const pct = Math.round(current.progress * 100);
            progressText.textContent = `${pct}% Complete`;
            barProgress.style.width = `${pct}%`;
            valEta.textContent = current.eta || 'Calculating ETA...';

            if (current.epoch !== undefined && current.total_epochs !== undefined) {
                progressEpochs.textContent = `Epoch ${current.epoch} of ${current.total_epochs}`;
            } else if (current.step !== undefined && current.total_steps !== undefined) {
                progressEpochs.textContent = `Step ${current.step} of ${current.total_steps}`;
            }
        }
    }

    function addCheckpointEvent(checkpointName) {
        timelinePlaceholder.classList.add('hidden');
        
        // Prevent duplicate checkpoints added within 2 seconds
        const now = Date.now();
        if (window._lastCheckpointName === checkpointName && window._lastCheckpointTime && (now - window._lastCheckpointTime) < 2000) {
            return;
        }
        if (checkpointName === 'saved' && window._lastCheckpointTime && (now - window._lastCheckpointTime) < 2000) {
            return;
        }
        
        window._lastCheckpointName = checkpointName;
        window._lastCheckpointTime = now;

        const li = document.createElement('li');
        li.className = 'timeline-item success';
        
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        li.innerHTML = `
            <div class="timeline-time">${timeStr}</div>
            <div class="timeline-text">Saved model weight checkpoint: <strong style="color: var(--text-primary)">${checkpointName}</strong></div>
        `;
        timelineList.insertBefore(li, timelineList.firstChild);
    }

    // Heuristic overfitting checker:
    // If validation loss has risen consecutively for 3 validation readings while training loss decreases.
    function checkOverfitting() {
        const valHistory = metricsHistory.filter(h => h.val_loss !== undefined);
        const trainHistory = metricsHistory.filter(h => h.loss !== undefined);

        // Update Overfitting Risk Card UI
        if (valOverfit && barOverfit) {
            let consecutiveValLossIncreases = 0;
            if (valHistory.length >= 2) {
                for (let i = valHistory.length - 1; i > 0; i--) {
                    if (valHistory[i].val_loss > valHistory[i - 1].val_loss) {
                        consecutiveValLossIncreases++;
                    } else {
                        break;
                    }
                }
            }

            if (consecutiveValLossIncreases === 0) {
                valOverfit.innerHTML = '<span style="color: var(--success)">Low</span>';
                barOverfit.style.width = '0%';
                barOverfit.className = 'progress-bar-fill progress-low';
            } else if (consecutiveValLossIncreases === 1) {
                valOverfit.innerHTML = '<span style="color: var(--success)">Low</span>';
                barOverfit.style.width = '33%';
                barOverfit.className = 'progress-bar-fill progress-low';
            } else if (consecutiveValLossIncreases === 2) {
                valOverfit.innerHTML = '<span style="color: var(--warning)">Moderate</span>';
                barOverfit.style.width = '66%';
                barOverfit.className = 'progress-bar-fill progress-medium';
            } else {
                valOverfit.innerHTML = '<span style="color: var(--danger)">High ⚠️</span>';
                barOverfit.style.width = '100%';
                barOverfit.className = 'progress-bar-fill progress-high';
            }
        }

        if (valHistory.length < 4 || trainHistory.length < 4) return;

        // Check if validation loss is rising consecutively
        let valLossRising = true;
        for (let i = valHistory.length - 1; i > valHistory.length - 4; i--) {
            if (valHistory[i].val_loss <= valHistory[i - 1].val_loss) {
                valLossRising = false;
                break;
            }
        }

        // Check if training loss is decreasing
        let trainLossDecreasing = true;
        for (let i = trainHistory.length - 1; i > trainHistory.length - 4; i--) {
            if (trainHistory[i].loss >= trainHistory[i - 1].loss) {
                trainLossDecreasing = false;
                break;
            }
        }

        if (valLossRising && trainLossDecreasing) {
            // Trigger overfitting alert
            const explanation = {
                category: "Overfitting Warning ⚠️",
                originalError: `Validation loss has increased for 3 consecutive readings (from ${valHistory[valHistory.length-4].val_loss.toFixed(4)} to ${valHistory[valHistory.length-1].val_loss.toFixed(4)}) while training loss is decreasing.`,
                whyItHappened: "Overfitting happens when a neural network learns detail and noise in the training dataset to the extent that it negatively impacts the performance of the model on new validation datasets.",
                whatToDo: [
                    "Introduce regularization techniques like Dropout layers in your network architecture: `nn.Dropout(p=0.5)`.",
                    "Apply Weight Decay (L2 regularization) inside your optimizer configuration: `optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)`.",
                    "Use Early Stopping to cease training once validation loss starts rising.",
                    "Obtain more training samples or apply data augmentation to generalise features."
                ]
            };
            handleCrashWarning(explanation);
        }
    }

    function handleCrashWarning(explanation) {
        errorSection.classList.add('has-error');
        errorIdle.classList.remove('active');
        errorIdle.classList.add('hidden');
        errorActive.classList.remove('hidden');

        errorCategory.textContent = explanation.category;
        errorRawLine.textContent = explanation.originalError;
        errorSummaryText.textContent = explanation.whyItHappened;

        errorStepsList.innerHTML = '';
        explanation.whatToDo.forEach(step => {
            const li = document.createElement('li');
            li.textContent = step;
            errorStepsList.appendChild(li);
        });
    }

    function handleCrashError(explanation, rawTraceback) {
        statusBadge.className = 'status-badge crashed';
        statusText.textContent = 'Crashed';
        handleCrashWarning(explanation);
        
        isConsoleCollapsed = false;
        consoleOutputBody.classList.remove('collapsed');
        toggleConsoleBtn.textContent = 'Collapse';
    }

    // Refresh history UI list
    function updateHistoryUI() {
        historyList.innerHTML = '';
        if (pastRuns.length === 0) {
            historyPlaceholder.classList.remove('hidden');
            historyList.appendChild(historyPlaceholder);
            return;
        }

        historyPlaceholder.classList.add('hidden');
        pastRuns.forEach(run => {
            const li = document.createElement('li');
            li.style.cssText = 'padding: 0.5rem 0; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem;';
            
            const checked = overlayRunIds.has(run.id) ? 'checked' : '';
            const dateStr = new Date(run.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const lossVal = run.finalLoss ? `Loss: ${run.finalLoss.toFixed(3)}` : '';
            
            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" data-run-id="${run.id}" ${checked} style="cursor: pointer;">
                    <div>
                        <span style="font-weight: 600; color: var(--text-primary);">${run.scriptName}</span>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">${dateStr} | ${run.duration}s | ${lossVal}</div>
                    </div>
                </div>
            `;

            const checkbox = li.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    overlayRunIds.add(run.id);
                } else {
                    overlayRunIds.delete(run.id);
                }
                scheduleChartUpdate();
            });

            historyList.appendChild(li);
        });
    }

    // Downsampling coordinates calculator helper
    function getScaledPoints(pointsList, type, maxX, getX, getY) {
        const coords = pointsList
            .map((d, index) => ({ x: index, y: d[type] }))
            .filter(d => d.y !== undefined && !isNaN(d.y));

        if (coords.length === 0) return null;

        // Downsample to max 100 points for smooth performance
        let displayed = coords;
        if (coords.length > 100) {
            displayed = [];
            const step = (coords.length - 1) / 99;
            for (let i = 0; i < 100; i++) {
                const idx = Math.min(coords.length - 1, Math.round(i * step));
                displayed.push(coords[idx]);
            }
        }

        let pathStr = "";
        let areaStr = "";
        
        displayed.forEach((pt, idx) => {
            const x = getX(pt.x);
            const y = getY(pt.y);
            if (idx === 0) {
                pathStr = `M ${x} ${y}`;
                areaStr = `L ${x} ${y}`;
            } else {
                pathStr += ` L ${x} ${y}`;
                areaStr += ` L ${x} ${y}`;
            }
        });

        return { pathStr, areaStr, rawPoints: displayed };
    }

    // Render SVG curves
    function updateChart() {
        const svg = document.getElementById('live-chart');
        svg.innerHTML = '';

        if (metricsHistory.length === 0 && overlayRunIds.size === 0) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', '50%');
            text.setAttribute('y', '50%');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', 'var(--text-muted)');
            text.setAttribute('font-size', '12px');
            text.textContent = 'Waiting for training metrics telemetry...';
            svg.appendChild(text);
            return;
        }

        // Gather all active data pools (current history + checked overlay runs)
        const datasets = [];
        if (metricsHistory.length > 0) {
            datasets.push({ id: 'current', history: metricsHistory, isOverlay: false });
        }
        overlayRunIds.forEach(id => {
            const r = pastRuns.find(run => run.id === id);
            if (r) datasets.push({ id: r.id, history: r.history, isOverlay: true, name: r.scriptName });
        });

        // 1. Calculate boundaries across all datasets
        let maxLength = 1;
        let minY = Infinity;
        let maxY = -Infinity;

        datasets.forEach(ds => {
            maxLength = Math.max(maxLength, ds.history.length);
            ds.history.forEach(pt => {
                // Check active metric (loss, val_loss, accuracy, val_accuracy, lr)
                const checkKeys = [];
                if (activeChartTab === 'loss') checkKeys.push('loss', 'val_loss');
                if (activeChartTab === 'accuracy') checkKeys.push('accuracy', 'val_accuracy');
                if (activeChartTab === 'lr') checkKeys.push('lr');

                checkKeys.forEach(k => {
                    const val = pt[k];
                    if (val !== undefined && !isNaN(val)) {
                        minY = Math.min(minY, val);
                        maxY = Math.max(maxY, val);
                    }
                });
            });
        });

        if (minY === Infinity || maxY === -Infinity) {
            minY = 0;
            maxY = 1;
        } else if (minY === maxY) {
            const val = minY;
            if (val === 0) {
                minY = 0;
                maxY = 1.0;
            } else {
                const offset = Math.abs(val) * 0.1;
                minY = val - offset;
                maxY = val + offset;
            }
        } else {
            const diff = maxY - minY;
            minY = Math.max(0, minY - diff * 0.1);
            maxY = maxY + diff * 0.1;
        }

        // Layout Scaling (uses cached dimensions to avoid layout thrashing)
        let width = cachedChartWidth;
        let height = cachedChartHeight;
        if (width < 150) width = 600;
        if (height < 100) height = 260;

        const padding = { top: 25, right: 30, bottom: 35, left: 55 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        const maxX = Math.max(1, maxLength - 1);
        const getX = (val) => padding.left + (val / maxX) * chartWidth;
        const getY = (val) => padding.top + chartHeight - ((val - minY) / (maxY - minY)) * chartHeight;

        // Draw grids
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const valY = minY + (i / gridLines) * (maxY - minY);
            const y = getY(valY);

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', padding.left);
            line.setAttribute('y1', y);
            line.setAttribute('x2', width - padding.right);
            line.setAttribute('y2', y);
            line.setAttribute('class', 'grid-line');
            svg.appendChild(line);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', padding.left - 10);
            text.setAttribute('y', y + 3);
            text.setAttribute('text-anchor', 'end');
            text.setAttribute('class', 'axis-label');
            text.textContent = valY < 0.001 && valY > 0 ? valY.toExponential(2) : valY.toFixed(3);
            svg.appendChild(text);
        }

        // X labels
        const xTickCount = Math.min(maxLength, 6);
        for (let i = 0; i < xTickCount; i++) {
            const stepIndex = Math.floor((i / (xTickCount - 1)) * (maxLength - 1));
            if (isNaN(stepIndex) || stepIndex < 0) continue;
            
            const x = getX(stepIndex);
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', height - padding.bottom + 18);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('class', 'axis-label');

            const point = datasets[0]?.history[stepIndex];
            text.textContent = point && point.epoch !== undefined ? `Ep ${point.epoch}` : `Pt ${stepIndex + 1}`;
            svg.appendChild(text);
        }

        // Draw axes lines
        const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        xAxis.setAttribute('x1', padding.left);
        xAxis.setAttribute('y1', height - padding.bottom);
        xAxis.setAttribute('x2', width - padding.right);
        xAxis.setAttribute('y2', height - padding.bottom);
        xAxis.setAttribute('class', 'axis-line');
        svg.appendChild(xAxis);

        const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        yAxis.setAttribute('x1', padding.left);
        yAxis.setAttribute('y1', padding.top);
        yAxis.setAttribute('x2', padding.left);
        yAxis.setAttribute('y2', height - padding.bottom);
        yAxis.setAttribute('class', 'axis-line');
        svg.appendChild(yAxis);

        // 2. Draw Curves
        datasets.forEach(ds => {
            const strokeColor = ds.isOverlay ? 'var(--text-muted)' : 
                                (activeChartTab === 'loss' ? 'var(--accent-primary)' : 
                                (activeChartTab === 'accuracy' ? 'var(--accent-secondary)' : 'var(--warning)'));
            const opacity = ds.isOverlay ? '0.35' : '1.0';

            // Curve 1: Training Metric
            const trainCurves = getScaledPoints(ds.history, activeChartTab, maxX, getX, getY);
            if (trainCurves) {
                // Line Path
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                line.setAttribute('d', trainCurves.pathStr);
                line.setAttribute('class', 'chart-line');
                line.setAttribute('style', `stroke: ${strokeColor}; opacity: ${opacity};`);
                if (ds.isOverlay) line.setAttribute('stroke-dasharray', '3,3');
                svg.appendChild(line);

                // Area Gradient for active run
                if (!ds.isOverlay) {
                    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                    const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
                    const gradId = `glow-${ds.id}`;
                    grad.setAttribute('id', gradId);
                    grad.setAttribute('x1', '0%');
                    grad.setAttribute('y1', '0%');
                    grad.setAttribute('x2', '0%');
                    grad.setAttribute('y2', '100%');

                    const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    s1.setAttribute('offset', '0%');
                    s1.setAttribute('stop-color', strokeColor);
                    s1.setAttribute('stop-opacity', '0.22');

                    const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    s2.setAttribute('offset', '100%');
                    s2.setAttribute('stop-color', strokeColor);
                    s2.setAttribute('stop-opacity', '0.0');

                    grad.appendChild(s1);
                    grad.appendChild(s2);
                    defs.appendChild(grad);
                    svg.appendChild(defs);

                    const fullAreaStr = `${trainCurves.pathStr} L ${getX(trainCurves.rawPoints[trainCurves.rawPoints.length - 1].x)} ${height - padding.bottom} L ${getX(trainCurves.rawPoints[0].x)} ${height - padding.bottom} Z`;
                    const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    area.setAttribute('d', fullAreaStr);
                    area.setAttribute('fill', `url(#${gradId})`);
                    svg.appendChild(area);
                }

                // Render dots if there are few points to prevent crescent clumping
                if (maxLength <= 30) {
                    trainCurves.rawPoints.forEach(pt => {
                        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                        dot.setAttribute('cx', getX(pt.x));
                        dot.setAttribute('cy', getY(pt.y));
                        dot.setAttribute('r', ds.isOverlay ? '1.5' : '2.5');
                        dot.setAttribute('class', 'chart-dot');
                        dot.setAttribute('style', `fill: ${strokeColor}; opacity: ${opacity}`);

                        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                        const originalPoint = ds.history[pt.x];
                        const labelPrefix = ds.isOverlay ? `[Run ${ds.name}] ` : '';
                        const epLabel = originalPoint.epoch !== undefined ? `Epoch ${originalPoint.epoch}` : `Step ${pt.x + 1}`;
                        title.textContent = `${labelPrefix}${epLabel}: ${pt.y.toFixed(5)}`;
                        dot.appendChild(title);

                        svg.appendChild(dot);
                    });
                }
            }

            // Curve 2: Validation Metric (Loss/Acc only, not LR)
            if (activeChartTab !== 'lr') {
                const valKey = activeChartTab === 'loss' ? 'val_loss' : 'val_accuracy';
                const valCurves = getScaledPoints(ds.history, valKey, maxX, getX, getY);
                if (valCurves) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    line.setAttribute('d', valCurves.pathStr);
                    line.setAttribute('class', 'chart-line');
                    line.setAttribute('style', `stroke: ${strokeColor}; opacity: ${opacity};`);
                    line.setAttribute('stroke-dasharray', '6,4'); // Dashed lines for validation
                    svg.appendChild(line);

                    // Render validation dots if there are few points to prevent crescent clumping
                    if (maxLength <= 30) {
                        valCurves.rawPoints.forEach(pt => {
                            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                            dot.setAttribute('cx', getX(pt.x));
                            dot.setAttribute('cy', getY(pt.y));
                            dot.setAttribute('r', '2.5');
                            dot.setAttribute('class', 'chart-dot');
                            dot.setAttribute('style', `fill: ${strokeColor}; opacity: ${opacity}; stroke-width: 1.5; stroke: #fff;`);

                            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                            const originalPoint = ds.history[pt.x];
                            const labelPrefix = ds.isOverlay ? `[Run ${ds.name}] Val ` : 'Val ';
                            const epLabel = originalPoint.epoch !== undefined ? `Epoch ${originalPoint.epoch}` : `Step ${pt.x + 1}`;
                            title.textContent = `${labelPrefix}${epLabel}: ${pt.y.toFixed(5)}`;
                            dot.appendChild(title);

                            svg.appendChild(dot);
                        });
                    }
                }
            }
        });
    }

    function exportHTMLReport() {
        if (metricsHistory.length === 0) {
            vscode.postMessage({ command: 'showWarning', text: "No training telemetry logs available to export." });
            return;
        }

        const currentPoint = metricsHistory[metricsHistory.length - 1];
        const epochStr = currentPoint.epoch !== undefined ? `${currentPoint.epoch}/${currentPoint.total_epochs || '?'}` : 'N/A';
        const dateStr = new Date().toLocaleString();

        // Get inline copy of the active chart SVG code
        const svgElement = document.getElementById('live-chart').cloneNode(true);
        // Clean class properties so SVG colors match in standard light background browsers
        const svgLines = svgElement.querySelectorAll('.grid-line');
        svgLines.forEach(l => l.setAttribute('stroke', '#e5e7eb'));
        const svgAxes = svgElement.querySelectorAll('.axis-line');
        svgAxes.forEach(a => a.setAttribute('stroke', '#9ca3af'));
        const svgLabels = svgElement.querySelectorAll('.axis-label');
        svgLabels.forEach(lb => lb.setAttribute('fill', '#4b5563'));

        const svgSerializer = new XMLSerializer();
        const svgString = svgSerializer.serializeToString(svgElement);

        const htmlReport = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>ModelSight Training Report</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; color: #1f2937; padding: 2rem; max-width: 800px; margin: 0 auto; line-height: 1.5; }
        header { border-bottom: 2px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 1.5rem; }
        h1 { margin: 0; color: #4f46e5; }
        .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem; background: #f9fafb; padding: 1rem; border-radius: 8px; border: 1px solid #f3f4f6; }
        .meta-item { font-size: 0.9rem; }
        .meta-label { font-weight: 600; color: #4b5563; }
        .chart-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin: 1.5rem 0; height: 320px; background: #fff; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; }
        th { background: #f3f4f6; font-weight: 600; }
        .grid-line { stroke: #e5e7eb; stroke-width: 1; }
        .axis-line { stroke: #9ca3af; stroke-width: 1.5; }
        .axis-label { fill: #4b5563; font-size: 9px; font-family: monospace; }
        .chart-line { fill: none; stroke: #4f46e5; stroke-width: 2.5; }
        .chart-dot { fill: #4f46e5; stroke: #fff; stroke-width: 1.5; }
        .badge { display: inline-block; padding: 0.2rem 0.5rem; font-size: 0.75rem; font-weight: 600; background: #d1fae5; color: #065f46; border-radius: 4px; }
    </style>
</head>
<body>
    <header>
        <h1>ModelSight Training Summary Report</h1>
        <p style="color: #6b7280; margin: 0.25rem 0 0 0;">Generated locally on ${dateStr}</p>
    </header>

    <div class="meta-grid">
        <div class="meta-item"><span class="meta-label">Active Script:</span> ${activeScriptName.textContent}</div>
        <div class="meta-item"><span class="meta-label">Completed Epochs:</span> ${epochStr}</div>
        <div class="meta-item"><span class="meta-label">Final Loss:</span> ${currentPoint.loss !== undefined ? currentPoint.loss.toFixed(6) : 'N/A'}</div>
        <div class="meta-item"><span class="meta-label">Final Accuracy:</span> ${valAccuracy.textContent}</div>
    </div>

    <h2>Telemetry Vector Curve (${activeChartTab.toUpperCase()})</h2>
    <div class="chart-box">
        ${svgString}
    </div>

    <h2>Checkpoints & Saving Epochs</h2>
    <table>
        <thead>
            <tr>
                <th>Epoch</th>
                <th>Loss</th>
                <th>Accuracy</th>
                <th>Learning Rate</th>
                <th>Saved Weight/Event</th>
            </tr>
        </thead>
        <tbody>
            ${metricsHistory.map((pt, idx) => {
                if (!pt.checkpoint) return '';
                return `
                    <tr>
                        <td>${pt.epoch !== undefined ? pt.epoch : idx + 1}</td>
                        <td>${pt.loss !== undefined ? pt.loss.toFixed(4) : '-'}</td>
                        <td>${pt.accuracy !== undefined ? (pt.accuracy * 100).toFixed(1) + '%' : '-'}</td>
                        <td>${pt.lr !== undefined ? pt.lr.toString() : '-'}</td>
                        <td><span class="badge">${pt.checkpoint}</span></td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    </table>
</body>
</html>`;

        vscode.postMessage({
            command: 'exportReport',
            data: {
                format: 'html',
                content: htmlReport
            }
        });
    }
})();
