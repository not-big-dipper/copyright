import tempfile
import uuid
import cv2
from malevich.square import Context, processor, init
import pandas as pd
from qdrant_client import QdrantClient, models
import requests
from ..vector.vit import VitImageEmbedder
from PIL import Image

BOX = tuple[float, float, float, float]

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


class _o(object):
    pass

@init(prepare=True)
def init_model(context: Context):
    context.common = _o()
    setattr(
        context.common,
        'vit',
        VitImageEmbedder(
            context.app_cfg['vit_model_path'],
            device='cuda'
        )
    )
    

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

@processor()
def probe_video(video_links, context: Context):
    videos = [
        requests.get(video_link).content
        for video_link in video_links.link.to_list()
    ]
    batch_size = context.app_cfg.get('batch_size', 1000)
    
    qdrant = QdrantClient(
        context.app_cfg['qdrant_host'],
        api_key=context.app_cfg['qdrant_api_key'],
        port=context.app_cfg['qdrant_port']
    )

    df_cat = []
    for video_id, video in enumerate(videos):
        with tempfile.NamedTemporaryFile(suffix='.mp4') as f:
            f.write(video)
            f.seek(0)
            df = _process_one_video(f.name, context.common.vit, qdrant, batch_size=batch_size)
            df.insert(0, 'video_id', video_id)
            df_cat.append(df)
            
    return_df = pd.concat(df_cat)
    # Take row with maximum score for each frame
    return_df = return_df.loc[return_df.groupby('frame').score.idxmax()]
    return return_df[return_df.score > 0.55]

@processor()
def index_video(video_links, context: Context):
    videos = [
        (row.video_name, requests.get(row.link).content,)
        for _, row in video_links.iterrows()
    ]
    qdrant = QdrantClient(
        context.app_cfg['qdrant_host'],
        api_key=context.app_cfg['qdrant_api_key'],
        port=context.app_cfg['qdrant_port']
    )

    for video_id, (video_name, video_bytes) in enumerate(videos):
        with tempfile.NamedTemporaryFile(suffix='.mp4') as f:
            f.write(video_bytes)
            f.seek(0)
            embedder = context.common.vit
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
                    for i, frame, vector in zip(batch_frames_idxs, batch_frames, embedder.vectorize(*batch_frames, batch_size=8)):
                        points.append(
                            models.PointStruct(
                                id=uuid.uuid4().hex,
                                vector=vector,
                                payload={
                                    "video_id": video_id,
                                    "frame": i,
                                    "second": i / fps,
                                    "width": frame.width,
                                    "height": frame.height,
                                    "video_name": video_name,
                                }
                            )
                        )
                
                    qdrant.upsert("dev__experiment", points=points)
                    for point in points:
                        df.append({
                                "frame": point.payload["frame"],
                                "second": point.payload["second"],
                                "video_id": video_id,
                                "qdrant_point_id": point.id,
                                "width": point.payload["width"],
                                "height": point.payload["height"]
                            }
                        )

                    del batch_frames
                    del batch_frames_idxs
                    batch_frames = []
                    batch_frames_idxs = []
                    
                frame_id += 1

    return pd.DataFrame(df)
        
    
    