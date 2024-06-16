import json
import os
import librosa
import numpy as np
from ...schema.audio import Config

cfg_path = os.path.join(os.path.dirname(__file__), 'config.json')
with open(cfg_path) as cfg:
    default_cfg: Config = Config(**json.load(cfg))

def read(filename: str) -> tuple[np.array, int]:
    if os.path.exists(filename):
        return librosa.load(filename, sr=default_cfg.sample_rate)
    else:
        raise FileNotFoundError