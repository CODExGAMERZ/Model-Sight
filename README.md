# ModelSight 📊

**ModelSight** is a premium, local-first Visual Studio Code extension built for machine learning developers and students. It tracks training telemetry in real-time and automatically translates complex ML runtime crash traces (PyTorch, TensorFlow, NumPy, etc.) into human-friendly troubleshooting steps.

All of ModelSight's components run locally on your host machine to ensure total privacy. Telemetry streaming operates on a throttled, GPU-accelerated web view, and Jupyter Notebook integrations run over a local loopback server without ever sending your data to external web services.

---

## 🌟 Key Features

* **Real-time Telemetry Dashboard**: Stream Loss, Accuracy, Learning Rate, GPU utilization, and progress ETA live.
* **Dual-Curve Visualization**: Plot both training and validation metrics side-by-side (validation curves render as dashed lines).
* **Overfitting Risk Detector**: Active monitoring of validation trends. A warning alert triggers in the explainer if validation loss increases consecutively 3 times while training loss continues to fall.
* **Overfitting Risk Card**: A dedicated dashboard meter indicating overfitting severity (`Low` -> `Moderate` -> `High ⚠️`) with dynamic green/amber/red progress transitions.
* **Local Run History & Overlays**: Auto-save run summaries in workspace state and toggle checkboxes to overlay historical metrics as dimmed comparison curves.
* **HTML Report Exporter**: Generate self-contained HTML training summaries featuring inline CSS and vector SVG chart representations with a single click.
* **ML Error Explainer**: Automatically captures training process exceptions (like PyTorch tensor shape mismatches, CUDA out-of-device assertions, or index bounds errors) and generates actionable troubleshooting checklists.
* **Jupyter Notebook Support**: A built-in HTTP telemetry server running on `127.0.0.1:9824` lets Jupyter Notebook cells stream training stats directly to the active VS Code webview.

---

## 🚀 Getting Started

### 1. Developer Setup (Run Locally)
To run and debug the extension inside VS Code:
1. Open the `ModelSight` repository folder in VS Code.
2. Press **`F5`** (or select *Run > Start Debugging*).
3. This opens a new window: the **Extension Development Host**.
4. In the Host window, open a workspace folder containing a Python script (e.g., `demo_val_train.py`).
5. Open the script, right-click inside the editor or in the explorer sidebar, and choose **`ModelSight: Run Python Script with Monitor`**.

### 2. Python Telemetry Integration
ModelSight includes a lightweight python helper (`modelsight.py`) that handles printing and background HTTP posting:

```python
import modelsight

# Initialise values
total_epochs = 10
lr = 0.01

for epoch in range(1, total_epochs + 1):
    # Training Loop...
    loss = 0.850 - (epoch * 0.05)
    accuracy = 0.150 + (epoch * 0.07)
    
    # Log step metrics (printed to console and sent to telemetry server)
    modelsight.log(
        epoch=epoch,
        total_epochs=total_epochs,
        loss=loss,
        accuracy=accuracy,
        lr=lr
    )
```

---

## 📦 How to Package as a Real Extension

To convert this project into a real, installable VS Code extension (`.vsix` file) that you can share with peers or publish to the VS Code Marketplace, follow these steps:

### 1. Install VS Code Extension Manager (`vsce`)
`vsce` is the official command-line tool for packaging and publishing VS Code extensions. Install it globally using Node Package Manager (`npm`):

```bash
npm install -g @vscode/vsce
```

### 2. Clean Up Development State
Before packaging, make sure you don't include temporary execution logs or local configurations:
* Delete any cache folders (like `__pycache__`).
* Verify that files are correctly referenced inside `package.json`.

### 3. Package the Extension
Run the package command in the root of the repository directory:

```bash
vsce package
```

This compiles your package structure and generates an installable extension binary in the root directory:
```text
modelsight-1.0.0.vsix
```

*Note: You may receive warnings about a missing repository or publisher identity in `package.json`. You can ignore these warnings for local packaging by typing `y` to proceed.*

### 4. Install the `.vsix` Extension File in VS Code
You can install this generated `.vsix` file directly into your primary VS Code environment:
1. Open Visual Studio Code.
2. Open the Extensions sidebar (`Ctrl+Shift+X` or `Cmd+Shift+X`).
3. Click the **`...`** (More Actions) button at the top-right of the Extensions panel.
4. Select **`Install from VSIX...`**.
5. Locate the generated `modelsight-1.0.0.vsix` file and click **Install**.

---

## 🛠️ Project Structure

* `package.json` - VS Code Extension manifest registering commands, menus, and workspace settings.
* `src/extension.js` - Extension coordinator launching command registrations and the HTTP telemetry loopback server.
* `src/monitor.js` - Child process manager spawning Python runs and filtering telemetry logging.
* `src/parser.js` - Log analyzer extracting validation and training metrics.
* `src/explainer.js` - Exception checker compiling troubleshooting steps.
* `src/dashboard.js` - Panel controller building the Webview context.
* `media/dashboard.js` - Webview controller drawing SVG charts and checking overfitting.
* `media/dashboard.css` - Sleek dark mode styling with hardware acceleration optimizations.
* `modelsight.py` - Python logger module.
* `demo_val_train.py` - Python overfitting warning simulation script.
* `demo_train.py` - Python success run simulation script.
* `demo_crash.py` - Python PyTorch runtime error simulator.
