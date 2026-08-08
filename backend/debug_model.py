import os
from ultralytics import YOLO

print("=== DIAGNOSA MODEL BALICIVIC ===")
current_dir = os.getcwd()
print(f"1. Lokasi Folder Kerja: {current_dir}")

# Cek apakah file ada
model_path = os.path.join("weights", "best.pt")
if os.path.exists(model_path):
    print(f"2. File '{model_path}' DITEMUKAN. Memuat...")
else:
    print(f"2. File '{model_path}' TIDAK ADA. Mencoba download 'yolo11s.pt'...")
    model_path = os.path.join("weights", "yolo11s.pt")

try:
    # Coba load model
    model = YOLO(model_path) 
    print("3. Model BERHASIL diload ke Memory!")
    
    # Coba run dummy prediction (buat mancing error)
    print("4. Mencoba Test Run (Inference)...")
    # Kita buat gambar hitam dummy 640x640
    import numpy as np
    dummy_img = np.zeros((640, 640, 3), dtype=np.uint8)
    
    results = model.predict(dummy_img, verbose=False)
    print("5. Test Run SUKSES! Model berfungsi normal.")
    
except Exception as e:
    print("\n[FATAL ERROR] Model Gagal Jalan!")
    print(f"Pesan Error: {e}")
    print("\nSaran Perbaikan:")
    print("- Coba: pip install ultralytics --upgrade")
    print("- Coba: pip install numpy")