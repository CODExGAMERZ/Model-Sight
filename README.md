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

## 🌐 Live Web Demo

ModelSight is also available as a live web application deployed on Vercel:
👉 **[Launch ModelSight Web App](https://modelsight.vercel.app/)**

You can interact with the mock training dashboard, tweak parameters in real-time, trigger early validation warnings, and paste raw PyTorch crash logs into the traceback explainer.

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

### Step 2: Use the Python Helper (Zero Configuration)
You do not need to do any manual copying or installation! The extension automatically copies the `modelsight.py` helper to your active workspace root folders and script directories.

Simply import and use the helper directly in your Python code:

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

#### 4. Hugging Face / Transformers Integration
Stream LLM and standard Transformer metrics automatically using the Hugging Face Trainer callback:
```python
from transformers import Trainer
from modelsight import ModelSightHFCallback

# Pass the callback to the Trainer
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
    callbacks=[ModelSightHFCallback()]
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

### `modelsight.init(...)`

Initialize ModelSight settings, configuration hyperparameters, and optional third-party integrations (TensorBoard and Weights & Biases).

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `project` | `str` | Name of the active machine learning project. |
| `run_name` | `str` | Name of the active run. If omitted, generates a unique default name. |
| `config` | `dict` | Dictionary of hyperparameters to log and compare. |
| `tensorboard_dir` | `str` | Directory path to run TensorBoard SummaryWriter. If provided, duplicate-writes metrics to TensorBoard. |
| `use_wandb` | `bool` | Set to `True` to initialize Weights & Biases logging integration. |
| `wandb_init_args`| `dict` | Custom arguments dictionary forwarded directly to `wandb.init(...)`. |

---

### `modelsight.log_dataset(...)`

Profile and log dataset attributes to the ModelSight dashboard (which renders features shape, sample counts, and an SVG-based class distribution chart).

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `name` | `str` | Display name of the dataset. Defaults to `"Dataset"`. |
| `data` | `any` | Dataset object (supports NumPy arrays, PyTorch datasets/loaders, Pandas DataFrames, or manual data). Used to auto-detect sample counts and feature shapes. |
| `targets` | `any` | Labels/targets list, array, or tensor. If provided, automatically profiles class distribution. |
| `classes` | `list` | Explicit list of unique class labels. |
| `class_counts` | `list` | Explicit list of sample counts per class label. |
| `feature_shape` | `list` | Explicit dimensions list of a single feature sample. |
| `num_samples` | `int` | Explicit total count of samples in the dataset. |

---

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
| `perplexity` | `float` | Custom perplexity metric. If omitted and loss is provided, auto-calculated as exp(loss). |
| `tokens_per_sec` | `float` | Training speed in tokens per second (useful for LLMs). |

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

## 🌐 Standalone Web Simulator

ModelSight includes a standalone vanilla HTML5/CSS3 web landing page and interactive simulator that replicates the real-time telemetry monitoring and traceback explanations directly in any web browser.

### Preview Locally
To run the web preview locally:
1. Navigate to the extension directory.
2. Serve the static `website` folder using any local server:
   ```bash
   npx serve website -l 5001
   ```
3. Open your browser to `http://localhost:5001` to test the simulation offline in your browser.

### Vercel Deployment
The repository includes a `vercel.json` config. You can import the repository directly into Vercel and it will host the static dashboard directory zero-config.

---

## 📄 License

This extension is licensed under the [MIT License](LICENSE). Developed and maintained by the **CODExGAMERZ** team.
