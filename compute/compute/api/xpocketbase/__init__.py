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
            "name": "moderation_sessions",
            "type": "base",
            "schema": [
                {
                    "name": "name",
                    "type": "text",
                }
            ]
        }
    )
    except ClientResponseError as e:
        uv_logger.error(f"Failed to create `moderation_sessions`: {e.status} {e.data}")

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
                        "values": ["index", "valid", "test"]
                    }
                },
                {
                    "name": "checked",
                    "type": "bool",
                },
                {
                    "name": "audio_indexed",
                    "type": "bool",
                },
                {
                    "name": "video_indexed",
                    "type": "bool",
                },
                {
                    "name": "fps",
                    "type": "number",
                },
                {
                    "name": "moderation_session",
                    "type": "relation",
                    "options": {
                        "collectionId": client.collections.get_one("moderation_sessions").id,
                        "maxSelect": 1
                    }
                }
            ]
        }
    )
    except ClientResponseError as e:
        uv_logger.error(f"Failed to create `videos`: {e.status} {e.data}")

    video_id = client.collections.get_one("videos").id
        
    try:
        client.collections.create(body_params={
            "name": "violations",
            "type": "base",
            "schema": [
                {
                    "name": "source_video_id",
                    "type": "relation",
                    "options": {
                        "collectionId": video_id,
                        "maxSelect": 1
                    }
                },
                {
                    "name": "violation_video_id",
                    "type": "relation",
                    "options": {
                        "collectionId": video_id,
                        "maxSelect": 1
                    }
                },
                {
                    "name": "moderation_session",
                    "type": "relation",
                    "options": {
                        "collectionId": client.collections.get_one("moderation_sessions").id,
                        "maxSelect": 1
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
                    "name": "original_start",
                    "type": "number",
                },
                {
                    "name": "original_end",
                    "type": "number",
                },
                {
                    "name": "max_score",
                    "type": "number",
                },
                {
                    "name": "min_score",
                    "type": "number",
                },
                {
                    "name": "avg_score",
                    "type": "number",
                },
                {
                    "name": "std_score",
                    "type": "number",
                },
                {
                    "name": "marked_hard",
                    "type": "bool",
                },
                {
                    "name": "discarded",
                    "type": "bool",
                }
                
            ]
        }
    )
    except ClientResponseError as e:
        uv_logger.error(f"Failed to create `video_probs`: {e.status} {e.data}")
        
except Exception:
    warnings.warn("Could not initialize the Pocketbase client")

__all__ = ["client"]