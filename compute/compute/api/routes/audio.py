# import logging
# import os
# import shutil
# import tempfile

# from fastapi import APIRouter, File, UploadFile, HTTPException
# from typing import Literal
# from moviepy.editor import VideoFileClip

# import requests

# from ..xpocketbase import client
# # from ..qdrant import qdrant, models
# from pocketbase.client import FileUpload
# from pocketbase.utils import ClientResponseError
# from ..audio.audio_detect import Recognizer, PBManager
# from ..schema.audio import Dataset


# router = APIRouter(tags=["Audio Fingerprint Operations"])
# api_logger = logging.getLogger('api')


# @router.post("/audio_all/")
# async def upload_all(
#     group: Literal["index", "test"] = None
# ):
#     pbman = PBManager()
#     pbman.set_collections('fingerprints', 'records')
#     recognizer = Recognizer(pbman)
#     try:
#         db_response = client.collection('videos').get_full_list(
#             query_params={
#                 'filter': f'group="{group}"'
#             }
#         )
#         dataset: list[Dataset] = []
#         for vid in db_response:
#             url = client.get_file_url(vid, vid.video_file, {})
#             data = Dataset(
#                 record_id=vid.id,
#                 filename=url
#             )
#             dataset.append(data)
#         await recognizer.upload_dataset(dataset)

#     except ClientResponseError as e:
#         api_logger.error(f"POST /video: {e.status} {e.data}")
#         raise HTTPException(status_code=e.status, detail=e.data)
            
#     return db_response


# @router.post("/audio_one/")
# async def upload(
#     video_id: str,
# ):
#     pbman = PBManager()
#     pbman.set_collections('fingerprints', 'records')
#     recognizer = Recognizer(pbman)
#     try:
#         db_response = client.collection('videos').get_one(video_id)
#         url = client.get_file_url(db_response, db_response.video_file, {})
#         data = Dataset(
#             record_id=db_response.id,
#             filename=url,
#         )
#         await recognizer.upload_record(data)

#     except ClientResponseError as e:
#         api_logger.error(f"POST /video: {e.status} {e.data}")
#         raise HTTPException(status_code=e.status, detail=e.data)
            
#     return db_response


# @router.delete("/audio/")
# async def delete_all(
#    collection: Literal['fingerprints', 'records']
# ):
#     pbman = PBManager()
#     pbman.set_collections('fingerprints', 'records')
#     try:
#         result = await pbman.delete_all(collection)
#     except ClientResponseError as e:
#         api_logger.error(f"POST /video: {e.status} {e.data}")
#         raise HTTPException(status_code=e.status, detail=e.data)
            
#     return result

# @router.get("/audio/")
# def recognize_video(
#     video_id: str,
# ):
#     pbman = PBManager()
#     pbman.set_collections('fingerprints', 'records')
#     recognizer = Recognizer(pbman)
#     try:
#         db_response = client.collection('videos').get_one(video_id)
#         url = client.get_file_url(db_response, db_response.video_file, {})
#         with tempfile.NamedTemporaryFile(suffix='.mp4') as file:
#             file.write(requests.get(url).content)
#             file.seek(0)
#             with VideoFileClip(file.name) as clip:
#                 with tempfile.NamedTemporaryFile(suffix='.wav') as file:
#                     clip.audio.write_audiofile(file.name, fps=16000)
#                     file.seek(0)
#                     result = recognizer.recognize_file(file.name)
#     except ClientResponseError as e:
#         api_logger.error(f"GET /videos: {e.status} {e.data}")
#         raise HTTPException(status_code=e.status, detail=e.data)

#     return [
#         {
#             'record_id': str(vid['record_id']),
#             'offset': int(vid['offset']),
#             'offset_sec': float(vid['offset_sec']),
#             'confidence': float(vid['confidence'])
#         }
#         for vid in result
#     ]
