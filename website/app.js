// ModelSight Client-Side Simulated Telemetry and Diagnostics Explainer Engine

document.addEventListener('DOMContentLoaded', () => {
  // --- Navigation & Tab Logic ---
  const tabButtons = document.querySelectorAll('.dashboard-tabs .tab-btn');
  const tabPanes = document.querySelectorAll('.dashboard-viewport .tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      
      // Update tab buttons active state
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update tab panes active state
      tabPanes.forEach(pane => {
        if (pane.id === `tab-${targetTab}`) {
          pane.classList.add('active');
        } else {
          pane.classList.remove('active');
        }
      });
    });
  });

  // --- Console Panel Collapsible Logic ---
  const consolePanel = document.querySelector('.console-panel');
  const toggleConsoleBtn = document.getElementById('btn-toggle-console');

  toggleConsoleBtn.addEventListener('click', () => {
    if (consolePanel.classList.contains('collapsed')) {
      consolePanel.classList.remove('collapsed');
      toggleConsoleBtn.textContent = 'Collapse';
    } else {
      consolePanel.classList.add('collapsed');
      toggleConsoleBtn.textContent = 'Expand';
    }
  });

  // --- Telemetry Simulation Logic ---
  const startBtn = document.getElementById('sim-btn-start');
  const stopBtn = document.getElementById('sim-btn-stop');
  const resetBtn = document.getElementById('sim-btn-clear');
  const statusPulse = document.getElementById('status-pulse-dot');
  const statusText = document.getElementById('status-text');
  const activeScript = document.getElementById('active-script-name');
  const tbBadge = document.getElementById('tb-badge');
  const wandbBadge = document.getElementById('wandb-badge');

  // Metric displays
  const valLoss = document.getElementById('val-loss');
  const footerLoss = document.getElementById('footer-loss');
  const valAccuracy = document.getElementById('val-accuracy');
  const barAccuracy = document.getElementById('bar-accuracy');
  const valLr = document.getElementById('val-lr');
  const valGpu = document.getElementById('val-gpu');
  const gpuTemp = document.getElementById('gpu-temp');
  const valRam = document.getElementById('val-ram');
  const barRam = document.getElementById('bar-ram');
  const valOverfit = document.getElementById('val-overfit');
  const barOverfit = document.getElementById('bar-overfit');

  // Progress banner elements
  const barProgress = document.getElementById('bar-progress');
  const progressText = document.getElementById('progress-text');
  const progressEpochs = document.getElementById('progress-epochs');
  const valEta = document.getElementById('val-eta');

  // SVGs for drawing charts
  const liveChart = document.getElementById('live-chart');

  // Logs terminal
  const consoleLog = document.getElementById('console-log-pre');
  const timelineList = document.getElementById('timeline-list');
  const historyList = document.getElementById('history-list');
  const historyEmpty = document.getElementById('history-empty');

  // Comparison Matrix elements
  const compEpoch = document.getElementById('comp-epoch');
  const compLr = document.getElementById('comp-lr');
  const compLoss = document.getElementById('comp-loss');
  const compAcc = document.getElementById('comp-acc');
  const compRisk = document.getElementById('comp-risk');

  // State Variables
  let simInterval = null;
  let currentEpoch = 0;
  const maxEpochs = 30;
  let historyData = [];
  
  // Data vectors for SVG drawing
  let lossHistory = [];
  let valLossHistory = [];
  let accuracyHistory = [];

  // Reset simulator view to initial state
  function resetSimulation() {
    clearInterval(simInterval);
    simInterval = null;
    currentEpoch = 0;
    lossHistory = [];
    valLossHistory = [];
    accuracyHistory = [];

    // UI resets
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    statusPulse.className = 'dot-active';
    statusText.textContent = 'Status: Idle';
    activeScript.textContent = 'None';
    tbBadge.classList.add('hidden');
    wandbBadge.classList.add('hidden');

    valLoss.textContent = '-';
    footerLoss.textContent = 'Waiting for telemetry';
    valAccuracy.textContent = '-';
    barAccuracy.style.width = '0%';
    valLr.textContent = '-';
    valGpu.textContent = '-';
    gpuTemp.textContent = 'Temp: -';
    valRam.textContent = '-';
    barRam.style.width = '0%';
    valOverfit.textContent = 'Low';
    valOverfit.style.color = '';
    barOverfit.className = 'progress-bar-fill success';
    barOverfit.style.width = '0%';

    barProgress.style.width = '0%';
    progressText.textContent = '0% Complete';
    progressEpochs.textContent = 'Epochs 0/30';
    valEta.textContent = 'Calculating ETA...';

    consoleLog.innerHTML = 'Welcome to ModelSight. Run a simulation to start streaming Python logs here...';
    timelineList.innerHTML = '<li class="timeline-empty" id="timeline-empty-item">No timeline logs recorded yet.</li>';

    // Clear SVG chart
    liveChart.innerHTML = '';
  }

  // Draw chart in SVG
  function updateSVGChart() {
    if (lossHistory.length < 2) return;
    liveChart.innerHTML = '';

    const width = liveChart.clientWidth || 400;
    const height = 220;
    const padding = 30;
    
    // Find min/max for scale
    const maxVal = 2.5; // fixed scale for loss or auto-scaled
    const minVal = 0.0;

    // Helper coordinates mapper
    const getX = (index) => padding + (index / (maxEpochs - 1)) * (width - 2 * padding);
    const getY = (value) => height - padding - ((value - minVal) / (maxVal - minVal)) * (height - 2 * padding);

    // Create training loss path
    let trainPathStr = `M ${getX(0)} ${getY(lossHistory[0])}`;
    for (let i = 1; i < lossHistory.length; i++) {
      trainPathStr += ` L ${getX(i)} ${getY(lossHistory[i])}`;
    }

    // Create validation loss path
    let valPathStr = `M ${getX(0)} ${getY(valLossHistory[0])}`;
    for (let i = 1; i < valLossHistory.length; i++) {
      valPathStr += ` L ${getX(i)} ${getY(valLossHistory[i])}`;
    }

    // Draw grid lines
    const gridY = 4;
    for (let i = 0; i <= gridY; i++) {
      const yVal = minVal + (maxVal - minVal) * (i / gridY);
      const yPos = getY(yVal);
      
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", padding);
      line.setAttribute("y1", yPos);
      line.setAttribute("x2", width - padding);
      line.setAttribute("y2", yPos);
      line.setAttribute("stroke", "rgba(255, 255, 255, 0.04)");
      line.setAttribute("stroke-width", "1");
      liveChart.appendChild(line);

      // Label text
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", padding - 5);
      text.setAttribute("y", yPos + 4);
      text.setAttribute("fill", "var(--text-muted)");
      text.setAttribute("font-size", "8");
      text.setAttribute("text-anchor", "end");
      text.textContent = yVal.toFixed(2);
      liveChart.appendChild(text);
    }

    // Draw Train Path (Indigo/Coral glow)
    const trainPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    trainPath.setAttribute("d", trainPathStr);
    trainPath.setAttribute("fill", "none");
    trainPath.setAttribute("stroke", "var(--accent-primary)");
    trainPath.setAttribute("stroke-width", "2.5");
    liveChart.appendChild(trainPath);

    // Draw Val Path (Coral/Rose glow)
    const valPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    valPath.setAttribute("d", valPathStr);
    valPath.setAttribute("fill", "none");
    valPath.setAttribute("stroke", "var(--accent-secondary)");
    valPath.setAttribute("stroke-dasharray", "4,4");
    valPath.setAttribute("stroke-width", "2");
    liveChart.appendChild(valPath);

    // Legend dots/names inside SVG
    const legendTrain = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    legendTrain.setAttribute("cx", width - 120);
    legendTrain.setAttribute("cy", 20);
    legendTrain.setAttribute("r", "4");
    legendTrain.setAttribute("fill", "var(--accent-primary)");
    liveChart.appendChild(legendTrain);

    const legendTrainTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    legendTrainTxt.setAttribute("x", width - 110);
    legendTrainTxt.setAttribute("y", 23);
    legendTrainTxt.setAttribute("fill", "var(--text-secondary)");
    legendTrainTxt.setAttribute("font-size", "9");
    legendTrainTxt.textContent = "Train Loss";
    liveChart.appendChild(legendTrainTxt);

    const legendVal = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    legendVal.setAttribute("cx", width - 60);
    legendVal.setAttribute("cy", 20);
    legendVal.setAttribute("r", "4");
    legendVal.setAttribute("fill", "var(--accent-secondary)");
    liveChart.appendChild(legendVal);

    const legendValTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    legendValTxt.setAttribute("x", width - 50);
    legendValTxt.setAttribute("y", 23);
    legendValTxt.setAttribute("fill", "var(--text-secondary)");
    legendValTxt.setAttribute("font-size", "9");
    legendValTxt.textContent = "Val Loss";
    liveChart.appendChild(legendValTxt);
  }

  // Append items to checking timeline
  function addTimelineEvent(message) {
    const emptyItem = document.getElementById('timeline-empty-item');
    if (emptyItem) emptyItem.remove();

    const li = document.createElement('li');
    li.className = 'timeline-item';
    li.innerHTML = `<strong>Epoch ${currentEpoch}</strong>: ${message}`;
    timelineList.appendChild(li);
    timelineList.scrollTop = timelineList.scrollHeight;
  }

  // Simulated telemetry training epoch step
  function runEpochStep() {
    currentEpoch++;

    if (currentEpoch > maxEpochs) {
      completeSimulation();
      return;
    }

    // Mathematical approximations for loss/accuracy curve
    const lr = 0.001 * Math.pow(0.92, currentEpoch - 1);
    
    // Train Loss decays from 2.3 down to 0.12
    const trainLoss = 0.1 + 2.2 * Math.exp(-0.15 * currentEpoch) + (Math.random() * 0.03 - 0.015);
    // Val Loss decays to 0.15, but has a slight divergence after epoch 20 (mocking slight overfitting)
    let valLossVal = 0.14 + 2.15 * Math.exp(-0.14 * currentEpoch);
    if (currentEpoch > 20) {
      valLossVal += 0.008 * (currentEpoch - 20) + (Math.random() * 0.02 - 0.01);
    } else {
      valLossVal += (Math.random() * 0.02 - 0.01);
    }

    // Accuracy starts at 10%, grows to ~95%
    const acc = 95 - 85 * Math.exp(-0.16 * currentEpoch) + (Math.random() * 0.4 - 0.2);

    // Update history arrays
    lossHistory.push(trainLoss);
    valLossHistory.push(valLossVal);
    accuracyHistory.push(acc);

    // Update charts
    updateSVGChart();

    // Hardware status simulations
    const gpuPercent = Math.floor(75 + Math.random() * 15);
    const tempVal = Math.floor(66 + Math.random() * 8);
    const ramPercent = Math.floor(45 + Math.random() * 3);
    const ramGb = (16 * ramPercent / 100).toFixed(1);

    // Overfitting evaluation
    let overfitPercent = 0;
    let overfitText = 'Low';
    let overfitClass = 'progress-bar-fill success';

    if (currentEpoch > 20) {
      overfitPercent = Math.floor((currentEpoch - 20) * 8);
      overfitText = 'Moderate';
      overfitClass = 'progress-bar-fill warning';
      if (overfitPercent > 50) {
        overfitText = 'High';
        overfitClass = 'progress-bar-fill danger';
      }
    }

    // Update metrics UI
    valLoss.textContent = trainLoss.toFixed(4);
    footerLoss.textContent = `Val Loss: ${valLossVal.toFixed(4)}`;
    
    valAccuracy.textContent = `${acc.toFixed(1)}%`;
    barAccuracy.style.width = `${acc}%`;

    valLr.textContent = lr.toExponential(3);

    valGpu.textContent = `${gpuPercent}%`;
    gpuTemp.textContent = `Temp: ${tempVal}°C`;

    valRam.textContent = `${ramGb} GB`;
    barRam.style.width = `${ramPercent}%`;

    valOverfit.textContent = overfitText;
    barOverfit.className = overfitClass;
    barOverfit.style.width = `${overfitPercent}%`;

    // Progress bar updates
    const percentComplete = Math.round((currentEpoch / maxEpochs) * 100);
    barProgress.style.width = `${percentComplete}%`;
    progressText.textContent = `${percentComplete}% Complete`;
    progressEpochs.textContent = `Epochs ${currentEpoch}/${maxEpochs}`;
    
    const etaSecs = Math.max(0, (maxEpochs - currentEpoch) * 0.8);
    valEta.textContent = etaSecs > 0 ? `ETA: ${etaSecs.toFixed(1)}s` : 'Completed';

    // Update status text
    statusText.textContent = `Status: Training (Epoch ${currentEpoch}/${maxEpochs})`;

    // Append raw logs to terminal
    if (consoleLog.innerHTML.startsWith("Welcome")) {
      consoleLog.innerHTML = "";
    }
    const logLine = `[Epoch ${currentEpoch}/${maxEpochs}] loss: ${trainLoss.toFixed(4)} - val_loss: ${valLossVal.toFixed(4)} - accuracy: ${(acc/100).toFixed(4)} - lr: ${lr.toExponential(4)} - gpu_temp: ${tempVal}°C\n`;
    consoleLog.innerHTML += logLine;
    consoleLog.scrollTop = consoleLog.scrollHeight;

    // Timeline trigger events
    if (currentEpoch === 1) {
      addTimelineEvent("Initialized AdamW optimizer and loaded model layers on CUDA:0");
    }
    if (currentEpoch === 5) {
      addTimelineEvent("Initial weights stabilized. Learning rate scheduler started decaying steps.");
    }
    if (currentEpoch === 15) {
      addTimelineEvent("Model checkpoint saved. Accuracy passed 90% boundary.");
    }
    if (currentEpoch === 22) {
      addTimelineEvent("Alert: Validation gradient divergence detected. Overfitting risk raised to Moderate.");
    }

    // Keep comparison matrix updated with live metrics
    compEpoch.textContent = `${currentEpoch}/${maxEpochs}`;
    compLr.textContent = lr.toExponential(3);
    compLoss.textContent = trainLoss.toFixed(3);
    compAcc.textContent = `${acc.toFixed(1)}%`;
    compRisk.textContent = overfitText;
  }

  function startSimulation() {
    resetSimulation();
    
    // UI elements update
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    statusPulse.className = 'dot-active pulsing';
    statusText.textContent = 'Status: Initializing...';
    activeScript.textContent = 'mnist_classifier.py';
    tbBadge.classList.remove('hidden');
    wandbBadge.classList.remove('hidden');

    addTimelineEvent("Loaded dataset 'ImageNet_Sample_Train' (50,000 samples)");
    addTimelineEvent("Starting training loop script: mnist_classifier.py");

    // Loop runs every 800ms
    simInterval = setInterval(runEpochStep, 800);
  }

  function stopSimulation() {
    clearInterval(simInterval);
    simInterval = null;
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    statusPulse.className = 'dot-active';
    statusText.textContent = 'Status: Paused';
    addTimelineEvent("Training simulation execution paused manually by user.");
  }

  function completeSimulation() {
    clearInterval(simInterval);
    simInterval = null;
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    statusPulse.className = 'dot-active';
    statusText.textContent = 'Status: Completed';
    addTimelineEvent("Training session completed successfully. 30 epochs processed.");

    // Add to Run History List
    if (historyEmpty) historyEmpty.classList.add('hidden');
    
    const finalAccuracy = accuracyHistory[accuracyHistory.length - 1].toFixed(1);
    const finalLoss = lossHistory[lossHistory.length - 1].toFixed(4);
    
    const li = document.createElement('li');
    li.className = 'history-item';
    li.innerHTML = `<span>mnist_classifier.py</span> <span class="success">Acc: ${finalAccuracy}% (Loss: ${finalLoss})</span>`;
    historyList.appendChild(li);
    historyList.scrollTop = historyList.scrollHeight;
  }

  // Event Listeners for Simulation
  startBtn.addEventListener('click', startSimulation);
  stopBtn.addEventListener('click', stopSimulation);
  resetBtn.addEventListener('click', resetSimulation);

  // Resize listener to re-draw chart correctly
  window.addEventListener('resize', () => {
    if (lossHistory.length >= 2) {
      updateSVGChart();
    }
  });


  // --- Diagnostics Traceback Explainer Section ---
  const tracebackTextarea = document.getElementById('traceback-textarea');
  const runExplainerBtn = document.getElementById('btn-run-explainer');
  const resetExplainerBtn = document.getElementById('btn-reset-explainer');
  const inputArea = document.getElementById('explainer-input-area');
  const diagArea = document.getElementById('explainer-diagnostic-area');

  const diagCategory = document.getElementById('diag-category');
  const diagRawLine = document.getElementById('diag-raw-line');
  const diagWhy = document.getElementById('diag-why');
  const diagSteps = document.getElementById('diag-steps');

  function explainError(errorText) {
    if (!errorText || typeof errorText !== 'string') return null;

    const lines = errorText.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) return null;

    let targetLine = '';
    const errorPrefixes = [
      'RuntimeError:', 'ValueError:', 'TypeError:', 'IndexError:', 
      'KeyError:', 'AttributeError:', 'FileNotFoundError:', 'NameError:', 
      'ZeroDivisionError:', 'SyntaxError:', 'ImportError:', 'ModuleNotFoundError:',
      'OSError:'
    ];

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (errorPrefixes.some(prefix => line.startsWith(prefix))) {
        targetLine = line;
        break;
      }
    }

    if (!targetLine) {
      targetLine = lines[lines.length - 1];
    }

    // 1. CUDA Out of Memory (OOM)
    if (/out of memory/i.test(targetLine) || 
        /OutOfMemoryError/i.test(targetLine) ||
        (/allocate/i.test(targetLine) && /memory/i.test(targetLine))) {
      return {
        category: "CUDA Out of Memory (OOM)",
        why: "Deep learning models require significant GPU memory. This crash happens when the combined size of your model parameters, optimizer states, gradients, and the active batch of data exceeds the physical memory capacity of your GPU.",
        steps: [
          "Decrease the batch size in your training DataLoader (e.g., from 64 to 32, 16, or 8).",
          "Wrap validation loops in the 'with torch.no_grad():' context manager to prevent PyTorch from storing gradients.",
          "Clear the GPU cache before/after epochs using 'torch.cuda.empty_cache()'.",
          "Use gradient accumulation to split a large batch into smaller sub-batches while maintaining the same effective batch size."
        ],
        raw: targetLine
      };
    }

    // 2. Loss Function Dimension Mismatch
    if (/Target and input must have/i.test(targetLine) || 
        /Expected input batch_size/i.test(targetLine) || 
        /target.*invalid shape/i.test(targetLine) || 
        /multi-target not supported/i.test(targetLine) || 
        /Target size.*predict.*size/i.test(targetLine)) {
      return {
        category: "Loss Function Dimension Mismatch",
        why: "ML loss functions expect very specific input and target shapes. For example: CrossEntropyLoss expects predictions of shape (N, C) containing logits, and targets of shape (N) containing integer class indices, not float vectors.",
        steps: [
          "Print shapes right before calculating loss: 'print(predictions.shape, targets.shape)'.",
          "Verify loss function requirements. Ensure targets are 1D integer tensors containing class indices.",
          "If targets have an extra dimension (like (N, 1) instead of (N)), use 'targets.squeeze()' to remove it.",
          "If using binary classification, ensure targets are cast to float: 'targets = targets.float()'."
        ],
        raw: targetLine
      };
    }

    // 3. Missing Dependency / Library
    if (targetLine.startsWith("ModuleNotFoundError:") || targetLine.startsWith("ImportError:")) {
      return {
        category: "Missing Dependency / Library",
        why: "This happens when you import a library (like torch, numpy, pandas, sklearn, or matplotlib) that is not installed in the currently active Python interpreter or virtual environment.",
        steps: [
          "Install the missing package in your terminal: run 'pip install <package_name>'.",
          "Verify that VS Code is using the correct virtual environment by running 'Python: Select Interpreter' in the Command Palette."
        ],
        raw: targetLine
      };
    }

    // 4. Python Syntax or Reference Error
    if (targetLine.startsWith("NameError:") || 
        targetLine.startsWith("SyntaxError:") || 
        targetLine.startsWith("IndentationError:")) {
      return {
        category: "Python Syntax or Reference Error",
        why: "Standard programming syntax error. Usually a typo in a variable or function name, a missing import statement, or an indentation alignment.",
        steps: [
          "Check the traceback to find the exact line and file where the error occurred.",
          "Verify that you have spelled all variables and functions correctly.",
          "Ensure that you have imported the module containing the missing name (e.g. 'import torch').",
          "Check that you are consistently using either spaces or tabs for indentation (never mix them)."
        ],
        raw: targetLine
      };
    }

    // 5. Numerical Instability / Exploding Gradients
    if (/NaN/i.test(targetLine) || 
        /Infinity/i.test(targetLine) || 
        /ZeroDivisionError/i.test(targetLine) || 
        /division by zero/i.test(targetLine)) {
      return {
        category: "Numerical Instability / Exploding Gradients",
        why: "Your model weights, loss, or gradients have become NaN (Not a Number) or infinite, causing training to fail. Exploding gradients usually occur when the learning rate is too high and weights grow exponentially.",
        steps: [
          "Lower your learning rate (e.g. try 1e-4 or 1e-5 instead of 1e-2).",
          "Add a small epsilon value (e.g. 1e-7) to denominators or log inputs: 'torch.log(x + 1e-7)'.",
          "Apply gradient clipping in your training loop: 'torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)'.",
          "Use normalization layers (BatchNorm/LayerNorm) to stabilize training activations."
        ],
        raw: targetLine
      };
    }

    // 6. CUDA Driver / Hardware Initialization Error
    if (/CUDA driver version is insufficient/i.test(targetLine) || 
        /NVIDIA-SMI has failed/i.test(targetLine) || 
        /no CUDA-capable device/i.test(targetLine) || 
        /CUDA is not available/i.test(targetLine)) {
      return {
        category: "CUDA Driver / Hardware Initialization Error",
        why: "PyTorch or TensorFlow cannot communicate with your NVIDIA GPU or CUDA runtime. This happens if drivers are missing, mismatched, or if you installed a CPU-only version of PyTorch.",
        steps: [
          "Verify your GPU drivers are up-to-date by running 'nvidia-smi' in the terminal.",
          "Check if CUDA is available in Python: 'import torch; print(torch.cuda.is_available())'.",
          "If it returns False, reinstall PyTorch with the correct CUDA version from the official website."
        ],
        raw: targetLine
      };
    }

    // 7. Tensor Shape Mismatch
    if (/mat1 and mat2 shapes cannot be multiplied/i.test(targetLine) || 
        /shapes.*not.*compatible/i.test(targetLine) ||
        /size mismatch/i.test(targetLine) ||
        /dimension mismatch/i.test(targetLine) ||
        /cannot reshape tensor/i.test(targetLine) ||
        /mismatch in dimension/i.test(targetLine) ||
        /shape.*does not match/i.test(targetLine) ||
        /size.*must match/i.test(targetLine) ||
        /shapes.*not.*aligned/i.test(targetLine)) {
      return {
        category: "Tensor Shape Mismatch",
        why: "The size of your input data doesn't match the size expected by the model layer. Commonly happens if a tensor is not flattened before entering a Fully Connected layer, or if output dimensions do not align with the next layer.",
        steps: [
          "Print the shape of the tensor immediately before the failing layer: 'print(tensor.shape)'.",
          "Ensure you apply a flattening operation right before passing the tensor to your Linear layer: 'torch.flatten(x, 1)'.",
          "Verify the in_features dimension of your Linear layer matches the preceding layer output dimensions."
        ],
        raw: targetLine
      };
    }

    // 8. Device Mismatch (CPU vs GPU)
    if (/expected.*same device/i.test(targetLine) || 
        /but found.*devices/i.test(targetLine) ||
        /CUDA error: device-side assert triggered/i.test(targetLine) ||
        /device mismatch/i.test(targetLine) ||
        /tensors on different devices/i.test(targetLine) ||
        /not.*on.*device/i.test(targetLine)) {
      return {
        category: "Device Mismatch (CPU vs GPU)",
        why: "You are attempting to perform calculations using tensors stored on different hardware devices. All tensors involved in an operation must live on the same device.",
        steps: [
          "Move your input variables and labels to the same device as the model in your training loop: 'inputs = inputs.to(device)'.",
          "Check if you moved your model using 'model.to(device)' (e.g. 'device = \"cuda\" if torch.cuda.is_available() else \"cpu\"').",
          "Ensure manually initialized tensors are created on the target device: 'torch.zeros(..., device=device)'."
        ],
        raw: targetLine
      };
    }

    // Generic Fallback
    return {
      category: "Generic Traceback Exception",
      why: "An unclassified exception occurred during execution. ModelSight parsed the final traceback details.",
      steps: [
        "Inspect the raw error string on the diagnostic panel.",
        "Check the traceback to find the exact line and file where the error occurred.",
        "Verify your parameters and input dimensions for spelling, index bounds, or type conflicts."
      ],
      raw: targetLine
    };
  }

  runExplainerBtn.addEventListener('click', () => {
    const rawText = tracebackTextarea.value.trim();
    if (!rawText) return;

    const result = explainError(rawText);
    if (!result) return;

    // Fill details
    diagCategory.textContent = result.category;
    diagRawLine.textContent = result.raw;
    diagWhy.textContent = result.why;
    
    // Clear & fill checklist
    diagSteps.innerHTML = '';
    result.steps.forEach(step => {
      const li = document.createElement('li');
      li.textContent = step;
      diagSteps.appendChild(li);
    });

    // Toggle views
    inputArea.classList.remove('active');
    diagArea.classList.add('active');
  });

  resetExplainerBtn.addEventListener('click', () => {
    tracebackTextarea.value = '';
    diagArea.classList.remove('active');
    inputArea.classList.add('active');
  });

  // Pre-load a sample traceback in textarea
  tracebackTextarea.value = `Traceback (most recent call last):
  File "train.py", line 45, in <module>
    loss = criterion(outputs, targets)
RuntimeError: Expected input batch_size (32) to match target batch_size (8).`;
});
