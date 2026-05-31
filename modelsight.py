"""
ModelSight Python Telemetry Helper
A lightweight utility to easily format and print machine learning training metrics
so that the ModelSight VS Code extension can parse them in real-time.
"""

import sys
import json
import time

_last_gpu_query_time = 0.0
_last_gpu_details = None

def get_gpu_details():
    """Queries nvidia-smi to obtain detailed GPU metrics (utilization, VRAM, temp, power, name).
    Throttled to once every 3 seconds to prevent training loop CPU delays."""
    global _last_gpu_query_time, _last_gpu_details
    current_time = time.time()
    
    if current_time - _last_gpu_query_time < 3.0:
        return _last_gpu_details
        
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
            [cmd, "--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,gpu_name", "--format=csv,noheader,nounits"],
            timeout=0.5
        )
        parts = output.decode('utf-8').strip().split(',')
        if len(parts) >= 6:
            power_val = parts[4].strip()
            power_float = None
            if '[Not Supported]' not in power_val and 'N/A' not in power_val:
                try:
                    power_float = float(power_val)
                except Exception:
                    pass
            _last_gpu_details = {
                "gpu_usage": float(parts[0].strip()),
                "gpu_mem_used": float(parts[1].strip()),
                "gpu_mem_total": float(parts[2].strip()),
                "gpu_temp": float(parts[3].strip()),
                "gpu_power": power_float,
                "gpu_name": parts[5].strip()
            }
        else:
            _last_gpu_details = {
                "gpu_usage": float(parts[0].strip())
            }
        _last_gpu_query_time = current_time
        return _last_gpu_details
    except Exception:
        # Fallback to simple query if full query is not supported
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
            _last_gpu_details = {
                "gpu_usage": float(output.decode('utf-8').strip())
            }
            _last_gpu_query_time = current_time
            return _last_gpu_details
        except Exception:
            pass
        _last_gpu_query_time = current_time
        _last_gpu_details = None
        return None

def get_gpu_usage():
    """Get GPU usage percentage for backward compatibility."""
    details = get_gpu_details()
    return details.get("gpu_usage") if details else None

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

_run_config = {}
_tb_writer = None
_wandb_run = None
_project_name = None
_run_name = None

def init(project=None, run_name=None, config=None, tensorboard_dir=None, use_wandb=False, wandb_init_args=None):
    """
    Initialize ModelSight settings, hyperparameters config, and optional third-party integrations.
    """
    global _run_config, _tb_writer, _wandb_run, _project_name, _run_name
    _project_name = project
    _run_name = run_name or f"run_{int(time.time())}"
    if config:
        _run_config = config
        log_config(config, run_name=_run_name, project=project)
        
    # TensorBoard setup
    if tensorboard_dir:
        try:
            from torch.utils.tensorboard import SummaryWriter
            _tb_writer = SummaryWriter(log_dir=tensorboard_dir)
            _log_integration_status(tensorboard=True)
        except ImportError:
            try:
                from tensorboardX import SummaryWriter
                _tb_writer = SummaryWriter(log_dir=tensorboard_dir)
                _log_integration_status(tensorboard=True)
            except ImportError:
                print("[ModelSight Warning] tensorboard/tensorboardX not found. TensorBoard integration disabled.")
                
    # W&B setup
    if use_wandb or wandb_init_args:
        try:
            import wandb
            init_args = wandb_init_args or {}
            if project and "project" not in init_args:
                init_args["project"] = project
            if run_name and "name" not in init_args:
                init_args["name"] = run_name
            if config and "config" not in init_args:
                init_args["config"] = config
            _wandb_run = wandb.init(**init_args)
            _log_integration_status(wandb=True)
        except ImportError:
            print("[ModelSight Warning] wandb library not found. Weights & Biases integration disabled.")

def log_config(config, run_name=None, project=None):
    """Logs hyperparameters configuration to the ModelSight dashboard."""
    payload = {
        "config": config
    }
    if run_name:
        payload["run_name"] = run_name
    if project:
        payload["project_name"] = project
    
    print(f"ModelSight Config | {json.dumps(payload)}")
    sys.stdout.flush()
    
    try:
        import urllib.request
        req_body = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            "http://127.0.0.1:9824/metrics",
            data=req_body,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=0.08) as response:
            response.read()
    except Exception:
        pass

def _log_integration_status(tensorboard=None, wandb=None):
    payload = {}
    if tensorboard is not None:
        payload["tensorboard_active"] = tensorboard
    if wandb is not None:
        payload["wandb_active"] = wandb
        
    print(f"ModelSight Integration | {json.dumps(payload)}")
    sys.stdout.flush()
    
    try:
        import urllib.request
        req_body = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            "http://127.0.0.1:9824/metrics",
            data=req_body,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=0.08) as response:
            response.read()
    except Exception:
        pass

def log_dataset(name="Dataset", data=None, targets=None, classes=None, class_counts=None, feature_shape=None, num_samples=None, **kwargs):
    """
    Profile and log dataset analysis metadata to the ModelSight dashboard.
    """
    profile = {
        "name": name,
        "num_samples": num_samples,
        "classes": classes,
        "class_counts": class_counts,
        "feature_shape": feature_shape
    }
    
    if data is not None:
        if num_samples is None:
            if hasattr(data, "__len__"):
                num_samples = len(data)
            elif hasattr(data, "shape"):
                num_samples = data.shape[0]
            profile["num_samples"] = num_samples
            
        if feature_shape is None:
            if hasattr(data, "shape") and len(data.shape) > 1:
                profile["feature_shape"] = list(data.shape[1:])
            elif hasattr(data, "iloc"):
                profile["feature_shape"] = [len(data.columns)]
                
        if targets is not None and classes is None and class_counts is None:
            try:
                from collections import Counter
                t_list = targets
                if hasattr(targets, "numpy"):
                    t_list = targets.numpy().tolist()
                elif hasattr(targets, "tolist"):
                    t_list = targets.tolist()
                
                counts = Counter(t_list)
                classes = list(counts.keys())
                try:
                    classes.sort()
                except Exception:
                    pass
                class_counts = [counts[c] for c in classes]
                
                classes = [str(c) for c in classes]
                profile["classes"] = classes
                profile["class_counts"] = class_counts
            except Exception:
                pass
                
    for k, v in kwargs.items():
        profile[k] = v
        
    payload = {
        "dataset_profile": profile
    }
    
    print(f"ModelSight Dataset | {json.dumps(payload)}")
    sys.stdout.flush()
    
    try:
        import urllib.request
        req_body = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            "http://127.0.0.1:9824/metrics",
            data=req_body,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=0.08) as response:
            response.read()
    except Exception:
        pass

def _safe_float(val):
    if val is None:
        return None
    try:
        if hasattr(val, 'item'):
            return float(val.item())
        if hasattr(val, 'numpy'):
            val_np = val.numpy()
            if hasattr(val_np, 'item'):
                return float(val_np.item())
            return float(val_np)
        return float(val)
    except Exception:
        return None

def _safe_str(val):
    if val is None:
        return None
    try:
        return str(val)
    except Exception:
        return None

def log(epoch=None, total_epochs=None, step=None, total_steps=None, 
        loss=None, accuracy=None, val_loss=None, val_accuracy=None, 
        lr=None, gpu_usage=None, ram_usage=None, checkpoint=None,
        perplexity=None, tokens_per_sec=None, **kwargs):
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
        perplexity (float): Custom perplexity metric. If None and loss is provided, auto-calculated.
        tokens_per_sec (float): Training speed in tokens per second (LLMs).
        **kwargs: Any additional custom metrics.
    """
    try:
        metrics = {}
        
        # Setup values safely
        v_loss = _safe_float(loss)
        if v_loss is not None:
            metrics["loss"] = v_loss
            
        v_acc = _safe_float(accuracy)
        if v_acc is not None:
            metrics["accuracy"] = v_acc
            
        v_val_loss = _safe_float(val_loss)
        if v_val_loss is not None:
            metrics["val_loss"] = v_val_loss
            
        v_val_acc = _safe_float(val_accuracy)
        if v_val_acc is not None:
            metrics["val_accuracy"] = v_val_acc
            
        v_lr = _safe_float(lr)
        if v_lr is not None:
            metrics["lr"] = v_lr
            
        # LLM specific metrics
        v_perp = _safe_float(perplexity)
        if v_perp is None and v_loss is not None:
            try:
                import math
                if v_loss < 20.0:
                    v_perp = math.exp(v_loss)
            except Exception:
                pass
        if v_perp is not None:
            metrics["perplexity"] = v_perp
            
        v_tps = _safe_float(tokens_per_sec)
        if v_tps is not None:
            metrics["tokens_per_sec"] = v_tps
            
        # Copy custom kwargs
        for k, v in kwargs.items():
            safe_val = _safe_float(v)
            if safe_val is not None:
                metrics[k] = safe_val
            else:
                metrics[k] = _safe_str(v)
            
        # Auto-detect GPU usage details if requested and not provided
        gpu_details = None
        if gpu_usage is None:
            gpu_details = get_gpu_details()
            if gpu_details:
                gpu_usage = gpu_details.get("gpu_usage")
            
        v_gpu = _safe_float(gpu_usage)
        if v_gpu is not None:
            metrics["gpu_usage"] = v_gpu
            
        if gpu_details and isinstance(gpu_details, dict):
            for k, v in gpu_details.items():
                if k != "gpu_usage":
                    metrics[k] = v

        # Auto-detect RAM usage if requested and not provided
        if ram_usage is None:
            ram_usage = get_ram_usage()
            
        v_ram = _safe_float(ram_usage)
        if v_ram is not None:
            metrics["ram_usage"] = v_ram
            
        v_chk = _safe_str(checkpoint)
        if v_chk is not None:
            metrics["checkpoint"] = v_chk

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

        # Forward to TensorBoard if writer is active
        if _tb_writer:
            try:
                g_step = step if step is not None else (epoch if epoch is not None else 0)
                for k, v in metrics.items():
                    if isinstance(v, (int, float)) and k not in ['epoch', 'step', 'total_epochs', 'total_steps']:
                        _tb_writer.add_scalar(f"modelsight/{k}", v, global_step=g_step)
            except Exception:
                pass
                
        # Forward to W&B if active
        if _wandb_run:
            try:
                wandb_payload = metrics.copy()
                if epoch is not None:
                    wandb_payload["epoch"] = epoch
                if step is not None:
                    wandb_payload["step"] = step
                _wandb_run.log(wandb_payload)
            except Exception:
                pass

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
            try:
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
            except Exception:
                pass
except ImportError:
    pass

# PyTorch Lightning support
try:
    # pyrefly: ignore [missing-import]
    import pytorch_lightning as pl
    
    class ModelSightLightningCallback(pl.Callback):
        """PyTorch Lightning Callback to stream metrics automatically to ModelSight."""
        def on_train_epoch_end(self, trainer, pl_module):
            try:
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
            except Exception:
                pass
except ImportError:
    pass

# Hugging Face support
try:
    from transformers import TrainerCallback
    
    class ModelSightHFCallback(TrainerCallback):
        """Hugging Face Trainer Callback to stream metrics automatically to ModelSight."""
        def on_log(self, args, state, control, logs=None, **kwargs):
            try:
                logs = logs or {}
                epoch = logs.get("epoch")
                step = state.global_step if state else None
                
                loss = logs.get("loss")
                val_loss = logs.get("eval_loss")
                
                accuracy = logs.get("accuracy") or logs.get("eval_accuracy")
                val_accuracy = logs.get("eval_accuracy")
                
                lr = logs.get("learning_rate")
                
                perplexity = logs.get("perplexity") or logs.get("eval_perplexity")
                
                log(
                    epoch=epoch,
                    step=step,
                    loss=loss,
                    val_loss=val_loss,
                    accuracy=accuracy,
                    val_accuracy=val_accuracy,
                    lr=lr,
                    perplexity=perplexity
                )
            except Exception:
                pass
except ImportError:
    pass
