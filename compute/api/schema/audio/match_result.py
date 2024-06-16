from pydantic import BaseModel


class MatchResult(BaseModel):
    record_id: str
    offset: int
    offset_sec: float
    confidence: float