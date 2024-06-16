from pydantic import BaseModel, Field
from typing import Optional

class Dataset(BaseModel):
    record_id: str
    filename: str