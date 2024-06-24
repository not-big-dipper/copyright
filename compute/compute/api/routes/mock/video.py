import random
from fastapi import APIRouter

from ...xpocketbase import client
from ..models.video import VideoWithViolations, Violation

router = APIRouter(tags=["Mock Operations"])


@router.get("/video_probes/")
async def video_probes(
    video_id: str,
) -> VideoWithViolations:
    random_video = client.collection('videos').get_list().items
    random_video = random.choice(random_video)
    
   
    return {
        "video": client.collection('videos').get_one(video_id),
        "violations": [
            Violation(
                start=random.randint(0, 100),
                end=random.randint(101, 200),
                source_video=random_video,
                original_start=random.randint(0, 100),
                original_end=random.randint(101, 200),
                max_score=0.9,
                min_score=0.8,
                avg_score=0.85,
                std_score=0.05
            )
        ]
    }