import asyncio
import os
from typing import Any, Literal
from pocketbase import PocketBase
from ...schema.audio import FingerprintData, RecordData
from pocketbase import Client
from pocketbase.utils import ClientResponseError

database_url = os.environ.get("DATABASE_URL")
database_user = os.environ.get("DATABASE_USER")
database_password = os.environ.get("DATABASE_PASSWORD")

client = Client(database_url)
client.admins.auth_with_password(database_user, database_password)

class PBManager:

    def __init__(self):
        self._client: PocketBase = client

    def set_collections(
        self, 
        fingerprint_col: str,
        record_col: str
    ):
        try:
            self._collections = {
                'fingerprints': self._client.collection(fingerprint_col),
                'records': self._client.collection(record_col)
            }
        except Exception as exc:
            raise Exception(
                'Collection retrieval failed. Check the names again.'
            ) from exc
    

    async def _upload(
        self,
        collection_name: Literal['fingerprints', 'records'],
        data: dict[str, Any],
    ):
        try:
            return self._collections[collection_name].create(data)
        except ClientResponseError as exc:
            raise Exception(
                f'Data upload to `{collection_name}` failed. {exc.data}'
            ) from exc


    async def upload_record(
        self,
        record_data: RecordData,
    ):
        await self._upload(
            collection_name='records', 
            data=record_data.model_dump()
        )

    
    async def upload_fingerprint(
        self,
        fingerprint_data: FingerprintData
    ):
        await self._upload(
            collection_name='fingerprints', 
            data=fingerprint_data.model_dump()
        )


    def _filter(
        self,
        collection_name: Literal['fingerprints', 'records'],
        filter: str,
        batch_size: int = 1000,
    ) -> list:
        try:
            return self._collections[collection_name].get_full_list(
                batch=batch_size, 
                query_params={
                    'filter': filter
                }
            )
        except ClientResponseError as exc:
            raise Exception(
                f'Filter in `{collection_name}` failed. {exc.data}'
            ) from exc
    

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
            filter = '(' + '||'.join(
                [
                    f'hash="{values[j]}"' 
                    for j in range(i, min(i + batch_size, len(values)))
                ]
            ) + ')'
            query_results.extend(self._filter('fingerprints', filter))
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

    async def _delete_id(
        self,
        collection_name: Literal['fingerprints', 'records'],
        id: Any      
    ):
        return self._collections[collection_name].delete(id=id)

    async def delete_all(
        self,
        collection_name: Literal['fingerprints', 'records'],
    ):
        elems = self._collections[collection_name].get_full_list(batch=10000)
        await asyncio.gather(*[
            self._delete_id(collection_name, elem.id)
            for elem in elems
        ])
        