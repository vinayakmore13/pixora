import os
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

print("Python executable:", sys.executable)
print("Importing deepface...")

try:
    from deepface import DeepFace
    print("DeepFace imported successfully.")
    
    print("Pre-loading Facenet model...")
    # This usually triggers weight download if not present
    DeepFace.build_model("Facenet")
    print("Facenet model loaded.")
except Exception as e:
    print(f"Error: {e}")
