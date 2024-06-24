from fastapi.responses import StreamingResponse
from io import BytesIO
import pandas as pd
from fastapi import APIRouter
from ..xpocketbase import client
from .video import get_videos_with_violations
router = APIRouter(tags=["Moderation Operations"])

@router.post("/new_moderation_session/")
async def new_moderation_session():
    return client.collection('moderation_sessions').create({})


@router.get("/moderation_sessions/")
async def get_moderation_sessions():
    return client.collection('moderation_sessions').get_full_list()


@router.get("/csv_report/", response_class=StreamingResponse)
async def get_csv_report(moderation_session_id: str):
    video_with_violations = await get_videos_with_violations(moderation_session_id)
    
    data_ = {
        'Piracy_ID': [],
        'Piracy_Segment': [],
        'License_ID': [],
        'License_Segment': [],
    }
    
    for vv in video_with_violations:
        for violation in vv.violations:
            data_['Piracy_ID'].append(violation.violation_video.title)
            data_['Piracy_Segment'].append(f"{violation.start}-{violation.end}")
            data_['License_ID'].append(violation.source_video.title)
            data_['License_Segment'].append(f"{violation.original_start}-{violation.original_end}")
            

    buffer = BytesIO()
    df = pd.DataFrame(data_)
    df.to_csv(buffer, index=False)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=report_{moderation_session_id}.csv"})