from pydantic import BaseModel, Field
from typing import Optional

class RecordData(BaseModel):
    record_id: str
    fingerprinted: Optional[bool] = Field(False)