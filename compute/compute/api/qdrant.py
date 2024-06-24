from qdrant_client import QdrantClient, models
import os

QDRANT_API_KEY = os.getenv('QDRANT__SERVICE__API_KEY')
QDRANT_HOST = os.getenv('QDRANT_HOST')
QDRANT_PORT = os.getenv('QDRANT_PORT')

qdrant = QdrantClient(
    url=QDRANT_HOST,
    api_key=QDRANT_API_KEY,
    port=QDRANT_PORT,
    timeout=3600
)


_cols = qdrant.get_collections()
for col in _cols.collections:
    if col.name == 'dev__experiment':
        break
else:
    qdrant.create_collection(
        'dev__experiment',
        vectors_config=models.VectorParams(
            size=1024,
            distance=models.Distance.COSINE
        )
    )
    