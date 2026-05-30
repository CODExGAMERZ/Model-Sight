# ModelSight

**See Your Models Learn.**

ModelSight is a free, local-first Visual Studio Code extension built for AI and machine learning students, beginners, and independent developers. It combines two essential tools in one place:

1. **AI Model Training Dashboard**
2. **ML Error Explainer**

Instead of switching between the terminal, TensorBoard, documentation, and search engines, users can monitor training progress and understand errors directly inside VS Code.

---

## Why ModelSight Exists

Machine learning development is difficult for many students for two main reasons.

### 1. Training is hard to track
When a model is training, students usually watch terminal logs and manually guess whether the model is improving. It is easy to miss important details such as loss trends, accuracy changes, learning rate behavior, GPU usage, or checkpoint events.

### 2. Errors are hard to understand
ML frameworks often produce technical errors that are confusing for beginners. A message like:

```text
RuntimeError: mat1 and mat2 shapes cannot be multiplied
```

may look familiar to experienced developers, but it can completely block a student who does not yet understand tensor shapes or layer dimensions.

ModelSight solves both problems by giving users clear visual feedback and beginner-friendly explanations.

---

## What ModelSight Does

### AI Model Training Dashboard
ModelSight detects machine learning training runs and displays useful metrics in real time.

#### Tracked Metrics
- Loss
- Accuracy
- Learning rate
- GPU usage
- Training ETA
- Checkpoint status

#### How It Helps
The dashboard shows whether the model is learning properly, whether training is slowing down, and whether checkpoints are being saved as expected. This gives students a better understanding of what is happening during training without leaving VS Code.

---

### ML Error Explainer
ModelSight reads common ML-related errors and turns them into plain, actionable language.

#### Example
**Error:**
```text
RuntimeError: mat1 and mat2 shapes cannot be multiplied
```

**Explanation:**
The input tensor size does not match the layer’s expected size. This usually happens when a tensor is not flattened correctly, or when the output of one layer does not match the input shape of the next layer.

**What to do:**
- Check the tensor shape before the failing layer
- Verify flattening logic
- Confirm the input size of the linear layer
- Print intermediate shapes during debugging

#### Supported Libraries
- PyTorch
- TensorFlow
- NumPy
- Pandas
- Scikit-learn

---

## How It Works

ModelSight follows a simple local workflow.

### Training Dashboard Flow
1. The user starts a Python training script.
2. ModelSight detects machine learning training output.
3. The extension parses metrics such as loss, accuracy, learning rate, and checkpoint events.
4. The dashboard updates live inside VS Code.
5. The user reviews the model’s progress in a clean visual interface.

### Error Explainer Flow
1. A script throws an exception.
2. ModelSight captures the error message.
3. The extension matches the error against known patterns.
4. It generates a simple explanation.
5. It shows the likely cause and next debugging steps.

---

## Mechanism Behind the Dashboard

The dashboard is built around log parsing and metric tracking.

### Suggested Input Formats
For best results, training scripts can output metrics in a structured format such as:

```text
loss=0.4321
accuracy=0.8920
lr=0.0001
gpu_usage=78%
checkpoint=saved
```

or:

```json
{"loss": 0.4321, "accuracy": 0.8920, "lr": 0.0001}
```

### What the Extension Does Internally
- Detects training-related output
- Extracts metric values
- Stores run history
- Updates graphs live
- Estimates training time
- Tracks checkpoint events

### Suggested Visual Components
- Line chart for loss
- Line chart for accuracy
- Line chart for learning rate
- GPU usage indicator
- ETA progress card
- Checkpoint event timeline

---

## Mechanism Behind the Error Explainer

The error explainer should work in two layers.

### 1. Pattern Detection
The extension checks whether the error matches known categories such as:
- Shape mismatch
- Index out of range
- Type mismatch
- Device mismatch
- Missing key or column
- Undefined attribute
- Data loading issues

### 2. Human-Friendly Explanation
Once the error is classified, ModelSight rewrites it in simple language and adds a practical next step.

#### Example Output
**Detected issue:** Tensor shape mismatch

**Why it happened:** The output of one layer does not match the input size expected by the next layer.

**Suggested fix:** Print intermediate shapes and verify layer dimensions before the failing operation.

---

## Recommended Technology Stack

To keep ModelSight free, local, and lightweight, the following stack is recommended.

### Extension Layer
- **TypeScript** for VS Code extension development
- **VS Code API** for commands, panels, and terminal interaction

### UI Layer
- **Webview panel** for charts and explanations
- **HTML, CSS, and JavaScript** for the interface
- Optional chart library such as **Chart.js** or **ECharts**

### Python Integration
- Training process detection
- Log parsing from stdout and stderr
- Error stream capture
- Optional helper scripts for structured metric logging

### Optional Local Intelligence
- Rule-based error classification
- Lightweight local heuristics
- Optional offline analysis later if needed

---

## Suggested Commands

ModelSight may include the following commands:
- `ModelSight: Open Dashboard`
- `ModelSight: Explain Current Error`
- `ModelSight: Start Training Monitor`
- `ModelSight: Export Run Summary`
- `ModelSight: Save Debug Report`

---

## Local-First Design

ModelSight is intended to run locally on the user’s machine.

That means:
- no required cloud account
- no mandatory paid API
- no dependence on internet access for core features
- better privacy for student projects
- lower setup complexity

This makes the extension easier to use in classrooms, labs, and personal learning environments.

---

## What Students Gain

ModelSight helps students:
- understand model training more clearly
- debug errors faster
- reduce dependence on external tools
- learn ML concepts through feedback
- stay productive inside VS Code

---

## Future Improvements

Possible future versions could add:
- experiment comparison
- overfitting warnings
- gradient monitoring
- dataset quality checks
- notebook support
- training report export
- run history tracking
- richer checkpoint management
- optional local LLM explanations

---

## Conclusion

ModelSight is a professional, student-friendly VS Code extension that brings training visibility and error understanding into one place. It helps users see how their models are learning, understand what went wrong when an error appears, and stay focused inside VS Code while working locally and for free.

