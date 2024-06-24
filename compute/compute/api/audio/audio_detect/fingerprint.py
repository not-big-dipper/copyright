import numpy as np
import json
from spectromap.spectromap import spectromap
from ...schema.audio import Config
from operator import itemgetter
from itertools import groupby
import hashlib


import os
cfg_path = os.path.join(os.path.dirname(__file__), 'config.json')
with open(cfg_path) as cfg:
    default_cfg: Config = Config(**json.load(cfg))

class Fingerprint:

    @staticmethod
    def filter_peaks(
        peak_mask: np.array,
        peaks: np.array,
        amp_min: float = default_cfg.amp_min
    ) -> list[tuple[list[int], list[int]]]:
        # extract peaks
        amps = peaks[peak_mask]
        freqs, times = np.where(peak_mask)

        # filter peaks
        amps = amps.flatten()

        # get indices for frequency and time
        filter_idxs = np.where(amps > amp_min)

        freqs_filter = freqs[filter_idxs]
        times_filter = times[filter_idxs]
        return list(zip(freqs_filter, times_filter))
    
    @staticmethod
    def generate_hashes(
        peaks: list[tuple[int, int]], 
        fan_value: int = default_cfg.fan_value
    ) -> list[tuple[str, int]]:
        # frequencies are in the first position of the tuples
        idx_freq = 0
        # times are in the second position of the tuples
        idx_time = 1

        if default_cfg.peak_sort:
            peaks.sort(key=itemgetter(1))

        hashes = []
        for i in range(len(peaks)):
            for j in range(1, fan_value):
                if (i + j) < len(peaks):

                    freq1 = peaks[i][idx_freq]
                    freq2 = peaks[i + j][idx_freq]
                    t1 = peaks[i][idx_time]
                    t2 = peaks[i + j][idx_time]
                    t_delta = t2 - t1

                    if default_cfg.mn_htd <= t_delta <= default_cfg.mx_htd:
                        h = hashlib.sha1(
                            f"{str(freq1)}|{str(freq2)}|{str(t_delta)}".encode('utf-8')
                        )

                        hashes.append(
                            (
                                h.hexdigest()[0:default_cfg.fingerprint_reduction], 
                                t1 + 1
                            )
                        )

        return hashes
    
    def __new__(
        cls,
        y = np.array,
        fs = default_cfg.sample_rate,
    ) -> list[tuple[str, int]]:
        # FFT the signal and extract frequency components
        smap = spectromap(
            y, 
            fs=fs, 
            nfft=default_cfg.n_fft, 
            noverlap=default_cfg.n_overlap, 
            nperseg=default_cfg.n_perseg
        )

        id_peaks, peaks = smap.peak_matrix(
            fraction=default_cfg.fraction,                             
            condition=default_cfg.mode
        )

        local_maxima = Fingerprint.filter_peaks(
            peak_mask=id_peaks, 
            peaks=peaks, 
        )
        # return hashes
        return Fingerprint.generate_hashes(local_maxima)