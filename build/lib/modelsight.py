"""
ModelSight Python Telemetry Helper
A lightweight utility to easily format and print machine learning training metrics
so that the ModelSight VS Code extension can parse them in real-time.
"""

import sys
import json
import time

_last_gpu_query_time = 0.0
_last_gpu_usage = None

def get_gpu_usage():
    """Queries nvidia-smi to obtain GPU utilization percentage if available.
    Throttled to once every 3 seconds to prevent training loop CPU delays."""
    global _last_gpu_query_time, _last_gpu_usage
    current_time = time.time()
    
    if current_time - _last_gpu_query_time < 3.0:
        return _last_gpu_usage
        
    try:
        import subprocess
        import os
        import sys
        
        cmd = "nvidia-smi"
        if sys.platform == 'win32':
            default_path = r"C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe"
            if os.path.exists(default_path):
                cmd = default_path
                
        output = subprocess.check_output(
            [cmd, "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
            timeout=0.5
        )
        _last_gpu_usage = float(output.decode('utf-8').strip())
        _last_gpu_query_time = current_time
        return _last_gpu_usage
    except Exception:
        _last_gpu_query_time = current_time
        _last_gpu_usage = None
        return None

def get_ram_usage():
    """Get system memory usage percentage without external dependencies."""
    import os
    import sys
    
    # Windows
    if sys.platform == 'win32':
        try:
            import ctypes
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong)
                ]
            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(stat)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
            return float(stat.dwMemoryLoad)
        except Exception:
            pass
            
    # Linux
    elif sys.platform.startswith('linux'):
        try:
            with open('/proc/meminfo', 'r') as f:
                lines = f.readlines()
            mem_total = 0
            mem_free = 0
            mem_buffers = 0
            mem_cached = 0
            for line in lines:
                parts = line.split()
                if not parts:
                    continue
                key = parts[0].strip(':')
                val = int(parts[1])
                if key == 'MemTotal':
                    mem_total = val
                elif key == 'MemFree':
                    mem_free = val
                elif key == 'Buffers':
                    mem_buffers = val
                elif key == 'Cached':
                    mem_cached = val
            if mem_total > 0:
                used = mem_total - (mem_free + mem_buffers + mem_cached)
                return (used / mem_total) * 100.0
        except Exception:
            pass
            
    # macOS
    elif sys.platform == 'darwin':
        try:
            import subprocess
            out = subprocess.check_output(["sysctl", "-n", "hw.memsize"])
            total_mem = int(out.strip())
            
            vm = subprocess.check_output(["vm_stat"])
            lines = vm.decode('utf-8').split('\n')
            page_size = 4096
            free_pages = 0
            active_pages = 0
            inactive_pages = 0
            wire_pages = 0
            for line in lines:
                if 'page size of' in line:
                    parts = line.split()
                    page_size = int(parts[-2])
                elif 'Pages free:' in line:
                    free_pages = int(line.split()[-1].strip('.'))
                elif 'Pages active:' in line:
                    active_pages = int(line.split()[-1].strip('.'))
                elif 'Pages inactive:' in line:
                    inactive_pages = int(line.split()[-1].strip('.'))
                elif 'Pages wired down:' in line:
                    wire_pages = int(line.split()[-1].strip('.'))
            
            used_mem = (active_pages + inactive_pages + wire_pages) * page_size
            return (used_mem / total_mem) * 100.0
        except Exception:
            pass

    return None

def log(epoch=None, total_epochs=None, step=None, total_steps=None, 
        loss=None, accuracy=None, val_loss=None, val_accuracy=None, 
        lr=None, gpu_usage=None, ram_usage=None, checkpoint=None):
    """
    Format and log training metrics to stdout. Automatically flushes the output
    buffer to ensure real-time telemetry streaming in VS Code.
    
    Args:
        epoch (int): Current epoch number.
        total_epochs (int): Total number of training epochs.
        step (int): Current step/batch number.
        total_steps (int): Total steps per epoch.
        loss (float): Current training loss value.
        accuracy (float): Current training accuracy (0.0 to 1.0 or 0 to 100).
        val_loss (float): Current validation loss value.
        val_accuracy (float): Current validation accuracy.
        lr (float): Current optimizer learning rate.
        gpu_usage (float): GPU usage percentage. If None, will attempt auto-detection.
        ram_usage (float): RAM usage percentage. If None, will attempt auto-detection.
        checkpoint (str): If a checkpoint was saved, pass its name/path here.
    """
    metrics = {}
    
    # Setup values
    if loss is not None:
        metrics["loss"] = float(loss)
    if accuracy is not None:
        metrics["accuracy"] = float(accuracy)
    if val_loss is not None:
        metrics["val_loss"] = float(val_loss)
    if val_accuracy is not None:
        metrics["val_accuracy"] = float(val_accuracy)
    if lr is not None:
        metrics["lr"] = float(lr)
        
    # Auto-detect GPU usage if requested and not provided
    if gpu_usage is None:
        gpu_usage = get_gpu_usage()
        
    if gpu_usage is not None:
        metrics["gpu_usage"] = float(gpu_usage)

    # Auto-detect RAM usage if requested and not provided
    if ram_usage is None:
        ram_usage = get_ram_usage()
        
    if ram_usage is not None:
        metrics["ram_usage"] = float(ram_usage)
        
    if checkpoint is not None:
        metrics["checkpoint"] = str(checkpoint)

    # Prepare prefix text structure for human and regex parser readability
    prefix_parts = []
    if epoch is not None:
        if total_epochs is not None:
            prefix_parts.append(f"Epoch {epoch}/{total_epochs}")
        else:
            prefix_parts.append(f"Epoch {epoch}")
            
    if step is not None:
        if total_steps is not None:
            prefix_parts.append(f"Step {step}/{total_steps}")
        else:
            prefix_parts.append(f"Step {step}")

    prefix = " - ".join(prefix_parts)
    json_data = json.dumps(metrics)
    
    # Print combined log line and flush stdout immediately
    if prefix:
        print(f"{prefix} | {json_data}")
    else:
        print(json_data)
        
    sys.stdout.flush()

    # Stream metrics to local HTTP telemetry receiver server (purely local to 127.0.0.1:9824)
    # This enables out-of-the-box support for Jupyter Notebook cells and IPython environments
    try:
        import urllib.request
        payload = metrics.copy()
        if epoch is not None:
            payload["epoch"] = epoch
            if total_epochs is not None:
                payload["total_epochs"] = total_epochs
        if step is not None:
            payload["step"] = step
            if total_steps is not None:
                payload["total_steps"] = total_steps

        req_body = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            "http://127.0.0.1:9824/metrics",
            data=req_body,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        # 80ms tiny timeout ensures training is never delayed if server is closed
        with urllib.request.urlopen(req, timeout=0.08) as response:
            response.read()
    except Exception:
        pass


# --- Framework Callbacks ---

# Keras Callback support
try:
    import tensorflow as tf
    
    class ModelSightKerasCallback(tf.keras.callbacks.Callback):
        """Keras/TensorFlow Callback to stream epoch metrics automatically to ModelSight."""
        def __init__(self, total_epochs=None):
            super().__init__()
            self.total_epochs = total_epochs

        def on_epoch_end(self, epoch, logs=None):
            logs = logs or {}
            epoch_num = epoch + 1
            total = self.total_epochs or (self.params.get('epochs') if self.params else None)
            
            # Read learning rate
            lr = None
            if hasattr(self.model, 'optimizer') and self.model.optimizer is not None:
                try:
                    if hasattr(self.model.optimizer, 'learning_rate'):
                        # Can be a tensor or float
                        lr_val = self.model.optimizer.learning_rate
                        if hasattr(lr_val, 'numpy'):
                            lr = float(lr_val.numpy())
                        else:
                            lr = float(lr_val)
                except Exception:
                    pass

            log(
                epoch=epoch_num,
                total_epochs=total,
                loss=logs.get('loss'),
                accuracy=logs.get('accuracy') or logs.get('acc'),
                val_loss=logs.get('val_loss'),
                val_accuracy=logs.get('val_accuracy') or logs.get('val_acc'),
                lr=lr
            )
except ImportError:
    pass

# PyTorch Lightning support
try:
    # pyrefly: ignore [missing-import]
    import pytorch_lightning as pl
    
    class ModelSightLightningCallback(pl.Callback):
        """PyTorch Lightning Callback to stream metrics automatically to ModelSight."""
        def on_train_epoch_end(self, trainer, pl_module):
            epoch_num = trainer.current_epoch + 1
            total = trainer.max_epochs
            
            # Extract logged metrics
            logged_metrics = trainer.logged_metrics
            loss = logged_metrics.get('train_loss') or logged_metrics.get('loss')
            accuracy = logged_metrics.get('train_acc') or logged_metrics.get('accuracy')
            val_loss = logged_metrics.get('val_loss')
            val_accuracy = logged_metrics.get('val_acc') or logged_metrics.get('val_accuracy')
            
            # Read learning rate
            lr = None
            try:
                optimizers = trainer.optimizers
                if optimizers:
                    lr = optimizers[0].param_groups[0]['lr']
            except Exception:
                pass

            log(
                epoch=epoch_num,
                total_epochs=total,
                loss=loss,
                accuracy=accuracy,
                val_loss=val_loss,
                val_accuracy=val_accuracy,
                lr=lr
            )
except ImportError:
    pass
