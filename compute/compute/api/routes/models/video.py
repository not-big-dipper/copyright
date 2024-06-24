import datetime
from pydantic import BaseModel


class SingleVideo(BaseModel):
    """Return type for upload_video"""
    
    id: str
    created: str | datetime.datetime
    updated: str | datetime.datetime
    
    title: str
    description: str
    group: str
    video_file: str
    thumbnail_file: str
    fps: float
    checked: bool
    audio_indexed: bool
    video_indexed: bool
    moderation_session: str | None


class Violation(BaseModel):
    """Single violation"""

    id: str | None = None
    created: str | datetime.datetime | None = None
    updated: str | datetime.datetime | None = None

    start: int
    end: int
    source_video: SingleVideo
    violation_video: SingleVideo
    original_start: int
    original_end: int
    max_score: float = 0.
    min_score: float = 0.
    avg_score: float = 0.
    std_score: float = 0.
    
    marked_hard: bool = False
    discarded: bool = False

    moderation_session: str | None = None


    
class VideoWithViolations(BaseModel):
    """Return type for get_video_with_probes"""
    
    video: SingleVideo
    violations: list[Violation]


class Filter(BaseModel):
    key: str
    value: str
    
    def build_params(self):
        return f'{self.key}~"{self.value}"'
    

class GetVideosWithFilters(BaseModel):
    page: int
    per_page: int
    filter: list[Filter] | None = []
    sort: str | None = None
    

class UpdateVideo(BaseModel):
    video_id: str
    title: str | None = None
    description: str | None = None
    group: str | None = None
    checked: bool | None = None
    fps: int | None = None
    
    
class Embedding(BaseModel):
    video_frame_embeddings: dict[int, list[float]]
    audio_fingerprints: list[tuple[str, int]]