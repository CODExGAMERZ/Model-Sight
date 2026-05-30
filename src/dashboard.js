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

        <!-- Main Dashboard Workspace -->
        <main class="dashboard-grid">
            
            <!-- Left Side: Metrics & Charts -->
            <section class="left-panel">
                
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

                    <!-- Hardware & Progress Cards -->
                    <div class="card metric-card" id="card-hardware">
                        <div class="card-label">GPU Usage</div>
                        <div class="card-value" id="val-gpu">-</div>
                        <div class="card-progress">
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill" id="bar-gpu" style="width: 0%"></div>
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

                <!-- ETA & Training Progress Banner -->
                <div class="card eta-card" id="eta-banner">
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
                <div class="card charts-card">
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
