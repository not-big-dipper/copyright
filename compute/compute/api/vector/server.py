import tempfile
import uuid
import cv2
import os
import pandas as pd
from qdrant_client import QdrantClient, models
import requests
from .vit import VitImageEmbedder
from PIL import Image
import torch
from fastapi import FastAPI
from pydantic import BaseModel

BOX = tuple[float, float, float, float]
MODEL = os.getenv('VMODEL', 'facebook/dinov2-large')
VIOLATION_IMAGE_SIMILARITY_THRESHOLD = 0.88

vit = VitImageEmbedder(
    MODEL,
    device=('cuda' if torch.cuda.is_available() else 'cpu')
)

compute = FastAPI()

def naive_clusters(labels, max_width=100) -> list[tuple]:
    """
    Naively iterates over the 1D array yielding groups
    of elements where gap between each element is less than max_width
    """
    clusters = []
    current_cluster = []
    for i, label in enumerate(labels):
        if len(current_cluster) == 0:
            current_cluster.append(label)
        elif label - current_cluster[-1] <= max_width:
            current_cluster.append(label)
        else:
            clusters.append(current_cluster)
            current_cluster = [label]
    clusters.append(current_cluster)
    
    spans = [(cluster[0], cluster[-1]) for cluster in clusters]
    return spans


def has_violations(df: pd.DataFrame, thresh = VIOLATION_IMAGE_SIMILARITY_THRESHOLD) -> bool:
    """Checks on any violations"""
    return (df.score > thresh).any()

def get_violations(df: pd.DataFrame, thresh = VIOLATION_IMAGE_SIMILARITY_THRESHOLD) -> pd.DataFrame:
    """"""
    df = df[df.score > thresh]
    f_ = df.frame.unique()
    f_.sort()
    if f_.shape[0] < 2:
        return []
    frame_lag = f_[1] - f_[0]
    spans = naive_clusters(f_, frame_lag * 50)
    return [sp for sp in spans if sp[1] - sp[0] >= frame_lag * 10]


def get_patches(image : Image.Image, grid_size: int) -> list[tuple[BOX, Image.Image]]:
    width, height = image.size
    patch_width = width // grid_size
    patch_height = height // grid_size
    
    patches = []
    for i in range(grid_size):
        for j in range(grid_size):
            left = i * patch_width
            upper = j * patch_height
            right = left + patch_width
            lower = upper + patch_height
            patch = image.crop((left, upper, right, lower))
            patches.append(((left / width, upper / height, right / width, lower / height), patch))
                        
    return patches


def get_overlay_patches(image: Image.Image, grid_size: int, cpr: float) -> list[tuple[BOX, Image.Image]]:
    width, height = image.size
    patch_width = width // grid_size
    patch_height = height // grid_size
    
    patches = []
    i, j = 0, 0
    while i + patch_width * .5 <= width:
        while j + patch_height * .5 <= height:
            left = i
            upper = j
            right = left + patch_width 
            lower = upper + patch_height
            patch = image.crop((left, upper, right, lower))
            patches.append(((left / width, upper / height, right / width, lower / height), patch))
            j += int(patch_height * cpr)
        i += int(patch_width * cpr)
        j = 0
        
    return patches


def _process_one_video(path: str, emb: VitImageEmbedder, qdrant: QdrantClient, batch_size: int = 1000):
    cap = cv2.VideoCapture(path)
    df = []

    frame_idx = 0
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    batch_images = []
    batch_point_data = []
    batch_frames_idxs = []
    
    while True:
        frame_idx += 1
        
        ret, frame = cap.read()
        if not ret:
            break
        
        if frame_idx % fps != 0 and not frame_idx == total_frames:
            continue

        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(frame)
        
        
        patches_2 = [
            (i, 2, 1, x) for i, x in enumerate(get_patches(pil_image, 2))
        ]
        # patches_3 = [
        #     (i, 3, 1, x) for i, x in enumerate(get_patches(pil_image, 3))
        # ]
        # overlay_patches_2 = [
        #     (i, 2, .5, x) for i, x in enumerate(get_overlay_patches(pil_image, 2, .5))
        # ]
        
        # overlay_patches_3 = [
        #     (i, 3, .5, x) for i, x in enumerate(get_overlay_patches(pil_image, 3, .5))
        # ]
        
        all_patches = sum(
            [
                patches_2,
                # patches_3,
                # overlay_patches_2,
                # overlay_patches_3
            ], []
        )
        
        images = [
            patch[1] for *_, patch in all_patches
        ] + [pil_image]
        
        patch_labels = [
            (patch_idx, grid_size, cpr)
            for patch_idx, grid_size, cpr, _ in all_patches
        ] + [(-1, 1, 1)]
        
        batch_images.extend(images)
        batch_point_data.extend(patch_labels)
        batch_frames_idxs.extend([frame_idx] * len(images))
        
        if len(batch_images) > batch_size or frame_idx == total_frames:
            vectors = [*emb.vectorize(*batch_images, batch_size=batch_size)]
            results = qdrant.search_batch('dev__experiment', [
                models.SearchRequest(
                    vector=vec,
                    limit=5,
                    with_payload=True,
                ) for vec in vectors
            ])
            
            for (patch_idx, grid_size, cpr), fid, r in zip(batch_point_data, batch_frames_idxs, results):
                for res in r:
                    df.append({
                        'frame': fid,
                        'patch': grid_size,
                        'patch_cpr': cpr,
                        'patch_idx': patch_idx,
                        'score': res.score,
                        'video_name': res.payload['video_name'],
                        'video_second': res.payload['second']
                    })
                    
            batch_images = []
            batch_point_data = []
            batch_frames_idxs = []
                        
    return pd.DataFrame(df)



class ModerateBody(BaseModel):
    video_link: str
    qdrant_host: str
    qdrant_api_key: str
    qdrant_port: int
    batch_size: int = 1000
    threshold: float = VIOLATION_IMAGE_SIMILARITY_THRESHOLD


@compute.post('/moderate')
def moderate(body: ModerateBody):
    video = requests.get(body.video_link).content
    
    with tempfile.NamedTemporaryFile(suffix='.mp4') as f:
        f.write(video)
        f.seek(0)
        qdrant = QdrantClient(
            body.qdrant_host,
            api_key=body.qdrant_api_key,
            port=body.qdrant_port
        )
        df = _process_one_video(f.name, vit, qdrant, batch_size=body.batch_size)
        df.insert(0, 'video_id', 0)
        
    df = df.loc[df.groupby('frame').score.idxmax()]
    violations = []      
    for key, d in df.groupby('video_name'):
        if has_violations(d, body.threshold):
            for start, end in get_violations(d, body.threshold):
                violations.append({
                    'start': int(start),
                    'end': int(end),
                    'video_name': str(key),
                    'max_score': float(d[(d.frame >= start) & (d.frame <= end)].score.max()),
                    'min_score': float(d[(d.frame >= start) & (d.frame <= end)].score.min()),
                    'avg_score': float(d[(d.frame >= start) & (d.frame <= end)].score.mean()),
                    'std_score': float(d[(d.frame >= start) & (d.frame <= end)].score.std()),
                })

    return violations


class IndexBody(BaseModel):
    video_id: int
    video_name: str
    video_link: str
    qdrant_host: str
    qdrant_api_key: str
    qdrant_port: int
    

@compute.post('/index')
def index_video(body: IndexBody):
    video = requests.get(body.video_link).content
    qdrant = QdrantClient(
        body.qdrant_host,
        api_key=body.qdrant_api_key,
        port=body.qdrant_port
    )
    
    with tempfile.NamedTemporaryFile(suffix='.mp4') as f:
        f.write(video)
        f.seek(0)
        video = cv2.VideoCapture(f.name)
        df = []
        frame_id = 0
        fps = video.get(cv2.CAP_PROP_FPS)
        
        frame_id = 0
        frame_number = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
        
        each = int(fps)

        batch_frames = []
        batch_frames_idxs = []
                
        while True:
            ret, frame = video.read()
            if not ret:
                break
            
            if frame_id % each == 0:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frame = Image.fromarray(frame)
                batch_frames.append(frame)
                batch_frames_idxs.append(frame_id)

            if len(batch_frames) > 32 or frame_id == frame_number - 1:
                points: list[models.PointStruct] = []
                for i, fr, vector in zip(batch_frames_idxs, batch_frames, vit.vectorize(*batch_frames, batch_size=8)):
                    points.append(
                        models.PointStruct(
                            id=uuid.uuid4().hex,
                            vector=vector,
                            payload={
                                "video_id": body.video_id,
                                "frame": i,
                                "second": i / fps,
                                "width": fr.width,
                                "height": fr.height,
                                "video_name": body.video_name,
                            }
                        )
                    )
            
                qdrant.upsert("dev__experiment", points=points)
                for point in points:
                    df.append({
                            "frame": int(point.payload["frame"]),
                            "second": float(point.payload["second"]),
                            "video_id": int(body.video_id),
                            "qdrant_point_id": str(point.id),
                            "width": int(point.payload["width"]),
                            "height": int(point.payload["height"])
                        }
                    )

                del batch_frames
                del batch_frames_idxs
                batch_frames = []
                batch_frames_idxs = []
                
            frame_id += 1
    
    return pd.DataFrame(df).to_dict(orient='records')

        
    
    