/**
 * ModelSight ML Error Explainer
 * Parses traceback messages, extracts the error type/message, matches it against
 * known ML issue categories, and provides human-friendly explanations and fixes.
 */

/**
 * Analyzes an error traceback and returns a friendly explanation structure.
 * 
 * @param {string} errorText - The stderr output or traceback string.
 * @returns {object|null} - An explanation object, or null.
 */
function explainError(errorText) {
    if (!errorText || typeof errorText !== 'string') return null;

    // Find the actual error line.
    // Usually it is the last line, or a line starting with standard error names.
    const lines = errorText.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    if (lines.length === 0) return null;

    let targetLine = '';
    const errorPrefixes = [
        'RuntimeError:', 'ValueError:', 'TypeError:', 'IndexError:', 
        'KeyError:', 'AttributeError:', 'FileNotFoundError:', 'NameError:', 
        'ZeroDivisionError:', 'SyntaxError:', 'ImportError:', 'ModuleNotFoundError:',
        'OSError:', 'IndexError:'
    ];

    // Search backwards for the last line starting with a standard python exception
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (errorPrefixes.some(prefix => line.startsWith(prefix))) {
            targetLine = line;
            break;
        }
    }

    // Fallback to the last line if no standard prefix was found
    if (!targetLine) {
        targetLine = lines[lines.length - 1];
    }

    // Classify the error
    // 1. Tensor Shape Mismatch
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
            summary: "The size of your input data doesn't match the size expected by the model layer.",
            whyItHappened: "This is one of the most common neural network issues! It typically happens because:\n1. A tensor is not flattened before entering a Fully Connected (Linear) layer.\n2. The output dimensions of one layer do not match the input dimensions of the next layer.\n3. The batch size dimension is misaligned or missing.",
            whatToDo: [
                "Print the shape of the tensor immediately before the failing layer: `print(tensor.shape)`.",
                "Verify the layer definitions. E.g., in PyTorch, if a convolutional output is `[batch_size, 64, 4, 4]`, the input to the next linear layer must be `64 * 4 * 4 = 1024` after flattening.",
                "Ensure you apply a flattening operation (like `x = x.view(x.size(0), -1)` or `torch.flatten(x, 1)`) right before passing the tensor to your Linear/Fully Connected layer."
            ],
            originalError: targetLine
        };
    }

    // 2. Device Mismatch (CPU vs GPU/CUDA)
    if (/expected.*same device/i.test(targetLine) || 
        /but found.*devices/i.test(targetLine) ||
        /CUDA error: device-side assert triggered/i.test(targetLine) ||
        /device mismatch/i.test(targetLine) ||
        /tensors on different devices/i.test(targetLine) ||
        /not.*on.*device/i.test(targetLine)) {
        return {
            category: "Device Mismatch (CPU vs GPU)",
            summary: "You are attempting to perform calculations using tensors stored on different hardware devices (e.g. CPU vs GPU).",
            whyItHappened: "ML frameworks (like PyTorch and TensorFlow) require all tensors involved in an operation (like layer multiplication or addition) to live on the exact same physical device (e.g. all on CPU, or all on CUDA GPU).",
            whatToDo: [
                "Move your input variables and labels to the same device as the model in your training loop: `inputs = inputs.to(device)` and `labels = labels.to(device)`.",
                "Check if you moved your model using `model.to(device)` (e.g., `device = 'cuda' if torch.cuda.is_available() else 'cpu'`).",
                "Ensure custom layer weights or manually initialized tensors (e.g. `torch.zeros(...)`, `torch.randn(...)`) are created on the target device by passing `device=device`.",
                "Print locations for debugging: `print(tensor.device)` or `print(next(model.parameters()).device)`."
            ],
            originalError: targetLine
        };
    }

    // 3. Index Out of Range
    if (/index out of/i.test(targetLine) || 
        /target.*out of bounds/i.test(targetLine) ||
        /dimension.*out of range/i.test(targetLine) ||
        /class index.*out of range/i.test(targetLine) ||
        /index.*is out of bounds/i.test(targetLine)) {
        return {
            category: "Index Out of Range / Class Bounds",
            summary: "Your code tried to access a index that does not exist, or target labels exceed model output dimensions.",
            whyItHappened: "In machine learning classification, this happens when:\n1. Your dataset labels (targets) are 1-indexed (e.g. `1` to `10`) but models expect 0-indexed values (e.g. `0` to `9`).\n2. The number of output nodes in the final classification layer is smaller than the maximum target label value.\n3. Normal index overflow when accessing dimensions of a custom list or array.",
            whatToDo: [
                "Check the range of your training labels: `print(labels.min(), labels.max())`.",
                "Verify the final layer output dimension. If your final layer is `nn.Linear(in_features, num_classes)`, ensure `num_classes` matches the number of classification target options.",
                "If your labels start at 1, map them to start at 0 by subtracting 1: `labels = labels - 1`."
            ],
            originalError: targetLine
        };
    }

    // 4. Data Type Mismatch
    if (/expected.*type/i.test(targetLine) || 
        /but got/i.test(targetLine) ||
        /invalid type/i.test(targetLine) ||
        /datatype/i.test(targetLine) ||
        /found dtype/i.test(targetLine) ||
        /mismatch.*dtype/i.test(targetLine)) {
        return {
            category: "Data Type Mismatch",
            summary: "A layer or loss function received a data type it does not support (e.g. Double/Float64 instead of Float32, or Float instead of Long).",
            whyItHappened: "ML frameworks enforce strict types. Model weights are usually Float32 (`torch.float32`), while classification targets/labels must be integers (usually Long/Int64: `torch.int64`). Standard NumPy arrays or Python floats sometimes convert to Double/Float64, triggering errors.",
            whatToDo: [
                "Convert model input data to Float32: `inputs = inputs.float()` or `inputs = inputs.to(torch.float32)`.",
                "For classification targets/labels, ensure they are converted to Long integers: `labels = labels.long()` or `labels = labels.to(torch.int64)`.",
                "Inspect variables with: `print(tensor.dtype)`."
            ],
            originalError: targetLine
        };
    }

    // 5. Missing Key or Column (Pandas / Dicts)
    if (targetLine.startsWith("KeyError:") || 
        /is not in list/i.test(targetLine) ||
        /column.*not found/i.test(targetLine) ||
        /key.*not found/i.test(targetLine) ||
        /label.*not in index/i.test(targetLine)) {
        return {
            category: "Missing Dictionary Key or DataFrame Column",
            summary: "You are trying to retrieve a key from a dictionary, or a column name from a Pandas DataFrame, that doesn't exist.",
            whyItHappened: "This happens during data preprocessing or batching if you misspell a column, request a key that was dropped, or write labels with mismatched capitalization.",
            whatToDo: [
                "Print dictionary keys (`print(my_dict.keys())`) or DataFrame columns (`print(df.columns)`) right before the crash.",
                "Double-check capitalization and look out for hidden leading/trailing spaces in column titles."
            ],
            originalError: targetLine
        };
    }

    // 6. Attribute Error (Missing Method / Property)
    if (targetLine.startsWith("AttributeError:") || 
        /has no attribute/i.test(targetLine) ||
        /'NoneType' object has no attribute/i.test(targetLine)) {
        return {
            category: "Attribute Error (Missing Property)",
            summary: "Your code is trying to access a property or call a function that the object does not have.",
            whyItHappened: "This typically occurs when:\n1. A variable is unexpectedly `None` (for instance, if a function didn't return anything or if loading failed).\n2. You misspelled a function name or called `.forward()` directly on a model (you should call the model itself, e.g., `model(inputs)`).\n3. Using deprecated methods from older versions of library (like scikit-learn or pandas).",
            whatToDo: [
                "Verify if your variable is `None` by printing: `print(my_variable)`.",
                "In PyTorch, do not call `model.forward(x)`. Instead, invoke it directly: `outputs = model(x)` to ensure all forward-hooks execute.",
                "Check spelling and verify the library's version requirements."
            ],
            originalError: targetLine
        };
    }

    // 7. Path Issues / Missing File
    if (targetLine.startsWith("FileNotFoundError:") || 
        /no such file/i.test(targetLine) ||
        /cannot find the path/i.test(targetLine) ||
        /does not exist/i.test(targetLine)) {
        return {
            category: "File or Directory Not Found",
            summary: "The training script cannot find the dataset, checkpoint file, or folder path specified in your code.",
            whyItHappened: "A common issue with relative paths in VS Code. The script runs with the VS Code workspace folder as the root directory, which might be different from the directory where the script is located.",
            whatToDo: [
                "Print the current Python working directory: `import os; print(os.getcwd())`.",
                "Convert relative paths to absolute paths relative to the script: `os.path.join(os.path.dirname(__file__), 'data/dataset.csv')`.",
                "Check for spelling errors or missing directory prefixes."
            ],
            originalError: targetLine
        };
    }

    // 8. Default Fallback
    return {
        category: "Python Execution Error",
        summary: "The training script crashed due to a Python exception.",
        whyItHappened: "A python error was raised during the run. See the stack trace above to find the line that crashed.",
        whatToDo: [
            "Find the failing line number from the traceback.",
            "Verify variable shapes, types, and values right before that line.",
            "Search for the specific exception name online for community recommendations."
        ],
        originalError: targetLine
    };
}

module.exports = {
    explainError
};
