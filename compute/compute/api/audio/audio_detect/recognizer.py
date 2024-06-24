from itertools import groupby
import tempfile

import numpy as np
import requests
from .reader import read
from .dbman import DBManager
from .fingerprint import Fingerprint
from ...schema.audio import (
    Dataset, 
    FingerprintData, 
    RecordData, 
    Config, 
    MatchResult
)
import json
from moviepy.editor import VideoFileClip
from tempfile import NamedTemporaryFile
import os

cfg_path = os.path.join(os.path.dirname(__file__), 'config.json')
with open(cfg_path) as cfg:
    default_cfg: Config = Config(**json.load(cfg))

class Recognizer:
    
    def __init__(self):
        self._dbman = DBManager()

    def upload_record(self, data: Dataset):
        fingerprints: list[FingerprintData] = []
        record: RecordData = []
        record_id = data.record_id
        with tempfile.NamedTemporaryFile('wb', suffix='.mp4') as tf:
            tf.write(requests.get(data.filename).content)
            tf.seek(0)
            with VideoFileClip(tf.name) as clip:
                with NamedTemporaryFile('wb', suffix='.wav') as file:
                    clip.audio.write_audiofile(file.name, fps=16000)
                    file.seek(0)
                    y, _ = read(file.name)
            hashes = Fingerprint(y)
            seen: set[tuple[str, int]] = set()
            for hash, offset in hashes:
                if (hash, offset) in seen:
                    continue
                fingerprint_data: FingerprintData = FingerprintData(**{
                    'hash': hash,
                    'record_id': record_id,
                    'offset': offset
                })
                fingerprints.append(fingerprint_data)
                seen.add((hash, offset))

            record: RecordData = RecordData(**{
                'record_id': record_id,
                'fingerprinted': True
            })

        self._dbman.upload_record(record)
        # for fingerprint in fingerprints:
        self._dbman.upload_fingerprints(fingerprints) 

    def upload_dataset(self, data: list[Dataset]):
        fingerprints: list[FingerprintData] = []
        records: list[RecordData] = []
        for elem in data:
            record_id = elem.record_id
            with tempfile.NamedTemporaryFile('wb', suffix='.mp4') as tf:
                tf.write(requests.get(elem.filename).content)
                tf.seek(0)
                with VideoFileClip(tf.name) as clip:
                    with NamedTemporaryFile('wb', suffix='.wav') as file:
                        clip.audio.write_audiofile(file.name, fps=16000)
                        file.seek(0)
                        y, _ = read(file.name)
                hashes = Fingerprint(y)
                seen: set[tuple[str, int]] = set()
                for hash, offset in hashes:
                    if (hash, offset) in seen:
                        continue
                    fingerprint_data: FingerprintData = FingerprintData(**{
                        'hash': hash,
                        'record_id': record_id,
                        'offset': offset
                    })
                    fingerprints.append(fingerprint_data)
                    seen.add((hash, offset))

                record_data: RecordData = RecordData(**{
                    'record_id': record_id,
                    'fingerprinted': True
                })
                records.append(record_data)
        
        # for record in records:
        self._dbman.upload_records(records)

        # for fingerprint in fingerprints:
        self._dbman.upload_fingerprints(fingerprints) 


    def _align_offsets(
        self, 
        matches: list[tuple[str, int]], 
        dedup_hashes: dict[str, int],
        top_n: int = default_cfg.top_n
    ) -> list[MatchResult]:
        
        sorted_matches = sorted(
            matches, 
            key=lambda m: (m[0], m[1])
        )
        counts = [
            (*key, len(list(group))) 
            for key, group in groupby(
                sorted_matches, 
                key=lambda m: (m[0], m[1])
            )
        ]
        record_matches = sorted(
            [
                max(list(group), key=lambda g: g[2]) 
                for _, group in groupby(
                    counts, 
                    key=lambda count: count[0]
                )
            ],
            key=lambda count: count[2], 
            reverse=True
        )
        record_results = []
        for record_id, offset, _ in record_matches[:top_n]:
            hashes_matched = dedup_hashes[record_id]
            record_hashes = len(self._dbman.fingerprints_by(record_id))
            result: MatchResult = MatchResult(**{
                'record_id': record_id,
                'offset': float(offset),
                'offset_sec': float(offset / default_cfg.sample_rate * default_cfg.n_overlap),
                'confidence': float(hashes_matched / record_hashes),
            })
            record_results.append(result)
        return record_results


    def recognize_file(
        self, 
        filename: str, 
        start: int | None = None, 
        end: int | None = None
    ) -> list[MatchResult]:
        
        y, _ = read(filename)
        if start:
            start *= default_cfg.sample_rate
        if end:
            end *= default_cfg.sample_rate
        hashes = set(Fingerprint(y[start:end]))
        matches, dedup_hashes = self._dbman.match_fingerprints(hashes)
        results = self._align_offsets(matches, dedup_hashes, len(hashes))
        return results
    
    
    def recognize(
        self,
        y: np.array,
    ) -> list[MatchResult]:
        hashes = set(Fingerprint(y))
        matches, dedup_hashes = self._dbman.match_fingerprints(hashes)
        results = self._align_offsets(matches, dedup_hashes, len(hashes))
        return results
