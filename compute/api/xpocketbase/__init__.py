import warnings
from pocketbase import Client
from pocketbase.utils import ClientResponseError
import os
import logging

database_url = os.environ.get("DATABASE_URL")
database_user = os.environ.get("DATABASE_USER")
database_password = os.environ.get("DATABASE_PASSWORD")
true = True
uv_logger = logging.getLogger("uvicorn")
client = Client(database_url)
try:
    try:
        client.admins.auth_with_password(database_user, database_password)
    except ClientResponseError as e:
        print(f"Failed to authenticate with database: {e.status} {e.data}")
        raise e

    try:
        client.collections.create(body_params={
            "name": "videos",
            "type": "base",
            "schema": [
                {
                    "name": "video_file",
                    "type": "file",
                    "required": True,
                    "options": {
                        "maxSize": 10000000000,
                        "maxSelect": 1
                    }
                },
                {
                    "name": "thumbnail_file",
                    "type": "file",
                    "required": True,
                    "options": {
                        "maxSize": 10000000000,
                        "maxSelect": 1
                    }
                },
                {
                    "name": "title",
                    "type": "text",
                    "required": True
                },
                {
                    "name": "description",
                    "type": "text",
                    "required": True
                },
                {
                    "name": "group",
                    "type": "select",
                    "options":{
                        "maxSelect": 1,
                        "values": ["index", "test"]
                    }
                },
                {
                    "name": "fps",
                    "type": "number",
                }
            ]
        }
    )
    except ClientResponseError as e:
        uv_logger.error(f"Failed to create `videos`: {e.status} {e.data}")

    video_id = client.collections.get_one("videos").id

    try:
        client.collections.create(body_params={
            "name": "video_embs",
            "type": "base",
            "schema": [
                {
                    "name": "frame",
                    "type": "number",
                },
                {
                    "name": "second",
                    "type": "number",
                },
                {
                    "name": "video_id",
                    "type": "relation",
                    "options": {
                        "collectionId": video_id
                    }
                },
                {
                    "name": "width",
                    "type": "number",
                },
                {
                    "name": "height",
                    "type": "number",
                },
                {
                    "name": "qdrant_point_id",
                    "type": "text",
                }   
            ]
        }
    )
    except ClientResponseError as e:
        uv_logger.error(f"Failed to create `video_embs`: {e.status} {e.data}")
        
    try:
        client.collections.create(body_params={
            "name": "video_probs",
            "type": "base",
            "schema": [
                {
                    "name": "video_id",
                    "type": "relation",
                    "options": {
                        "collectionId": video_id
                    }
                },
                {
                    "name": "start",
                    "type": "number",
                },
                {
                    "name": "end",
                    "type": "number",
                },
                {
                    "name": "originStart",
                    "type": "number",
                },
                {
                    "name": "originEnd",
                    "type": "number",
                }   
            ]
        }
    )
    except ClientResponseError as e:
        uv_logger.error(f"Failed to create `video_probs`: {e.status} {e.data}")
        
    try:
        client.collections.create(body_params={
            "name": "fingerprints",
            "type": "base",
            "schema": [
                {
                    "name": "hash",
                    "type": "text",
                    "unique": True,
                    "required": True
                },
                {
                    "name": "record_id",
                    "type": "text",
                    "unique": True,
                    "required": True
                },
                {
                    "name": "offset",
                    "type": "number",
                    "unique": True,
                    "required": True
                }
            ]
        }
    )
    except ClientResponseError as e:
        uv_logger.error(f"Failed to create `fingerprints`: {e.status} {e.data}")
        
except Exception:
    warnings.warn("Could not initialize the Pocketbase client")

__all__ = ["client"]