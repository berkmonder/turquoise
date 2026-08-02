# backend/models/generate_mnist.py
import os
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms
import onnx

class MNISTClassifier(nn.Module):
    def __init__(self):
        super(MNISTClassifier, self).__init__()
        self.network = nn.Sequential(
            nn.Linear(784, 256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, 10)
        )

    def forward(self, x):
        x = x.view(-1, 784)
        return self.network(x)

def train_and_export():
    print("Fetching MNIST training dataset...")
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,))
    ])

    train_dataset = datasets.MNIST(root='./data', train=True, download=True, transform=transform)
    train_loader = torch.utils.data.DataLoader(train_dataset, batch_size=64, shuffle=True)

    model = MNISTClassifier()
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)

    print("Training neural network on MNIST (1 epoch)...")
    model.train()
    for batch_idx, (data, target) in enumerate(train_loader):
        optimizer.zero_grad()
        output = model(data)
        loss = criterion(output, target)
        loss.backward()
        optimizer.step()
        if batch_idx % 200 == 0:
            print(f"Batch {batch_idx}/{len(train_loader)} - Loss: {loss.item():.4f}")

    model.eval()
    dummy_input = torch.randn(1, 784)
    output_path = os.path.join(os.path.dirname(__file__), 'mnist.onnx')

    # Standard PyTorch ONNX export
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=15,
        do_constant_folding=True,
        input_names=['X'],
        output_names=['Y'],
        dynamic_axes={'X': {0: 'batch_size'}, 'Y': {0: 'batch_size'}}
    )

    # Load and resave with onnx to enforce single-file binary embedding
    onnx_model = onnx.load(output_path)
    onnx.save(onnx_model, output_path)

    # Clean up any leftover external sidecar files if generated
    sidecar_data = f"{output_path}.data"
    if os.path.exists(sidecar_data):
        os.remove(sidecar_data)

    print(f"Successfully exported self-contained MNIST model to: {output_path}")

if __name__ == '__main__':
    train_and_export()
