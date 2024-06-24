from typing import Optional
from pydantic import BaseModel, Field


class Config(BaseModel):
    sample_rate: Optional[int] = Field(16000)
    n_fft: Optional[int] = Field(1024)
    n_overlap: Optional[int] = Field(32)
    n_perseg: Optional[int] = Field(64)
    fraction: Optional[float] = Field(0.05)
    mode: Optional[int] = Field(2)
    amp_min: Optional[float] = Field(1e-5)
    fan_value: Optional[int] = Field(5)
    mn_htd: Optional[int] = Field(0)
    mx_htd: Optional[int] = Field(200)
    peak_sort: Optional[bool] = Field(True)
    fingerprint_reduction: Optional[int] = Field(40)
    top_n: Optional[int] = Field(5)