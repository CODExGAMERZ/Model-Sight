/**
 * ModelSight Extension Entrypoint
 * Activates extension, registers commands, initializes VS Code UI components (Status Bar),
 * manages local HTTP telemetry server (Jupyter support), and handles run history/reporting.
 */

const vscode = require('vscode');
const path = require('path');
const http = require('http');
const fs = require('fs');
const monitor = require('./monitor');
const { DashboardPanel } = require('./dashboard');

let statusBarItem = null;
let telemetryServer = null;
let extensionContext = null;

/**
 * Activates the extension.
 * @param {vscode.ExtensionContext} context 
 */
function activate(context) {
    extensionContext = context;
    console.log('[ModelSight] Extension is now activating.');

    // 0. Auto-copy modelsight.py helper to workspace roots
    const config = vscode.workspace.getConfiguration('modelsight');
    const autoCopy = config.get('autoCopyHelper') !== false;
    if (autoCopy) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                const destPath = path.join(folder.uri.fsPath, 'modelsight.py');
                const sourcePath = path.join(context.extensionPath, 'modelsight.py');
                if (fs.existsSync(sourcePath) && !fs.existsSync(destPath)) {
                    try {
                        fs.copyFileSync(sourcePath, destPath);
                        console.log(`[ModelSight] Auto-copied modelsight.py to workspace root: ${folder.uri.fsPath}`);
                    } catch (err) {
                        console.error(`[ModelSight] Failed to auto-copy modelsight.py to workspace root:`, err);
                    }
                }
            }
        }
    }

    // 1. Initialize Status Bar Item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(graph) ModelSight: Idle";
    statusBarItem.command = 'modelsight.openDashboard';
    statusBarItem.tooltip = 'Show ModelSight Dashboard';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // 2. Start Local Telemetry Server
    startTelemetryServer(context);

    // 3. Command: Open Dashboard
    const openDashboardCmd = vscode.commands.registerCommand('modelsight.openDashboard', () => {
        const panel = DashboardPanel.createOrShow(context.extensionUri);
        
        // Sync active state if monitor is already running
        if (monitor.isTraining) {
            panel.updateStatus({ isTraining: true, scriptName: monitor.scriptName });
        } else {
            panel.updateStatus({ isTraining: false, scriptName: "" });
        }
        panel.updateHistory(monitor.metricsHistory);
        
        // Send history list to webview
        const runs = context.workspaceState.get('modelsight.runs') || [];
        panel.sendHistoryList(runs);
    });
    context.subscriptions.push(openDashboardCmd);

    // 4. Command: Run Python Script with Monitor
    const runMonitorCmd = vscode.commands.registerCommand('modelsight.runMonitor', async (uri) => {
        let scriptPath = null;
        
        // Resolve script path from context menu parameter or active text editor
        if (uri && uri.fsPath) {
            scriptPath = uri.fsPath;
        } else {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.languageId === 'python') {
                scriptPath = activeEditor.document.fileName;
            }
        }

        if (!scriptPath) {
            vscode.window.showErrorMessage("ModelSight: Please open a Python training file or right-click one in the Explorer to run.");
            return;
        }

        // Guard: check if monitor is busy
        if (monitor.isTraining) {
            const response = await vscode.window.showWarningMessage(
                `ModelSight is already running a script ("${monitor.scriptName}"). Do you want to terminate it and start the new script?`,
                "Yes, Stop and Restart", "No, Keep Running"
            );
            if (response === "Yes, Stop and Restart") {
                monitor.stop();
            } else {
                return;
            }
        }

        // Retrieve config and reveal dashboard
        const config = vscode.workspace.getConfiguration('modelsight');
        const autoOpen = config.get('autoOpenDashboard') !== false;
        
        let panel = null;
        if (autoOpen) {
            panel = DashboardPanel.createOrShow(context.extensionUri);
            panel.updateStatus({ isTraining: true, scriptName: path.basename(scriptPath) });
            panel.updateHistory([]);
            const runs = context.workspaceState.get('modelsight.runs') || [];
            panel.sendHistoryList(runs);
        }

        // Update status bar decoration
        statusBarItem.text = "$(pulse) ModelSight: Training...";
        statusBarItem.tooltip = 'Training script is running. Click to view Dashboard.';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');

        // Auto-copy helper to script's directory if enabled
        if (config.get('autoCopyHelper') !== false) {
            const destPath = path.join(path.dirname(scriptPath), 'modelsight.py');
            const sourcePath = path.join(context.extensionPath, 'modelsight.py');
            if (fs.existsSync(sourcePath) && !fs.existsSync(destPath)) {
                try {
                    fs.copyFileSync(sourcePath, destPath);
                    console.log(`[ModelSight] Auto-copied modelsight.py to script dir: ${path.dirname(scriptPath)}`);
                } catch (err) {
                    console.error(`[ModelSight] Failed to auto-copy modelsight.py to script dir:`, err);
                }
            }
        }

        // Fire process monitor
        monitor.start(scriptPath, context.extensionPath, {
            onMetric: (metric, history) => {
                const activePanel = panel || DashboardPanel.currentPanel;
                if (activePanel) {
                    activePanel.updateMetric(metric, history);
                }
            },
            onError: (explanation, rawTraceback) => {
                statusBarItem.text = "$(error) ModelSight: Crashed";
                statusBarItem.tooltip = 'Model training crashed. Click to view analysis.';
                statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');

                // Force open dashboard on crash to show explanation
                const activePanel = DashboardPanel.createOrShow(context.extensionUri);
                activePanel.showError(explanation, rawTraceback);
            },
            onStatus: (status) => {
                const activePanel = panel || DashboardPanel.currentPanel;
                if (activePanel) {
                    activePanel.updateStatus(status);
                }
                
                if (!status.isTraining) {
                    // Training complete! Save to run history
                    if (monitor.metricsHistory && monitor.metricsHistory.length > 0) {
                        saveRunToHistory(context, monitor.scriptName, monitor.metricsHistory);
                    }
                    
                    // Back to normal
                    if (statusBarItem.text.includes("Training")) {
                        statusBarItem.text = "$(graph) ModelSight: Idle";
                        statusBarItem.tooltip = 'Click to open ModelSight Dashboard';
                        statusBarItem.backgroundColor = undefined;
                    }
                }
            },
            onStdout: (text) => {
                const activePanel = panel || DashboardPanel.currentPanel;
                if (activePanel) {
                    activePanel.appendStdout(text);
                }
            }
        });
    });
    context.subscriptions.push(runMonitorCmd);

    // 5. Command: Stop Monitor
    const stopMonitorCmd = vscode.commands.registerCommand('modelsight.stopMonitor', () => {
        if (monitor.isTraining) {
            monitor.stop();
        } else {
            vscode.window.showInformationMessage("ModelSight training monitor is not running.");
        }
        
        statusBarItem.text = "$(graph) ModelSight: Idle";
        statusBarItem.tooltip = 'Click to open ModelSight Dashboard';
        statusBarItem.backgroundColor = undefined;
    });
    context.subscriptions.push(stopMonitorCmd);

    // 6. Command: Install Python Helper via pip
    const installPythonHelperCmd = vscode.commands.registerCommand('modelsight.installPythonHelper', () => {
        const config = vscode.workspace.getConfiguration('modelsight');
        const pythonPath = config.get('pythonPath') || 'python';
        const extensionPath = context.extensionPath;
        
        vscode.window.showInformationMessage(`Installing ModelSight Python Helper into: ${pythonPath}`);
        
        const terminalName = "ModelSight Installer";
        let terminal = vscode.window.terminals.find(t => t.name === terminalName);
        if (!terminal) {
            terminal = vscode.window.createTerminal(terminalName);
        }
        terminal.show();
        terminal.sendText(`"${pythonPath}" -m pip install "${extensionPath}"`);
    });
    context.subscriptions.push(installPythonHelperCmd);
}

/**
 * Launches local HTTP telemetry receiver server (runs purely locally on 127.0.0.1:9824).
 * Handles live logs from Jupyter notebooks cell commands.
 */
function startTelemetryServer(context) {
    if (telemetryServer) return;

    telemetryServer = http.createServer((req, res) => {
        // Handle CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        if (req.method === 'POST' && req.url === '/metrics') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const metric = JSON.parse(body);

                    // If we recently stopped a training run, ignore HTTP telemetry for 2 seconds to discard late/zombie requests
                    if (monitor.lastStoppedTime && (Date.now() - monitor.lastStoppedTime) < 2000) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'ignored' }));
                        return;
                    }

                    // If we are already running a monitored script, ignore HTTP telemetry to avoid duplication
                    if (monitor.isTraining && monitor.scriptName !== "Jupyter Notebook") {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'ignored' }));
                        return;
                    }

                    // Auto start session if idle
                    if (!monitor.isTraining) {
                        monitor.isTraining = true;
                        monitor.scriptName = "Jupyter Notebook";
                        monitor.metricsHistory = [];
                        monitor.stderrBuffer = "";

                        const panel = DashboardPanel.currentPanel;
                        if (panel) {
                            panel.updateStatus({ isTraining: true, scriptName: "Jupyter Notebook" });
                            panel.updateHistory([]);
                            const runs = context.workspaceState.get('modelsight.runs') || [];
                            panel.sendHistoryList(runs);
                        }

                        if (statusBarItem) {
                            statusBarItem.text = "$(pulse) ModelSight: Notebook...";
                            statusBarItem.tooltip = 'Streaming notebook cell telemetry...';
                            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                        }
                    }

                    // Compute ETA & Step values
                    metric.timestamp = Date.now();
                    
                    // Inject epochs/steps if present in keys
                    if (metric.epoch !== undefined) {
                        metric.epoch = parseInt(metric.epoch, 10);
                        if (metric.total_epochs) metric.total_epochs = parseInt(metric.total_epochs, 10);
                    }
                    if (metric.step !== undefined) {
                        metric.step = parseInt(metric.step, 10);
                        if (metric.total_steps) metric.total_steps = parseInt(metric.total_steps, 10);
                    }

                    monitor.calculateETA(metric);
                    monitor.metricsHistory.push(metric);

                    // Sync metrics payload to frontend panel
                    const panel = DashboardPanel.currentPanel;
                    if (panel) {
                        panel.updateMetric(metric, monitor.metricsHistory);
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok' }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
                }
            });
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    telemetryServer.listen(9824, '127.0.0.1', () => {
        console.log('[ModelSight] Local telemetry server listening on http://127.0.0.1:9824');
    });

    telemetryServer.on('error', (err) => {
        console.error('[ModelSight] Telemetry server error:', err);
    });
}

/**
 * Persist run summaries to workspace local state.
 */
function saveRunToHistory(context, scriptName, history) {
    if (!history || history.length === 0) return;

    let runs = context.workspaceState.get('modelsight.runs') || [];
    
    // Collect final summary
    const finalPoint = history[history.length - 1];
    const duration = history.length > 1 ? Math.round((finalPoint.timestamp - history[0].timestamp) / 1000) : 0;
    
    let finalLoss = null;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].loss !== undefined && history[i].loss !== null) {
            finalLoss = history[i].loss;
            break;
        }
    }
    
    let finalAccuracy = null;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].accuracy !== undefined && history[i].accuracy !== null) {
            finalAccuracy = history[i].accuracy;
            break;
        }
    }
    
    const newRun = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        scriptName: scriptName,
        history: history,
        duration: duration,
        finalLoss: finalLoss,
        finalAccuracy: finalAccuracy
    };

    runs.unshift(newRun);
    runs = runs.slice(0, 10); // cap history logs at 10 runs

    context.workspaceState.update('modelsight.runs', runs);

    const panel = DashboardPanel.currentPanel;
    if (panel) {
        panel.sendHistoryList(runs);
    }
}

/**
 * Handle report exporter command by opening VS Code Save Dialog.
 */
async function handleExportReport(reportData) {
    const defaultName = `modelsight_report_${Date.now()}.${reportData.format}`;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || '';
    
    const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(workspaceFolder, defaultName)),
        filters: reportData.format === 'html' ? { 'HTML Webpage': ['html'] } : { 'Markdown File': ['md'] }
    });

    if (uri) {
        try {
            fs.writeFileSync(uri.fsPath, reportData.content, 'utf-8');
            vscode.window.showInformationMessage(`ModelSight report exported successfully to: ${path.basename(uri.fsPath)}`);
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to export report: ${err.message}`);
        }
    }
}

/**
 * Clear runs history in workspace state.
 */
function clearRunsHistory() {
    if (extensionContext) {
        extensionContext.workspaceState.update('modelsight.runs', []);
        const { DashboardPanel } = require('./dashboard');
        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel.sendHistoryList([]);
        }
        vscode.window.showInformationMessage("ModelSight run history cleared!");
    }
}

/**
 * Clean up active execution logs when extension closes.
 */
function deactivate() {
    monitor.stop();
    if (telemetryServer) {
        telemetryServer.close();
    }
}

module.exports = {
    activate,
    deactivate,
    handleExportReport,
    saveRunToHistory,
    clearRunsHistory
};
