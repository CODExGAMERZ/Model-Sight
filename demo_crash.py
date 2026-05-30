"""
ModelSight Error Explanation Demo
Raises a mock PyTorch RuntimeError to test the ModelSight Error Explainer.
"""

import time
import sys

def simulate_crash():
    print("=== Initializing Model Architecture ===")
    time.sleep(1.0)
    print("Layer 1: Conv2d(3, 16, kernel_size=3)")
    print("Layer 2: Linear(in_features=256, out_features=10)")
    
    time.sleep(1.0)
    print("=== Commencing Forward Pass ===")
    time.sleep(0.5)

    # Output a simulated PyTorch stack trace to stderr
    # This matches the standard PyTorch RuntimeError for matrix multiplication size mismatch.
    traceback_message = """
Traceback (most recent call last):
  File "demo_crash.py", line 18, in <module>
    simulate_crash()
  File "demo_crash.py", line 15, in simulate_crash
    outputs = model(inputs)
  File "torch/nn/modules/module.py", line 1102, in _call_impl
    return forward_call(*input, **kwargs)
  File "models/network.py", line 24, in forward
    x = self.fc(x)
  File "torch/nn/modules/module.py", line 1102, in _call_impl
    return forward_call(*input, **kwargs)
  File "torch/nn/modules/linear.py", line 103, in forward
    return F.linear(input, self.weight, self.bias)
RuntimeError: mat1 and mat2 shapes cannot be multiplied (32x576 and 256x10)
"""
    # Write traceback to stderr and exit with non-zero code (1)
    sys.stderr.write(traceback_message)
    sys.exit(1)

if __name__ == "__main__":
    simulate_crash()
