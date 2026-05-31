/**
 * ModelSight Webview Dashboard Panel
 * Creates and manages the HTML webview panel for displaying metrics, charts,
 * error explanations, and logs.
 */

const vscode = require('vscode');
const path = require('path');

class DashboardPanel {
    static currentPanel = undefined;
    static viewType = 'modelsightDashboard';

    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If a panel is already open, show it
        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal(column);
            return DashboardPanel.currentPanel;
        }

        // Otherwise, create a new Webview panel
        const panel = vscode.window.createWebviewPanel(
            DashboardPanel.viewType,
            'ModelSight Dashboard',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true, // Keep state when switched tabs
                localResourceRoots: [
                    vscode.Uri.file(path.join(extensionUri.fsPath, 'media'))
                ]
            }
        );

        DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
        return DashboardPanel.currentPanel;
    }

    constructor(panel, extensionUri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._disposables = [];

        // Generate the initial HTML content
        this._update();

        // Clean up when the panel is closed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Listen for messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'stopTraining':
                        const monitor = require('./monitor');
                        monitor.stop();
                        break;
                    case 'clearData':
                        const m = require('./monitor');
                        m.metricsHistory = [];
                        this.updateHistory([]);
                        break;
                    case 'exportReport':
                        const ext = require('./extension');
                        ext.handleExportReport(message.data);
                        break;
                    case 'clearHistory':
                        const ext2 = require('./extension');
                        ext2.clearRunsHistory();
                        break;
                    case 'showWarning':
                        vscode.window.showWarningMessage(message.text);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    updateStatus(status) {
        if (this._panel && this._panel.webview) {
            this._panel.webview.postMessage({ command: 'status', data: status });
        }
    }

    updateMetric(metric, history) {
        if (this._panel && this._panel.webview) {
            this._panel.webview.postMessage({ command: 'metric', data: { current: metric, history: history } });
        }
    }

    updateHistory(history) {
        if (this._panel && this._panel.webview) {
            this._panel.webview.postMessage({ command: 'history', data: history });
        }
    }

    sendHistoryList(runs) {
        if (this._panel && this._panel.webview) {
            this._panel.webview.postMessage({ command: 'historyList', data: runs });
        }
    }

    showError(explanation, rawTraceback) {
        if (this._panel && this._panel.webview) {
            this._panel.webview.postMessage({ command: 'error', data: { explanation, rawTraceback } });
        }
    }

    appendStdout(text) {
        if (this._panel && this._panel.webview) {
            this._panel.webview.postMessage({ command: 'stdout', data: text });
        }
    }

    dispose() {
        DashboardPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    _update() {
        this._panel.title = "ModelSight Dashboard";
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    }

    _getHtmlForWebview(webview) {
        // Local paths to script and style
        const scriptPathOnDisk = vscode.Uri.file(
            path.join(this._extensionUri.fsPath, 'media', 'dashboard.js')
        );
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

        const stylePathOnDisk = vscode.Uri.file(
            path.join(this._extensionUri.fsPath, 'media', 'dashboard.css')
        );
        const styleUri = webview.asWebviewUri(stylePathOnDisk);

        // Security Nonce
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link href="${styleUri}" rel="stylesheet">
    <title>ModelSight Dashboard</title>
</head>
<body>
    <div class="app-container">
        <!-- Header -->
        <header class="dashboard-header">
            <div class="brand">
                <span class="logo-icon">📊</span>
                <div class="brand-text">
                    <h1>ModelSight</h1>
                    <p class="tagline">Local ML Training Monitor & Error Explainer</p>
                </div>
            </div>
            <div class="status-bar-container">
                <div id="tb-badge" class="status-badge integration hidden">
                    <span class="status-dot"></span>
                    <span>TensorBoard Active</span>
                </div>
                <div id="wandb-badge" class="status-badge integration hidden">
                    <span class="status-dot"></span>
                    <span>W&B Active</span>
                </div>
                <div id="status-badge" class="status-badge idle">
                    <span class="status-dot"></span>
                    <span id="status-text">Idle</span>
                </div>
                <div id="active-script-wrapper" class="hidden">
                    <span class="divider">|</span>
                    <span class="file-label">Script:</span>
                    <code id="active-script-name">None</code>
                </div>
                <button id="stop-btn" class="btn btn-danger hidden">
                    <span class="btn-icon">⏹</span> Stop Training
                </button>
                <button id="export-btn" class="btn btn-secondary">
                    Export Report
                </button>
                <button id="clear-btn" class="btn btn-secondary">
                    Clear Dashboard
                </button>
            </div>
        </header>

        <!-- Workspace Tabs -->
        <div class="workspace-tabs">
            <button class="w-tab-btn active" data-w-tab="telemetry">📈 Live Telemetry</button>
            <button class="w-tab-btn" data-w-tab="dataset">📊 Dataset Profile</button>
            <button class="w-tab-btn" data-w-tab="comparison">🔬 Run Comparison</button>
        </div>

        <!-- Main Dashboard Workspace -->
        <main class="dashboard-grid">
            
            <!-- Left Side: Metrics & Charts / Dataset / Comparison -->
            <section class="left-panel">
                
                <!-- Tab 1: Live Telemetry Section -->
                <div id="tab-content-telemetry" class="w-tab-content">
                    <!-- Telemetry Cards -->
                    <div class="metrics-row">
                        <!-- Loss Card -->
                        <div class="card metric-card" id="card-loss">
                            <div class="card-label">Current Loss</div>
                            <div class="card-value" id="val-loss">-</div>
                            <div class="card-footer" id="footer-loss">No data received</div>
                        </div>

                        <!-- Accuracy Card -->
                        <div class="card metric-card" id="card-accuracy">
                            <div class="card-label">Accuracy</div>
                            <div class="card-value" id="val-accuracy">-</div>
                            <div class="card-progress">
                                <div class="progress-bar-bg">
                                    <div class="progress-bar-fill" id="bar-accuracy" style="width: 0%"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Learning Rate Card -->
                        <div class="card metric-card" id="card-lr">
                            <div class="card-label">Learning Rate</div>
                            <div class="card-value" id="val-lr">-</div>
                            <div class="card-footer" id="footer-lr">No data received</div>
                        </div>

                        <!-- Hardware (Detailed GPU) Card -->
                        <div class="card metric-card" id="card-hardware">
                            <div class="card-label">GPU Info</div>
                            <div class="card-value" id="val-gpu">-</div>
                            <div class="gpu-details-sub" style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.25rem;">
                                <span id="val-gpu-name" style="display:block; font-size:0.7rem; font-weight:600; color:var(--accent-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">No GPU detected</span>
                                <div style="display:flex; justify-content:space-between; margin-top:0.25rem;">
                                    <span id="val-gpu-temp">Temp: -</span>
                                    <span id="val-gpu-power">Power: -</span>
                                </div>
                                <div style="margin-top:0.25rem;">
                                    <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted);">
                                        <span>VRAM</span>
                                        <span id="val-gpu-vram">- / - MB</span>
                                    </div>
                                    <div class="progress-bar-bg" style="margin-top:0.15rem;">
                                        <div class="progress-bar-fill" id="bar-gpu-vram" style="width: 0%"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- RAM Usage Card -->
                        <div class="card metric-card" id="card-ram">
                            <div class="card-label">RAM Usage</div>
                            <div class="card-value" id="val-ram">-</div>
                            <div class="card-progress">
                                <div class="progress-bar-bg">
                                    <div class="progress-bar-fill" id="bar-ram" style="width: 0%"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Overfitting Risk Card -->
                        <div class="card metric-card" id="card-overfitting">
                            <div class="card-label">Overfitting Risk</div>
                            <div class="card-value" id="val-overfit">Low</div>
                            <div class="card-progress">
                                <div class="progress-bar-bg">
                                    <div class="progress-bar-fill progress-low" id="bar-overfit" style="width: 0%"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- LLM Specific Metrics Row -->
                    <div id="llm-metrics-row" class="metrics-row hidden" style="margin-top: 1rem; grid-template-columns: repeat(2, 1fr);">
                        <!-- Perplexity Card -->
                        <div class="card metric-card" id="card-perplexity">
                            <div class="card-label">Perplexity</div>
                            <div class="card-value" id="val-perplexity">-</div>
                            <div class="card-footer" id="footer-perplexity">LLM generation quality</div>
                        </div>
                        <!-- Tokens per Second Card -->
                        <div class="card metric-card" id="card-tps">
                            <div class="card-label">Speed (Tokens/sec)</div>
                            <div class="card-value" id="val-tps">-</div>
                            <div class="card-footer" id="footer-tps">Throughput performance</div>
                        </div>
                    </div>

                    <!-- ETA & Training Progress Banner -->
                    <div class="card eta-card" id="eta-banner" style="margin-top: 1rem;">
                        <div class="eta-label-group">
                            <span class="main-label">Training Progress</span>
                            <span id="val-eta" class="eta-value">Calculating ETA...</span>
                        </div>
                        <div class="eta-progress-container">
                            <div class="progress-bar-bg large">
                                <div class="progress-bar-fill glowing" id="bar-progress" style="width: 0%"></div>
                            </div>
                            <div class="progress-details">
                                <span id="progress-text">0% Complete</span>
                                <span id="progress-epochs">-/- Epochs</span>
                            </div>
                        </div>
                    </div>

                    <!-- Visualization Panel (SVG Charts) -->
                    <div class="card charts-card" style="margin-top: 1rem;">
                        <div class="charts-header">
                            <h2>Training Curves</h2>
                            <div class="chart-tabs">
                                <button class="tab-btn active" data-chart="loss">Loss</button>
                                <button class="tab-btn" data-chart="accuracy">Accuracy</button>
                                <button class="tab-btn" data-chart="lr">Learning Rate</button>
                            </div>
                        </div>
                        <div class="chart-content">
                            <div class="svg-container" id="chart-viewport">
                                <!-- SVG lines will be rendered dynamically by dashboard.js -->
                                <svg id="live-chart" width="100%" height="100%"></svg>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tab 2: Dataset Profile Section -->
                <div id="tab-content-dataset" class="w-tab-content hidden">
                    <div class="card" style="display:flex; flex-direction:column; gap:1.25rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem;">
                            <h2>Dataset Profile & Statistics</h2>
                            <span id="dataset-name-badge" class="shield-badge" style="font-size:0.8rem; padding:0.3rem 0.6rem;">No Dataset Logged</span>
                        </div>
                        
                        <div class="metrics-row" style="grid-template-columns: repeat(2, 1fr);">
                            <div class="card metric-card" style="min-height:80px; background:rgba(0,0,0,0.15);">
                                <div class="card-label">Total Samples</div>
                                <div class="card-value" id="dataset-samples" style="font-size:1.5rem;">-</div>
                            </div>
                            <div class="card metric-card" style="min-height:80px; background:rgba(0,0,0,0.15);">
                                <div class="card-label">Feature Shape</div>
                                <div class="card-value" id="dataset-shape" style="font-size:1.5rem; color:var(--accent-secondary);">-</div>
                            </div>
                        </div>
                        
                        <div class="dataset-details-grid" style="display:grid; grid-template-columns: 1.2fr 1.8fr; gap:1.25rem;">
                            <div>
                                <h3 style="font-size:0.85rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.5rem; text-transform:uppercase;">Class Labels</h3>
                                <div style="max-height: 250px; overflow-y:auto; border:1px solid var(--border-color); border-radius:8px; background:rgba(0,0,0,0.25);">
                                    <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                                        <thead>
                                            <tr style="border-bottom:1px solid var(--border-color); background:rgba(255,255,255,0.03);">
                                                <th style="text-align:left; padding:0.5rem; font-weight:600; color:var(--text-muted);">Class</th>
                                                <th style="text-align:right; padding:0.5rem; font-weight:600; color:var(--text-muted);">Count</th>
                                                <th style="text-align:right; padding:0.5rem; font-weight:600; color:var(--text-muted);">Pct</th>
                                            </tr>
                                        </thead>
                                        <tbody id="dataset-classes-tbody">
                                            <tr>
                                                <td colspan="3" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No dataset profile logs received. Call <code>modelsight.log_dataset(...)</code> to profile your dataset.</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div>
                                <h3 style="font-size:0.85rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.5rem; text-transform:uppercase;">Class Distribution</h3>
                                <div id="dataset-chart-container" style="height:250px; border:1px solid var(--border-color); border-radius:8px; background:rgba(0,0,0,0.15); display:flex; align-items:center; justify-content:center; padding:1rem;">
                                    <svg id="dataset-distribution-svg" width="100%" height="100%">
                                        <text x="50%" y="50%" text-anchor="middle" fill="var(--text-muted)" font-size="11">No distribution data</text>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tab 3: Run Comparison Section -->
                <div id="tab-content-comparison" class="w-tab-content hidden">
                    <div class="card" style="display:flex; flex-direction:column; gap:1.25rem;">
                        <div style="border-bottom:1px solid var(--border-color); padding-bottom:0.75rem;">
                            <h2>Run History Comparison Matrix</h2>
                            <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">Select checkboxes in the "Run History" panel on the right to compare active hyperparameters and validation results side-by-side.</p>
                        </div>
                        
                        <div id="comparison-matrix-container" style="overflow-x:auto;">
                            <div id="comparison-placeholder" style="text-align:center; padding:3rem; color:var(--text-muted);">
                                <span style="font-size:2rem; display:block; margin-bottom:0.5rem;">🔬</span>
                                <h3>No runs selected for comparison</h3>
                                <p style="max-width:300px; margin:0.25rem auto 0 auto; font-size:0.8rem;">Select two or more checkboxes in the Run History drawer on the right to construct a side-by-side comparison table here.</p>
                            </div>
                            
                            <table id="comparison-table" class="hidden" style="width:100%; border-collapse:collapse; font-size:0.85rem; border:1px solid var(--border-color);">
                                <thead>
                                    <tr id="comparison-header-row" style="border-bottom:2px solid var(--border-color); background:rgba(255,255,255,0.03);">
                                        <th style="text-align:left; padding:0.75rem; font-weight:700; color:var(--text-primary); min-width:180px; border-right:1px solid var(--border-color);">Metric / Hyperparameter</th>
                                        <!-- Dynamic run column headers go here -->
                                    </tr>
                                </thead>
                                <tbody id="comparison-tbody">
                                    <!-- Dynamic rows go here -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Right Side: Error Explainer & Checkpoints -->
            <section class="right-panel">
                
                <!-- ML Error Explainer Card -->
                <div class="card error-card" id="error-section">
                    <div class="card-header error-header">
                        <h2>ML Error Explainer</h2>
                        <span class="shield-badge">Secure Local</span>
                    </div>
                    
                    <!-- Idle State -->
                    <div id="error-idle" class="error-state-content active">
                        <div class="explanation-placeholder">
                            <span class="icon">🛡️</span>
                            <h3>No errors detected</h3>
                            <p>ModelSight is listening. If your training script fails, the stack trace will be analyzed and explained here in plain language.</p>
                        </div>
                    </div>

                    <!-- Explaining / Active Error State -->
                    <div id="error-active" class="error-state-content hidden">
                        <div class="error-banner">
                            <span class="warning-triangle">⚠️</span>
                            <div>
                                <h3 id="error-category">Tensor Shape Mismatch</h3>
                                <p class="err-raw-line" id="error-raw-line"></p>
                            </div>
                        </div>
                        
                        <div class="explanation-block">
                            <h4>Why it happened</h4>
                            <p id="error-summary-text"></p>
                        </div>

                        <div class="explanation-block">
                            <h4>What to do (Troubleshooting Guide)</h4>
                            <ol id="error-steps-list" class="checklist">
                                <!-- Steps populated dynamically -->
                            </ol>
                        </div>
                    </div>
                </div>

                <!-- Run History & Comparisons -->
                <div class="card history-card">
                    <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem; margin-bottom:0.75rem;">
                        <h2 style="font-size: 1rem; font-weight: 700;">Run History</h2>
                        <button id="clear-history-btn" class="btn btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem;">
                            Clear Logs
                        </button>
                    </div>
                    <div class="history-list-container" style="max-height:160px; overflow-y:auto;">
                        <ul id="history-list" class="history-list" style="list-style:none;">
                            <li id="history-placeholder" class="history-empty" style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:1rem 0;">
                                No past runs saved.
                            </li>
                        </ul>
                    </div>
                </div>

                <!-- Checkpoints Timeline -->
                <div class="card checkpoints-card">
                    <div class="card-header">
                        <h2>Checkpoints & Events</h2>
                    </div>
                    <div class="timeline-container">
                        <ul id="timeline-list" class="timeline">
                            <li class="timeline-empty" id="timeline-placeholder">
                                No checkpoints saved yet.
                            </li>
                        </ul>
                    </div>
                </div>
            </section>
        </main>

        <!-- Bottom Panel: Output Channel Console Log -->
        <footer class="console-panel card">
            <div class="console-header">
                <h2>Raw Telemetry Console Output</h2>
                <div class="console-actions">
                    <button id="toggle-console-btn" class="console-btn">Collapse</button>
                </div>
            </div>
            <div class="console-body" id="console-output-body">
                <pre id="console-log-pre">Welcome to ModelSight. Run a python script to begin streaming output here...</pre>
            </div>
        </footer>
    </div>

    <!-- Script Injection with Security Nonce -->
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

module.exports = {
    DashboardPanel
};
