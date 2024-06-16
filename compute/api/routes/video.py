import logging
import os
import shutil
import tempfile

import cv2
from fastapi import APIRouter, File, UploadFile, HTTPException
from typing import Literal

from ..xpocketbase import client
# from ..qdrant import qdrant, models
from pocketbase.client import FileUpload
from pocketbase.utils import ClientResponseError

router = APIRouter(tags=["Video Basic Operations"])
api_logger = logging.getLogger('api')


@router.post("/video/")
async def upload_video(
    file: UploadFile = File(...),
    title: str = "Untitled",
    description: str = None,
    group: Literal["index", "test"] = None
):
    with tempfile.NamedTemporaryFile() as temp_file:
        shutil.copyfileobj(file.file, temp_file)
        temp_file.seek(0)
        
        cap = cv2.VideoCapture(temp_file.name)
        fps = cap.get(cv2.CAP_PROP_FPS)
        tumbnail = cap.read()[1]
        thumbnail_file_name = os.path.splitext(file.filename)[0] + ".jpg"
        with tempfile.NamedTemporaryFile(suffix='.jpg') as tumbnail_file:
            cv2.imwrite(tumbnail_file.name, tumbnail)
            tumbnail_file.seek(0)
            
            cap.release()
            
            temp_file.seek(0)
            
            try:
                db_response = client.collection('videos').create(body_params={
                    "title": title,
                    "description": description,
                    "group": group,
                    "video_file": FileUpload((file.filename, temp_file, 'application/octet-stream')),
                    "thumbnail_file": FileUpload((thumbnail_file_name, tumbnail_file, 'image/jpeg')),
                    "fps": fps
                })
            except ClientResponseError as e:
                api_logger.error(f"POST /video: {e.status} {e.data}")
                raise HTTPException(status_code=e.status, detail=e.data)
            
    return db_response


@router.get("/video/")
async def get_video(
   video_id: str
):
    try:
        db_response = client.collection('videos').get_one(video_id)
    except ClientResponseError as e:
        api_logger.error(f"GET /video: {e.status} {e.data}")
        raise HTTPException(status_code=e.status, detail=e.data)
            
    db_response.video_file = client.get_file_url(db_response, db_response.video_file, {})
    db_response.thumbnail_file = client.get_file_url(db_response, db_response.thumbnail_file, {})
    
    return db_response

@router.get("/videos/")
async def get_videos(
    page: int = 1,
    per_page: int = 30
):
    try:
        db_response = client.collection('videos').get_list(page=page, per_page=per_page)
    except ClientResponseError as e:
        api_logger.error(f"GET /videos: {e.status} {e.data}")
        raise HTTPException(status_code=e.status, detail=e.data)
    
    for video in db_response.items:
        video.video_file = client.get_file_url(video, video.video_file, {})
        video.thumbnail_file = client.get_file_url(video, video.thumbnail_file, {})

    return db_response

@router.delete("/video/")
async def delete_video(
    video_id: str
):
    try:
        db_response = client.collection('videos').delete(video_id)
    except ClientResponseError as e:
        api_logger.error(f"DELETE /video: {e.status} {e.data}")
        raise HTTPException(status_code=e.status, detail=e.data)
    
    # qdrant.delete('dev__experiment', models.FilterSelector(filter=models.Filter(must=[models.FieldCondition('video_name', models.Match(db_response.video_file))])))
    return db_response

@router.put("/video/")
async def update_video(
    video_id: str,
    title: str = None,
    description: str = None,
    group: Literal["index", "test"] = None
):
    try:
        db_response = client.collection('videos').update(video_id, body_params={
            "title": title,
            "description": description,
            "group": group
        })
    except ClientResponseError as e:
        api_logger.error(f"PUT /video: {e.status} {e.data}")
        raise HTTPException(status_code=e.status, detail=e.data)
            
    return db_response

@router.get("/video_probes/")
async def video_probes(
    video_id: str,
):
    try:
        probe = client.collection('video_probs').get_list(
            query_params={
                'filter': f"video_id~'{video_id}'"
            }
        )
    except ClientResponseError as e:
        api_logger.error(f"GET /video_probs: {e.status} {e.data}")
        pass
    
    return {
        "video": client.collection('videos').get_one(video_id),
        "violations": probe.items
    }

