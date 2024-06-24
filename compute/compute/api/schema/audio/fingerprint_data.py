from pydantic import BaseModel

class FingerprintData(BaseModel):
    hash: str
    record_id: str
    offset: int
