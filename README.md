# ModelSight 📊

<p align="center">
  <img src="https://raw.githubusercontent.com/CODExGAMERZ/Model-Sight/main/media/logo.png" width="128" height="128" alt="ModelSight Logo">
</p>

<p align="center">
  <strong>Local-first Machine Learning Training Monitor & Error Explainer for Visual Studio Code</strong>
</p>

<p align="center">
  <a href="https://github.com/CODExGAMERZ/Model-Sight/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/VS%20Code-v1.70.0%2B-blue" alt="VS Code Version">
  <img src="https://img.shields.io/badge/Python-3.8%2B-blue" alt="Python Version">
</p>

---

ModelSight is a lightweight, local-first extension that turns your editor into an interactive training dashboard. It tracks training telemetry in real-time and automatically translates complex ML runtime crash traces (PyTorch, TensorFlow, NumPy, etc.) into human-friendly troubleshooting steps.

All of ModelSight's components run entirely on your local machine to guarantee data privacy. 

---

## ✨ Features

### 1. Real-Time Telemetry Dashboard
Keep track of critical metrics as your training runs progress. The metrics row displays:
* **Current Loss**: Real-time loss tracking with a comparison change indicator showing decrease/increase from the initial run value.
* **Accuracy**: Visual progress bar tracking accuracy growth.
* **Learning Rate**: Tracks optimization decay levels (supports exponential formatting).
* **GPU Utilization**: Auto-detects NVIDIA GPU core utilization dynamically.
* **RAM Usage**: Monitors system memory footprint to prevent out-of-memory errors.
* **Overfitting Risk**: Real-time detector highlighting validation anomalies.

### 2. Live Vector Charts & Dual-Curves
* Wipes out DOM layout lag using **`requestAnimationFrame`** update batching for fluid line rendering.
* Plots **Training Metrics** as solid curves and **Validation Metrics** as dashed overlay lines.
* Caps performance coordinates using a 100-point downsampling filter to keep your IDE lightning-fast.

### 3. Smart Overfitting Alert
* Monitors validation loss continuously. If validation loss increases consecutively 3 times while training loss is decreasing, the dashboard updates the **Overfitting Risk** card to `High ⚠️` (glowing red status bar) and displays a detailed diagnosis card with recommendations (e.g. adding Dropout or Weight Decay).

### 4. Interactive Error Explainer
* Captures standard Python runtime traceback errors (including tensor shape mismatches, CUDA device assertions, index bounds, and file path errors) and provides plain-language explanations with actionable troubleshooting checklists.

### 5. Historical Run Overlays
* Saves the summaries of the last 10 training runs in your local VS Code workspace state.
* Select checkboxes in the **Run History** drawer to overlay historical comparison curves as dimmed, dotted lines on your active charts.

### 6. HTML Report Exporter
* Export your training results locally as a self-contained HTML file. The report compiles metadata, inline SVG vector charts, and a detailed checkpoint saving log.

---

## 🚀 Quick Start

### 1. Install Extension
Download and install **ModelSight** directly from the VS Code Extensions tab (`Ctrl+Shift+X`), or install the `.vsix` file manually.

### 2. Set Up the Python Helper
Include [**`modelsight.py`**](modelsight.py) in your project directory (requires no external dependencies, only uses Python's standard library):

```python
import modelsight
import time
import random

# Start a simulation run
total_epochs = 5
total_steps = 3
lr = 0.01

for epoch in range(1, total_epochs + 1):
    print(f"--- Epoch {epoch}/{total_epochs} ---")
    for step in range(1, total_steps + 1):
        time.sleep(0.5) # Simulate batch time
        
        # Log training metrics
        modelsight.log(
            epoch=epoch,
            total_epochs=total_epochs,
            step=step,
            total_steps=total_steps,
            loss=0.85 - (epoch * 0.1),
            accuracy=0.15 + (epoch * 0.15),
            lr=lr
        )
```

### 3. Run Monitored Script
Open your Python training script in VS Code, right-click inside the editor panel or in the Explorer file list, and click **`ModelSight: Run Python Script with Monitor`**.

---

## 📓 Jupyter Notebook Integration

ModelSight starts a local loopback telemetry server inside VS Code (listening on port **`9824`**). This lets you stream metrics live from Jupyter cells or external environments. 

Simply import `modelsight` inside a cell and call `log()`. The telemetry API will POST metrics straight to the active dashboard.

---

## ⚙️ Extension Settings

Configure the extension by opening VS Code Settings (`Ctrl+,`) and searching for `ModelSight`:

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `modelsight.pythonPath` | `string` | `"python"` | Path to the Python executable/virtual environment (`venv`, `conda`). |
| `modelsight.autoOpenDashboard` | `boolean` | `true` | Automatically opens the dashboard panel when a monitored run starts. |

---

## 📦 Local Packaging & Publishing

To package the extension into a shareable `.vsix` package:

1. Install the official VS Code Extension packaging tool:
   ```bash
   npm install -g @vscode/vsce
   ```
2. Package the extension in the repository directory:
   ```bash
   vsce package
   ```
3. Install the package in VS Code by opening the Extensions sidebar, clicking the `...` menu, and selecting **`Install from VSIX...`**.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
