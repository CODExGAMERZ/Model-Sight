"""
ModelSight Overfitting & Validation Demo
Simulates a training run logging both training and validation metrics.
Validation loss decays initially, then rises consecutively from Epoch 5 onwards
to trigger the ModelSight overfitting detector warning.
"""

import time
import random
import modelsight

def run_overfitting_demo():
    total_epochs = 10
    loss = 0.850
    val_loss = 0.890
    accuracy = 0.150
    val_accuracy = 0.140
    lr = 0.01

    print("=== Starting ModelSight Overfitting Simulation ===")
    time.sleep(1.0)

    for epoch in range(1, total_epochs + 1):
        print(f"\n--- Epoch {epoch}/{total_epochs} ---")
        
        # Simulate training steps
        for step in range(1, 4):
            time.sleep(0.4) # simulate step time
            
            # Training loss decays steadily
            loss -= random.uniform(0.03, 0.06)
            loss = max(0.08, loss)
            
            # Training accuracy increases
            accuracy += random.uniform(0.05, 0.08)
            accuracy = min(0.97, accuracy)
            
            # Mock dynamic GPU usage
            gpu_usage = random.uniform(45.0, 75.0)

            modelsight.log(
                epoch=epoch,
                total_epochs=total_epochs,
                step=step,
                total_steps=3,
                loss=loss,
                accuracy=accuracy,
                lr=lr,
                gpu_usage=gpu_usage
            )
            
        # Simulate Validation pass at the end of epoch
        time.sleep(0.5)
        
        if epoch <= 4:
            # Normal learning: validation loss decreases
            val_loss -= random.uniform(0.02, 0.05)
            val_loss = max(0.12, val_loss)
            
            val_accuracy += random.uniform(0.04, 0.07)
            val_accuracy = min(0.95, val_accuracy)
        else:
            # Overfitting begins: training loss continues to decrease,
            # but validation loss rises consecutively!
            val_loss += random.uniform(0.04, 0.08)
            
            # validation accuracy plateaus/decays
            val_accuracy -= random.uniform(0.01, 0.03)
            val_accuracy = max(0.1, val_accuracy)
            
        print(f"[Validation] val_loss: {val_loss:.4f} | val_accuracy: {val_accuracy:.4f}")
        
        # Log validation metrics
        modelsight.log(
            epoch=epoch,
            total_epochs=total_epochs,
            loss=loss,
            accuracy=accuracy,
            val_loss=val_loss,
            val_accuracy=val_accuracy,
            lr=lr,
            gpu_usage=random.uniform(45.0, 75.0)
        )
        
    print("\n=== Overfitting Simulation Finished ===")

if __name__ == "__main__":
    run_overfitting_demo()
