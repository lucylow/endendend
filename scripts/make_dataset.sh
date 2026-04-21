#!/usr/bin/env bash
# Hybrid SAR victim dataset: OpenCV tunnel bulk + optional real aug + split + train.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== OpenCV tunnel synth (5000) =="
python3 dataset/gen_dataset.py --preset sar_tunnel --out dataset/staging/synth_opencv \
  --train 4000 --val 600 --test 400 --seed 42

EXTRA=()
if [[ -d dataset/real_import/images ]] && [[ -n "$(ls -A dataset/real_import/images 2>/dev/null)" ]]; then
  echo "== Real augment (200 -> 1k) =="
  python3 dataset/augment_real.py \
    --in-images dataset/real_import/images \
    --in-labels dataset/real_import/labels \
    --out dataset/staging/aug --multiplier 5 --seed 7
  EXTRA+=(--pair dataset/staging/aug/images dataset/staging/aug/labels)
else
  echo "== Skip real augment (add dataset/real_import/{images,labels}) =="
fi

echo "== Merge + split (up to 4800 / 700 / 500; auto if pool smaller) =="
python3 dataset/split_dataset.py \
  --pair dataset/staging/synth_opencv/images/train dataset/staging/synth_opencv/labels/train \
  --pair dataset/staging/synth_opencv/images/val dataset/staging/synth_opencv/labels/val \
  --pair dataset/staging/synth_opencv/images/test dataset/staging/synth_opencv/labels/test \
  "${EXTRA[@]}" \
  --out dataset/hybrid --train 4800 --val 700 --test 500 --seed 1

echo "== Train YOLOv8 + ONNX (CPU) =="
python3 train_sar.py

echo "== QA =="
PYTHONPATH=. python3 -m unittest tests.test_dataset

echo "Optional Webots: open worlds/victim_dataset.world with VICTIM_DATASET_N=4000, then add"
echo "  --pair dataset/webots_synth/images/train dataset/webots_synth/labels/train"
echo "to split_dataset for extra tunnel renders."
