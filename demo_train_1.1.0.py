"""
ModelSight 1.1.0 Feature Demonstration
Simulates a training run using the new features: modelsight.init, dataset profiling,
TensorBoard/W&B integrations, detailed GPU info, and LLM specific metrics.
"""

import time
import random
import numpy as np
import modelsight

def main():
    # 1. Initialize ModelSight with config hyperparameters and simulated integrations
    config = {
        "model_architecture": "Transformer-LLM-v2",
        "batch_size": 32,
        "optimizer": "AdamW",
        "learning_rate": 5e-5,
        "weight_decay": 0.01,
        "max_seq_length": 512,
        "use_peft_lora": True
    }
    
    print("=== Initializing ModelSight 1.1.0 ===")
    # Initialize settings and start integrations
    modelsight.init(
        project="llm-fine-tuning-demo",
        run_name="llama-lora-exp-4",
        config=config,
        tensorboard_dir="runs/exp_llama",
        use_wandb=False # Set to True to active W&B if wandb is installed
    )
    time.sleep(1.0)
    
    # 2. Log Dataset Profiling information
    print("\n=== Profiling Dataset ===")
    # Simulate some targets for classification or sequence targets
    dummy_targets = [random.choice(["Positive", "Negative", "Neutral"]) for _ in range(1200)]
    modelsight.log_dataset(
        name="IMDB Sentiment Dataset",
        targets=dummy_targets,
        feature_shape=[512],
        num_samples=1200
    )
    time.sleep(1.0)

    # 3. Simulate training epochs and batches
    total_epochs = 3
    total_steps = 10
    
    loss = 2.45
    lr = 5e-5
    
    print("\n=== Commencing LLM Fine-Tuning ===")
    
    for epoch in range(1, total_epochs + 1):
        print(f"\n--- Epoch {epoch}/{total_epochs} ---")
        
        for step in range(1, total_steps + 1):
            time.sleep(0.4) # Simulate batch processing
            
            # Decaying loss
            loss -= random.uniform(0.05, 0.15)
            loss = max(0.25, loss)
            
            # Simulate accuracy
            accuracy = 0.35 + (epoch * 0.15) + (step * 0.02)
            accuracy = min(0.965, accuracy)
            
            # Simulate LLM speed
            tokens_per_sec = random.uniform(1200, 1500)
            
            # Log telemetry
            modelsight.log(
                epoch=epoch,
                total_epochs=total_epochs,
                step=step,
                total_steps=total_steps,
                loss=loss,
                accuracy=accuracy,
                lr=lr,
                tokens_per_sec=tokens_per_sec
                # perplexity is auto-calculated from loss as exp(loss) inside log
            )
            
        # Simulate checkpoint
        checkpoint_path = f"model_epoch_{epoch}.bin"
        modelsight.log(
            epoch=epoch,
            total_epochs=total_epochs,
            checkpoint=checkpoint_path
        )
        print(f"[Checkpoint Saved] -> {checkpoint_path}")

    print("\n=== ModelSight 1.1.0 Training Demo Completed Successfully ===")

if __name__ == "__main__":
    main()
