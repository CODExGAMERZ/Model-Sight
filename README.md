# ModelSight 📊

<p align="center">
  <img src="https://raw.githubusercontent.com/CODExGAMERZ/Model-Sight/main/media/logo.png" width="128" height="128" alt="ModelSight Logo">
</p>

<p align="center">
  <strong>Local-First Machine Learning Training Monitor & Interactive Error Explainer for VS Code</strong>
</p>

<p align="center">
  <a href="https://github.com/CODExGAMERZ/Model-Sight/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/VS%20Code-v1.70.0%2B-blue" alt="VS Code Version">
  <img src="https://img.shields.io/badge/Python-3.8%2B-blue" alt="Python Version">
  <img src="https://img.shields.io/badge/Dependencies-Zero-green" alt="No Dependencies">
</p>

---

ModelSight is a lightweight, local-first Visual Studio Code extension that turns your editor into a real-time interactive machine learning dashboard. Track loss, accuracy, and system hardware metrics (RAM & GPU) directly inside VS Code, and let ModelSight instantly decode runtime training crashes into plain-English troubleshooting checklists.

> [!IMPORTANT]
> **100% Local & Private:** ModelSight has zero external Node or Python dependencies. Telemetry is streamed entirely offline via standard output parsing or local loopback connection (`127.0.0.1:9824`). Your training data, logs, and model configurations never leave your machine.

---

## ✨ Features

### 📈 Real-Time Telemetry Dashboard
Keep track of critical metrics as your training runs progress. The metrics row displays:
- **Loss Tracker**: Real-time training loss with change indicators showing variance relative to the initial value.
- **Accuracy Meter**: Visual progress bar tracking accuracy growth.
- **Learning Rate (LR)**: Support for scientific exponential notations for learning rate scheduling.
- **GPU Core Utilization**: Auto-queries NVIDIA GPU usage using standard diagnostic tools.
- **System RAM Monitor**: Tracks cross-platform memory footprints (using native OS bindings) to help prevent out-of-memory crashes.
- **Overfitting Risk**: Real-time detector highlighting validation anomalies.

### 📉 Live Vector Charts & Dual-Curves
- Plots training metrics (solid curves) and validation metrics (dashed curves) on the same graph.
- Implements `requestAnimationFrame` update batching to eliminate browser reflow lag for silky-smooth rendering.
- Downsamples data points using a 100-point filter to keep your VS Code window highly responsive even over millions of training steps.

### 🚨 Smart Overfitting Detection
- Automatically detects validation anomalies in real time.
- If validation loss increases consecutively 3 times while training loss is decreasing, the dashboard updates the **Overfitting Risk** card to `High ⚠️` (complete with a glowing amber/red pulse indicator) and provides context-specific suggestions like adding dropout, early stopping, or weight decay.

### 🔍 Interactive Error Explainer
- If your training script crashes, ModelSight captures standard Python tracebacks.
- Translates complex ML runtime issues (such as PyTorch shape mismatches, CUDA out-of-memory errors, index bounds, and file path errors) into human-friendly explanations and checklists.

### 🗃️ Run History Overlays & Export
- Stores the metadata and summary of your last 10 training runs in your workspace state.
- Select checkboxes in the **Run History** drawer to overlay past run curves as dimmed, dotted lines for direct comparison.
- Export training summaries, charts, and console logs into a single, self-contained HTML report.

---

## 🚀 Quick Start

### Step 1: Install the Extension
Install **ModelSight** from the VS Code Extensions Marketplace (`Ctrl+Shift+X`) or install the packaged `.vsix` file manually.

### Step 2: Use the Python Helper
You do not need to install any external packages! 

* **Automatic Mode (Run with Monitor)**: When running your training script via the ModelSight play button or context menu in VS Code, the extension automatically configures the environment. You can immediately call `import modelsight` without copying any files!
* **Manual Mode (External Terminals / Jupyter Notebooks)**: If running outside VS Code's monitor command, copy [**`modelsight.py`**](modelsight.py) into your script or notebook folder so that Python can resolve the import.

#### 1. Standard PyTorch/Custom Training Loop
```python
import modelsight
import time

# Initialize parameters
total_epochs = 10
total_steps = 100

for epoch in range(1, total_epochs + 1):
    for step in range(1, total_steps + 1):
        # ... Your Model Training Code Here ...
        time.sleep(0.01) # Simulate training step
        
        # Log telemetry metrics to the dashboard
        modelsight.log(
            epoch=epoch,
            total_epochs=total_epochs,
            step=step,
            total_steps=total_steps,
            loss=0.8 - (epoch * 0.05),
            accuracy=0.2 + (epoch * 0.07),
            lr=0.001
        )
```

#### 2. Keras / TensorFlow Integration
ModelSight includes a built-in Keras callback:
```python
from modelsight import ModelSightKerasCallback

# Pass the callback to model.fit()
callback = ModelSightKerasCallback(total_epochs=10)
model.fit(
    x_train, y_train, 
    epochs=10, 
    callbacks=[callback],
    validation_data=(x_val, y_val)
)
```

#### 3. PyTorch Lightning Integration
Stream metrics automatically using the PyTorch Lightning callback:
```python
import pytorch_lightning as pl
from modelsight import ModelSightLightningCallback

# Instantiate callback and pass to Trainer
trainer = pl.Trainer(
    max_epochs=10,
    callbacks=[ModelSightLightningCallback()]
)
```

### Step 3: Run the Monitored Script
1. Open your training script (e.g. `train.py`) in VS Code.
2. Click the **ModelSight Play Icon** at the top right of the editor, or right-click inside the file editor and choose **`ModelSight: Run Python Script with Monitor`**.
3. The dashboard opens automatically to show live plots and system stats.

---

## 📓 Jupyter Notebook Integration

ModelSight starts a local telemetry HTTP server in VS Code on port **`9824`**. This allows you to stream metrics from **Jupyter Notebooks**, Google Colab (when running locally), or external processes.

Simply copy `modelsight.py` into your notebook's folder and call `modelsight.log()` within any execution cell:
```python
import modelsight

# Telemetry will be posted to the active VS Code dashboard automatically
modelsight.log(
    epoch=2, 
    loss=0.34, 
    accuracy=0.85, 
    val_loss=0.41, 
    val_accuracy=0.82
)
```

---

## 📋 API Reference

### `modelsight.log(...)`

Prints structured metrics and posts them to the local Webview receiver. All arguments are optional.

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `epoch` | `int` | Current epoch index. |
| `total_epochs` | `int` | Total number of epochs for the run. |
| `step` | `int` | Current batch/step index. |
| `total_steps` | `int` | Total steps per epoch. |
| `loss` | `float` | Current training loss value. |
| `accuracy` | `float` | Current training accuracy (supports 0.0 - 1.0 or 0 - 100%). |
| `val_loss` | `float` | Current validation loss (plots validation curve). |
| `val_accuracy`| `float` | Current validation accuracy (plots validation curve). |
| `lr` | `float` | Current optimizer learning rate. |
| `gpu_usage` | `float` | Manual GPU utilization %. If omitted, ModelSight auto-queries nvidia-smi. |
| `ram_usage` | `float` | Manual RAM usage %. If omitted, ModelSight auto-detects system memory load. |
| `checkpoint` | `str` | Name or path of a saved checkpoint to show a saving indicator on the timeline. |

---

## ⚙️ Extension Settings

Configure ModelSight settings by opening VS Code Settings (`Ctrl+,`) and searching for `ModelSight`:

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `modelsight.pythonPath` | `string` | `"python"` | Custom path to your python command or virtual environment executable (`venv`, `conda`). |
| `modelsight.autoOpenDashboard` | `boolean` | `true` | Automatically splits the editor layout and displays the dashboard when monitoring starts. |

---

## 🛠️ Development & Local Packaging

To build and package the extension locally:

1. **Install Node.js dependencies**:
   ```bash
   npm install
   ```
2. **Install vsce (VS Code Extension Manager)**:
   ```bash
   npm install -g @vscode/vsce
   ```
3. **Compile the extension package**:
   ```bash
   vsce package
   ```
   This will generate a `.vsix` archive file in your directory root (e.g. `modelsight-1.0.0.vsix`).
4. **Install locally**:
   Open VS Code, run `Ctrl+Shift+P` -> `Developer: Install Extension from VSIX...`, and select the generated file.

---

## 📄 License

This extension is licensed under the [MIT License](LICENSE). Developed and maintained by the **CODExGAMERZ** team.
