/**
 * ModelSight Process Monitor
 * Spawns and manages python processes, capturing stdout/stderr and driving telemetry updates.
 */

const { spawn } = require('child_process');
const path = require('path');
const vscode = require('vscode');
const { parseLine } = require('./parser');
const { explainError } = require('./explainer');

class TrainingMonitor {
    constructor() {
        this.process = null;
        this.outputChannel = null;
        this.metricsHistory = [];
        this.stderrBuffer = "";
        this.isTraining = false;
        this.scriptName = "";
        this.lastStoppedTime = 0;
        
        // Callback handlers registered by the dashboard
        this.onMetricCallback = null;
        this.onErrorCallback = null;
        this.onStatusCallback = null;
        this.onStdoutCallback = null;
    }

    /**
     * Start monitoring a python script.
     * 
     * @param {string} scriptPath - Absolute path to the python script.
     * @param {string} extensionPath - Absolute path to the extension folder.
     * @param {object} callbacks - Event callbacks.
     */
    start(scriptPath, extensionPath, callbacks) {
        if (this.isTraining) {
            vscode.window.showWarningMessage("ModelSight is already monitoring a training run.");
            return;
        }

        this.onMetricCallback = callbacks.onMetric;
        this.onErrorCallback = callbacks.onError;
        this.onStatusCallback = callbacks.onStatus;
        this.onStdoutCallback = callbacks.onStdout;

        this.metricsHistory = [];
        this.stderrBuffer = "";
        this.scriptName = path.basename(scriptPath);

        // Get Python path from configuration
        const config = vscode.workspace.getConfiguration('modelsight');
        const pythonPath = config.get('pythonPath') || 'python';

        // Setup Output Channel
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel("ModelSight Monitor");
        }
        this.outputChannel.clear();
        this.outputChannel.show(true); // Bring to front
        this.outputChannel.appendLine(`[ModelSight] Starting: ${pythonPath} "${scriptPath}"`);
        this.outputChannel.appendLine(`[ModelSight] Working Directory: ${path.dirname(scriptPath)}`);
        this.outputChannel.appendLine(`--------------------------------------------------\n`);

        this.isTraining = true;
        if (this.onStatusCallback) {
            this.onStatusCallback({ isTraining: true, scriptName: this.scriptName });
        }

        // Spawn process in python unbuffered mode so stdout streams in real-time
        const env = { ...process.env, PYTHONUNBUFFERED: "1" };
        if (extensionPath) {
            const separator = process.platform === 'win32' ? ';' : ':';
            if (env.PYTHONPATH) {
                env.PYTHONPATH = `${extensionPath}${separator}${env.PYTHONPATH}`;
            } else {
                env.PYTHONPATH = extensionPath;
            }
        }
        
        try {
            this.process = spawn(pythonPath, [scriptPath], {
                cwd: path.dirname(scriptPath),
                env: env,
                shell: false
            });
        } catch (error) {
            this.isTraining = false;
            if (this.onStatusCallback) this.onStatusCallback({ isTraining: false, scriptName: "" });
            vscode.window.showErrorMessage(`Failed to start Python: ${error.message}`);
            return;
        }

        let lineBuffer = "";

        // Process stdout
        this.process.stdout.on('data', (data) => {
            const str = data.toString();
            this.outputChannel.append(str);
            if (this.onStdoutCallback) this.onStdoutCallback(str);

            lineBuffer += str;
            let lines = lineBuffer.split(/\r?\n/);
            // Save the last incomplete line back to the buffer
            lineBuffer = lines.pop();

            for (const line of lines) {
                const cleanLine = line.trim();
                if (!cleanLine) continue;

                const parsed = parseLine(cleanLine);
                if (parsed) {
                    // Try to estimate epoch progress if we can
                    // Check if epoch is present in the line (e.g. "Epoch 3/10" or "epoch=3")
                    const epochMatch = cleanLine.match(/\bepoch[:=]?\s*([0-9]+)(?:\/([0-9]+))?/i);
                    if (epochMatch) {
                        parsed.epoch = parseInt(epochMatch[1], 10);
                        if (epochMatch[2]) {
                            parsed.total_epochs = parseInt(epochMatch[2], 10);
                        }
                    }

                    const stepMatch = cleanLine.match(/\bstep[:=]?\s*([0-9]+)(?:\/([0-9]+))?/i);
                    if (stepMatch) {
                        parsed.step = parseInt(stepMatch[1], 10);
                        if (stepMatch[2]) {
                            parsed.total_steps = parseInt(stepMatch[2], 10);
                        }
                    }

                    // Calculate ETA if possible
                    this.calculateETA(parsed);

                    const hasNumericalMetrics = 
                        parsed.loss !== undefined || 
                        parsed.accuracy !== undefined || 
                        parsed.val_loss !== undefined || 
                        parsed.val_accuracy !== undefined || 
                        parsed.lr !== undefined || 
                        parsed.gpu_usage !== undefined ||
                        parsed.ram_usage !== undefined;

                    if (hasNumericalMetrics) {
                        this.metricsHistory.push(parsed);
                    }

                    // Throttled dashboard UI refresh (max once per 200ms) to ensure lightweight CPU footprint,
                    // but bypass throttle for checkpoints to ensure instant timelines.
                    const now = Date.now();
                    if (!this.lastDispatchTime || (now - this.lastDispatchTime) >= 200 || parsed.checkpoint) {
                        this.lastDispatchTime = now;
                        if (this.onMetricCallback) {
                            this.onMetricCallback(parsed, this.metricsHistory);
                        }
                    }
                }
            }
        });

        // Process stderr
        this.process.stderr.on('data', (data) => {
            const str = data.toString();
            this.outputChannel.append(str);
            if (this.onStdoutCallback) this.onStdoutCallback(str);
            this.stderrBuffer += str;
        });

        // Handle process exit
        this.process.on('close', (code) => {
            this.isTraining = false;
            this.process = null;

            this.outputChannel.appendLine(`\n--------------------------------------------------`);
            this.outputChannel.appendLine(`[ModelSight] Process finished with exit code ${code}`);

            if (this.onStatusCallback) {
                this.onStatusCallback({ isTraining: false, scriptName: "" });
            }

            if (code !== 0 && code !== null) {
                // If it crashed, parse the stderr for explanations
                const explanation = explainError(this.stderrBuffer);
                if (explanation) {
                    if (this.onErrorCallback) {
                        this.onErrorCallback(explanation, this.stderrBuffer);
                    }
                    vscode.window.showErrorMessage(`Training script crashed: ${explanation.category}. View ModelSight Dashboard for details.`);
                } else {
                    vscode.window.showErrorMessage(`Training script crashed with exit code ${code}. Check the ModelSight output tab.`);
                }
            } else {
                vscode.window.showInformationMessage("Training finished successfully!");
            }
        });

        this.process.on('error', (err) => {
            this.isTraining = false;
            this.process = null;
            this.outputChannel.appendLine(`[ModelSight] Process Error: ${err.message}`);
            if (this.onStatusCallback) this.onStatusCallback({ isTraining: false, scriptName: "" });
            vscode.window.showErrorMessage(`Failed to launch script: ${err.message}`);
        });
    }

    /**
     * Stop the running process.
     */
    stop() {
        if (this.process) {
            this.outputChannel.appendLine(`\n[ModelSight] Stopping training run...`);
            this.lastStoppedTime = Date.now();
            
            if (process.platform === 'win32') {
                const { exec } = require('child_process');
                exec(`taskkill /pid ${this.process.pid} /T /F`, (err) => {
                    if (err) {
                        try { this.process.kill('SIGINT'); } catch (e) {}
                    }
                });
            } else {
                this.process.kill('SIGINT');
            }
            
            this.process = null;
        }

        if (this.isTraining) {
            this.isTraining = false;
            if (this.onStatusCallback) this.onStatusCallback({ isTraining: false, scriptName: "" });
            vscode.window.showInformationMessage("ModelSight training monitor stopped.");
        }
    }

    /**
     * Helper to compute training completion progress and remaining time.
     * 
     * @param {object} currentMetric - The newly parsed metric.
     */
    calculateETA(currentMetric) {
        if (this.metricsHistory.length === 0) {
            currentMetric.eta = "Calculating...";
            currentMetric.progress = 0;
            return;
        }

        const startTimestamp = this.metricsHistory[0].timestamp;
        const currentTimestamp = currentMetric.timestamp;
        const elapsedSeconds = (currentTimestamp - startTimestamp) / 1000;

        // Mode 1: Epoch progress
        if (currentMetric.epoch !== undefined && currentMetric.total_epochs !== undefined) {
            const currentEpoch = currentMetric.epoch;
            const totalEpochs = currentMetric.total_epochs;
            
            if (totalEpochs > 0 && currentEpoch > 0) {
                const progress = currentEpoch / totalEpochs;
                currentMetric.progress = progress;

                if (progress >= 1) {
                    currentMetric.eta = "Completed";
                } else {
                    const totalEstimatedSeconds = elapsedSeconds / progress;
                    const remainingSeconds = Math.max(0, totalEstimatedSeconds - elapsedSeconds);
                    currentMetric.eta = this.formatDuration(remainingSeconds);
                }
                return;
            }
        }

        // Mode 2: Step progress
        if (currentMetric.step !== undefined && currentMetric.total_steps !== undefined) {
            const currentStep = currentMetric.step;
            const totalSteps = currentMetric.total_steps;
            
            if (totalSteps > 0 && currentStep > 0) {
                const progress = currentStep / totalSteps;
                currentMetric.progress = progress;

                if (progress >= 1) {
                    currentMetric.eta = "Completed";
                } else {
                    const totalEstimatedSeconds = elapsedSeconds / progress;
                    const remainingSeconds = Math.max(0, totalEstimatedSeconds - elapsedSeconds);
                    currentMetric.eta = this.formatDuration(remainingSeconds);
                }
                return;
            }
        }

        // Fallback: estimate based on length of metrics history vs hypothetical 100 steps
        currentMetric.progress = null;
        currentMetric.eta = "Unknown (need epochs/steps)";
    }

    /**
     * Formats duration in seconds into a friendly string (HH:MM:SS or MM:SS)
     * 
     * @param {number} seconds - Duration in seconds.
     * @returns {string}
     */
    formatDuration(seconds) {
        if (seconds === Infinity || isNaN(seconds)) return "Calculating...";
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hrs > 0) {
            return `${hrs}h ${mins}m ${secs}s`;
        } else if (mins > 0) {
            return `${mins}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
}

module.exports = new TrainingMonitor();
