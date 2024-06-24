import asyncio
import datetime
import logging
import os
import tempfile
import aiohttp
from fastapi import APIRouter, HTTPException
import requests

from ..schema.audio.dataset import Dataset

from .models.video import SingleVideo, Violation

from ..xpocketbase import client
from ..audio.audio_detect import Recognizer

from pocketbase.utils import ClientResponseError
from moviepy.editor import VideoFileClip

router = APIRouter(tags=["Video Indexing"])
api_logger = logging.getLogger('uvicorn')

COMPUTE_API = os.getenv("COMPUTE_API")
QDRANT_API_KEY = os.getenv('QDRANT__SERVICE__API_KEY')
QDRANT_HOST = os.getenv('QDRANT_HOST')
QDRANT_PORT = os.getenv('QDRANT_PORT')


async def compute_index(video_id, video_name, video_link):
    async with aiohttp.ClientSession() as session:
        async with session.post(f'http://{COMPUTE_API}/index', json={
            "video_id": 0,
            "video_name": str(video_name),
            "video_link": str(video_link),
            "qdrant_host": QDRANT_HOST,
            "qdrant_api_key": QDRANT_API_KEY,
            "qdrant_port": QDRANT_PORT
        }) as response:
            return await response.json()
         
   
async def run_moderate(video_link, threshold: float):
    async with aiohttp.ClientSession() as session:
        async with session.post(f'http://{COMPUTE_API}/moderate', json={
            "video_link": str(video_link),
            "qdrant_host": QDRANT_HOST,
            "qdrant_api_key": QDRANT_API_KEY,
            "qdrant_port": QDRANT_PORT,
            "batch_size": 256,
            "threshold": threshold,
        }) as response:
            return await response.json()
            
    

@router.post("/run_index/")
async def index_video(
    video_id: str,
):
    """Create video and audio embeddings for a video.
    
    Args:
        video_id (str): The id of the video to be indexed.
        
    Returns:
        dict: The embeddings for the video.
    """
    try:
        db_response = client.collection('videos').get_one(video_id)
    except ClientResponseError as e:
        api_logger.error(f"POST /video: {e.status} {e.data}")
        raise HTTPException(status_code=e.status, detail=e.data)

    if not db_response:
        raise HTTPException(status_code=404, detail="Video not found")
    
    file = client.get_file_url(db_response, db_response.video_file, {})
    
    index_result = await compute_index(db_response.id, db_response.id, file)
    
    recognizer = Recognizer()
    recognizer.upload_record(Dataset(record_id=db_response.id, filename=file))

    db_response = client.collection('videos').update(
        video_id,
        body_params={
            "video_indexed": True,
            "audio_indexed": True
        }
    )
    
    return index_result

    
@router.post("/run_check/")
async def run_check(
    video_id: str,
    moderation_session_id: str,
    threshold: float = 0.8
):
    try:
        db_response = client.collection('videos').get_one(video_id)
    except ClientResponseError as e:
        api_logger.error(f"POST /video: {e.status} {e.data}")
        raise HTTPException(status_code=e.status, detail=e.data)

    if not db_response:
        raise HTTPException(status_code=404, detail="Video not found")
    
    file = client.get_file_url(db_response, db_response.video_file, {})

    recognizer = Recognizer()
    async with aiohttp.ClientSession() as session:
        async with session.get(file) as resp:
            violations, video_bytes = await asyncio.gather(
                run_moderate(file, threshold),
                resp.read()
            )

    real_violations = []
    real_sources = []
    real_vvideos = []
    with tempfile.NamedTemporaryFile('wb', suffix='.mp4') as tf:
        tf.write(video_bytes)
        tf.seek(0)
        
        with VideoFileClip(tf.name) as clip:
            with tempfile.NamedTemporaryFile('wb', suffix='.wav') as file:
                clip.audio.write_audiofile(file.name, fps=16000)
                file.seek(0)

                for v in violations:
                    v['video'] = client.collection('videos').get_one(v['video_name'])
                    
                    results = recognizer.recognize_file(
                        file.name,
                        int(v['start'] / db_response.fps),
                        int(v['end'] / db_response.fps)
                    )
                    file.seek(0)

                    top = results[0]
                    for r in results[:8]:
                        if r.record_id == v['video'].id:
                            top = r
                            break
                
                    real_violations.append({
                        "start": int(v['start'] / db_response.fps),
                        "end": int(v['end'] / db_response.fps),
                        "violation_video_id": db_response.id,
                        "source_video_id": v['video'].id,
                        "max_score": v['max_score'],
                        "min_score": v['min_score'],
                        "avg_score": v['avg_score'],
                        "std_score": v['std_score'],
                        "marked_hard": top.record_id == v['video'].id,
                        "original_start": abs(int(top.offset_sec)),
                        "original_end": abs(int(top.offset_sec)) + int(v['end'] / db_response.fps) - int(v['start'] / db_response.fps),
                    })

                    if moderation_session_id:
                        real_violations[-1]['moderation_session'] = moderation_session_id

                    real_sources.append(v['video'])
                    real_vvideos.append(db_response)

    db_violations = []
    for rv, source, vil in zip(real_violations, real_sources, real_vvideos):            
        dv = client.collection('violations').create(body_params=rv)
        dv.source_video = source.__dict__
        dv.violation_video = vil.__dict__
        
        db_violations.append(dv)
        
    client.collection('videos').update(db_response.id, body_params={
        "checked": True,
        "moderation_session": moderation_session_id
    })
        
    return db_violations
