import logging
import os
import shutil
import tempfile

import cv2
from fastapi import APIRouter, Body, File, UploadFile, HTTPException, Query
from typing import Annotated, Literal
import base64
import requests

from ..xpocketbase import client
from .models.video import Embedding, GetVideosWithFilters, SingleVideo, UpdateVideo, VideoWithViolations, Filter, Violation
from pocketbase.client import FileUpload
from pocketbase.utils import ClientResponseError
from ..qdrant import qdrant, models
from ..audio.audio_detect.database.functions import get_fingerprints

router = APIRouter(tags=["Video Basic Operations"])
api_logger = logging.getLogger('api')

def make_video_with_urls(video):
    video.video_file = client.get_file_url(video, video.video_file, {})
    video.thumbnail_file = client.get_file_url(video, video.thumbnail_file, {})
    return video

@router.post("/video/")
async def upload_video(
    file: UploadFile = File(...),
    title: str = "Untitled",
    description: str | None = None,
    group: Literal["index", "valid", "test"] | None = None,
    moderate_session_id: str | None = None
) -> SingleVideo:
    """Загрузка единичного видео в базу для последующей обработки."""
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
                body_ = {
                    "title": title,
                    "description": description,
                    "group": group,
                    "video_file": FileUpload((file.filename, temp_file, 'application/octet-stream')),
                    "thumbnail_file": FileUpload((thumbnail_file_name, tumbnail_file, 'image/jpeg')),
                    "fps": fps,
                    "moderation_session": moderate_session_id
                }
                
                for key in list(body_.keys()):
                    if body_[key] is None:
                        del body_[key]
                
                db_response = client.collection('videos').create(body_params=body_)
            except ClientResponseError as e:
                api_logger.error(f"POST /video: {e.status} {e.data}")
                raise HTTPException(status_code=e.status, detail=e.data)

    db_response = make_video_with_urls(db_response)
    db_response.moderate_session_id = moderate_session_id
    return db_response


@router.get("/video/")
async def get_video(
   video_id: str
) -> SingleVideo:
    try:
        db_response = client.collection('videos').get_one(video_id)
    except ClientResponseError as e:
        api_logger.error(f"GET /video: {e.status} {e.data}")
        raise HTTPException(status_code=e.status, detail=e.data)
            
    db_response = make_video_with_urls(db_response)
    
    return db_response

@router.get("/all_violations/")
async def get_videos_with_violations(
    moderation_session_id: str | None = None
) -> list[Violation]:
    try:
        if moderation_session_id is not None:
            violations = client.collection('violations').get_full_list(
                query_params={
                    'filter': f"moderation_session~'{moderation_session_id}'"
                }
            )
        else:
            violations = client.collection('violations').get_full_list()

        output = []
        for violation in violations:
            violation.source_video = make_video_with_urls(
                client.collection('videos').get_one(violation.source_video_id)
            ).__dict__
            violation.violation_video = make_video_with_urls(
                client.collection('videos').get_one(violation.violation_video_id)
            ).__dict__
            output.append(violation.__dict__)
        
            
    except ClientResponseError as e:
        api_logger.error(f"GET /videos_with_violations: {e.status} {e.data}")
        raise HTTPException(status_code=e.status, detail=e.data)
    
    return output

@router.get('/violations')
async def get_violations(
    source_video_id: str = None,
    violation_video_id: str = None,
    page: int = 1,
    per_page: int = 30,
    sort: str = None
) -> list[Violation]:
    if source_video_id is None and violation_video_id is None:
        raise HTTPException(status_code=400, detail="At least one of the parameters should be provided")
    elif source_video_id is not None and violation_video_id is not None:
        raise HTTPException(status_code=400, detail="Only one of the parameters should be provided")
    else:
        pass
    

    try:
        db_response = client.collection('violations').get_list(
            query_params={
                'filter': f"source_video_id~'{source_video_id}'" if source_video_id is not None else f"violation_video_id~'{violation_video_id}'",
                'sort': sort if sort is not None else None
            },
            page=page,
            per_page=per_page
        )
    except ClientResponseError as e:
        api_logger.error(f"GET /violations: {e.status} {e.data}")
        raise HTTPException(status_code=e.status, detail=e.data)
   
    violations = db_response.items
    for violation in violations:
        violation.source_video = make_video_with_urls(
            client.collection('videos').get_one(violation.source_video_id)
        )
        violation.violation_video = make_video_with_urls(
            client.collection('videos').get_one(violation.violation_video_id)
        )
        
    return violations
   

@router.post("/videos/")
async def get_videos(
   body: GetVideosWithFilters,
) -> list[SingleVideo]:
    try:
        filter = [f.build_params() for f in body.filter]
        filter = ' && '.join(filter)
        filter = '(' + filter + ')' if filter else None

        db_response = client.collection('videos').get_list(
            page=body.page,
            per_page=body.per_page,
            query_params={
                'filter': filter,
                'sort': body.sort
            }
        )
    except ClientResponseError as e:
        api_logger.error(f"GET /videos: {e.status} {e.data}")
        raise HTTPException(status_code=e.status, detail=e.data)
    
    for video in db_response.items:
        video.video_file = client.get_file_url(video, video.video_file, {})
        video.thumbnail_file = client.get_file_url(video, video.thumbnail_file, {})

    return db_response.items

@router.delete("/video/")
async def delete_video(
    video_id: str
) -> bool:
    try:
        db_response = client.collection('videos').delete(video_id)
    except ClientResponseError as e:
        api_logger.error(f"DELETE /video: {e.status} {e.data}")
        raise HTTPException(status_code=e.status, detail=e.data)
    
    return db_response

@router.put("/video/")
async def update_video(
    body: Annotated[UpdateVideo, Body],
) -> SingleVideo:
    try:
        update_ = body.model_dump(exclude={'video_id'})
        for key in list(update_.keys()):
            if update_[key] is None:
                del update_[key]

        db_response = client.collection('videos').update(
            body.video_id,
            body_params=update_
        )
    except ClientResponseError as e:
        api_logger.error(f"PUT /video: {e.status} {e.data}")
        raise HTTPException(status_code=e.status, detail=e.data)
    
    db_response = make_video_with_urls(db_response)
    return db_response


@router.put("/violation/")
async def update_violation(
    violation_id: str,
    body: Annotated[Violation, Body],
) -> Violation:
    try:
        update_ = body.model_dump(exclude={'violation_id'})
        for key in list(update_.keys()):
            if update_[key] is None:
                del update_[key]

        db_response = client.collection('violations').update(
            violation_id,
            body_params=update_
        )
    except ClientResponseError as e:
        api_logger.error(f"PUT /violation: {e.status} {e.data}")
        raise HTTPException(status_code=e.status, detail=e.data)
    
    return db_response


@router.get("/violation_frames/")
def violation_frames(
    violation_id: str
):
    try:
        db_response = client.collection('violations').get_one(violation_id)
    except ClientResponseError as e:
        api_logger.error(f"GET /violation_frames: {e.status} {e.data}")
        raise HTTPException(status_code=e.status, detail=e.data)
    
    source_video = client.collection('videos').get_one(db_response.source_video_id)
    violation_video = client.collection('videos').get_one(db_response.violation_video_id)
    
    source_bytes_ = client.get_file_url(source_video, source_video.video_file, {})
    violation_bytes_ = client.get_file_url(violation_video, violation_video.video_file, {})
    
    source_bytes_ = requests.get(source_bytes_).content
    violation_bytes_ = requests.get(violation_bytes_).content
    
    with tempfile.NamedTemporaryFile(suffix='.mp4') as source_file, tempfile.NamedTemporaryFile(suffix='.mp4') as violation_file:
        source_file.write(source_bytes_)
        violation_file.write(violation_bytes_)
        source_file.seek(0)
        violation_file.seek(0)
        
        source_cap = cv2.VideoCapture(source_file.name)
        violation_cap = cv2.VideoCapture(violation_file.name)
        
        source_frame_id = db_response.start
        violation_frame_id = db_response.original_start
        
        source_cap.set(cv2.CAP_PROP_POS_FRAMES, source_frame_id)
        violation_cap.set(cv2.CAP_PROP_POS_FRAMES, violation_frame_id)
        
        source_frame = source_cap.read()[1]
        violation_frame = violation_cap.read()[1]
        
        source_cap.release()
        violation_cap.release()
        
    b64_source = cv2.imencode('.png', source_frame)[1]
    b64_violation = cv2.imencode('.png', violation_frame)[1]
    
    base64_source = base64.b64encode(b64_source).decode('utf-8')
    base64_violation = base64.b64encode(b64_violation).decode('utf-8')
    
    return {
        "source": base64_source,
        "violation": base64_violation
    }
    
    
@router.get('/embeddings')
def get_embeddings(video_id: str) -> Embedding:
    points: dict[int, list[float]] = {}
    offset = None
    while True:
        result, offset  = qdrant.scroll(
            'dev__experiment',
            scroll_filter=models.Filter(must=[models.FieldCondition(key='video_name', match=models.MatchValue(value=video_id))]),
            limit=128,
            with_payload=True,
            with_vectors=True,
            offset=offset
        )
        for r in result:
            points[r.payload['second']] = r.vector
        
        if offset is None:
            break
            
    fingerprints = [(x.hash, x.offset) for x in get_fingerprints(record_id=video_id)]
    
    return Embedding(video_frame_embeddings=points, audio_fingerprints=fingerprints)