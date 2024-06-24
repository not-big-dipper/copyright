import asyncio
import os
from typing import Any, Literal
from pocketbase import PocketBase
from ...schema.audio import FingerprintData, RecordData
from pocketbase import Client
from pocketbase.utils import ClientResponseError
from .database.functions import (
    new_fingerprint, 
    new_fingerprints,
    new_record, 
    new_records,
    delete_all_fingerprints, 
    delete_all_records,
    get_fingerprints,
    get_fingerprints_in
)


class DBManager:

    def __init__(self):
        ...

    def upload_record(
        self,
        record_data: RecordData,
    ):
        return new_record(
            record_data.record_id,
        )

    def upload_records(
        self,
        records: list[RecordData]
    ):
        return new_records(
            records
        )
    
    def upload_fingerprint(
        self,
        fingerprint_data: FingerprintData
    ):
        return new_fingerprint(
            fingerprint_data.record_id,
            fingerprint_data.hash,
            fingerprint_data.offset
        )

    def upload_fingerprints(
        self,
        fingerprints: list[FingerprintData]
    ):
        return new_fingerprints(
            fingerprints
        )

    def match_fingerprints(
        self,
        hashes: list[tuple[str, int]],
        batch_size: int = 500,
    ) -> tuple[list[tuple[str, int]], dict[str, int]]:
        bins = {}
        for hash, offset in hashes:
            if hash in bins.keys():
                bins[hash].append(offset)
            else:
                bins[hash] = [offset]
        dedup_hashes = {}
        values = list(bins.keys())

        results = []
        for i in range(0, len(values), batch_size):
            query_results = []
            query_results.extend(
                get_fingerprints_in(
                    hashes=values[i : min(i + batch_size, len(values))]
                )
            )

            for query_result in query_results:
                if query_result.record_id not in dedup_hashes.keys():
                    dedup_hashes[query_result.record_id] = 1
                else:
                    dedup_hashes[query_result.record_id] += 1
                for sampled_offset in bins[query_result.hash]:
                    results.append(
                        (query_result.record_id, query_result.offset - sampled_offset)
                    )
        return results, dedup_hashes


    def delete_all(
        self,
        collection_name: Literal['fingerprints', 'records'],
    ):
        if collection_name == 'fingerprints':
            delete_all_fingerprints()
        else:
            delete_all_records()
        

    def fingerprints_by(
        self,
        record_id: str | None = None,
        hash: str | None = None
    ):
        return get_fingerprints(record_id, hash)