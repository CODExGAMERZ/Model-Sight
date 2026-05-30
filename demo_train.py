"""
ModelSight Training Simulation Demo
Runs a mock training process to test the ModelSight real-time dashboard.
"""

import time
import random
import modelsight

def run_simulation():
    total_epochs = 10
    total_steps_per_epoch = 5
    
    loss = 0.892
    accuracy = 0.125
    lr = 0.01

    print("=== Starting ModelSight Simulation Training ===")
    time.sleep(1.0)

    for epoch in range(1, total_epochs + 1):
        print(f"\n--- Epoch {epoch}/{total_epochs} ---")
        
        # Simulate steps in epoch
        for step in range(1, total_steps_per_epoch + 1):
            time.sleep(0.5) # simulate batch execution time
            
            # Update metrics
            loss -= random.uniform(0.02, 0.08)
            loss = max(0.012, loss)
            
            accuracy += random.uniform(0.04, 0.09)
            accuracy = min(0.985, accuracy)
            
            # Mock dynamic GPU usage
            gpu_usage = random.uniform(50.0, 85.0)

            # Print intermediate logs
            modelsight.log(
                epoch=epoch,
                total_epochs=total_epochs,
                step=step,
                total_steps=total_steps_per_epoch,
                loss=loss,
                accuracy=accuracy,
                lr=lr,
                gpu_usage=gpu_usage
            )

        # Learning rate decay at mid-training
        if epoch == 5:
            lr = 0.001
            print(f"[Optimizer] Decaying learning rate to {lr}")

        # Simulate checkpoint save every 3 epochs
        if epoch % 3 == 0 or epoch == total_epochs:
            checkpoint_name = f"checkpoint_epoch_{epoch}.pt"
            modelsight.log(
                epoch=epoch,
                total_epochs=total_epochs,
                loss=loss,
                accuracy=accuracy,
                lr=lr,
                gpu_usage=random.uniform(50.0, 85.0),
                checkpoint=checkpoint_name
            )
            print(f"[Model] Checkpoint saved successfully: {checkpoint_name}")

    print("\n=== Simulation Training Finished Successfully! ===")

if __name__ == "__main__":
    run_simulation()
