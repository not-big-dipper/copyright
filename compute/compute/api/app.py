from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .log import logger  # noqa: F401
from .routes import video, index, moderation
from .xpocketbase import client # noqa: F401

app = FastAPI()
origins = "*"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(video.router)
app.include_router(index.router)
app.include_router(moderation.router)
# app.include_router(audio.router)
# app.include_router(mock_video.router)