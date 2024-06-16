import os
import uuid

from malevich import flow, collection, table, Core
from malevich.process import probe_video, index_video
from malevich.models.task.interpreted.core import CoreTask, PrepareStages
from malevich.core_api import base_settings

from malevich.core_api import (
    update_core_credentials, 
    set_host_port,
)

update_core_credentials(os.getenv('MALEVICH_CORE_API_USERNAME'), os.getenv('MALEVICH_CORE_API_SECRET'))
set_host_port(os.getenv('MALEVICH_CORE_API_HOST'))

qdrant_host = os.getenv('QDRANT_HOST')
qdrant_port = os.getenv('QDRANT_PORT')
qdrant_api_key = os.getenv('QDRANT__SERVICE__API_KEY')

@flow(reverse_id='video_probing')
def process_video():
    video = collection(
        'video_probing_links',
        alias='vct',
        persistent=False
    )
    
    return probe_video(
        video, 
        alias='proc',
        qdrant_host=qdrant_host,
        qdrant_port=qdrant_port,
        qdrant_api_key=qdrant_api_key,
        batch_size=1500,
        vit_model_path='facebook/dinov2-large'
    )

@flow(reverse_id='video_indexing')
def index_video_flow():
    video = collection(
        'video_indexing_links',
        alias='vct',
        persistent=False
    )
    
    return index_video(
        video, 
        alias='proc',
        qdrant_host=qdrant_host,
        qdrant_port=qdrant_port,
        qdrant_api_key=qdrant_api_key,
        vit_model_path='facebook/dinov2-large'
    )


class VideoFlow:
    def new_probe_task(self):
        # if not os.path.exists('/malevich/probe'):
        #     os.makedirs('/malevich', exist_ok=True)
        task_ = Core(
            process_video,
            core_host=os.getenv('MALEVICH_CORE_API_HOST'),
            user=os.getenv('MALEVICH_CORE_API_USERNAME'),
            access_key=os.getenv('MALEVICH_CORE_API_SECRET')
        )
        task_.configure('proc', platform_settings=base_settings(memory_request=20000, memory_limit=80000))
            # with open('/malevich/probe', 'wb') as f:
            #     f.write(task_.dump())
        # task_ = CoreTask.load(open('/malevich/probe', 'rb').read())
        return task_
        
    def new_index_task(self):
        task_ = Core(
            index_video_flow,
            core_host=os.getenv('MALEVICH_CORE_API_HOST'),
            user=os.getenv('MALEVICH_CORE_API_USERNAME'),
            access_key=os.getenv('MALEVICH_CORE_API_SECRET')
        )
        # if not os.path.exists('/malevich/index'):
        #     os.makedirs('/malevich', exist_ok=True)
        task_.configure('proc', platform_settings=base_settings(memory_request=20000, memory_limit=80000))
            # with open('/malevich/index', 'wb') as f:
            #     f.write(task_.dump())
        # task_ = CoreTask.load(open('/malevich/index', 'rb').read())
        return task_

    def __init__(self) -> None:
        self._endpoint = None
        self.probe_task = self.new_probe_task()
        self.index_task = self.new_index_task()
        
    def probe(self, video_link: str) -> table:
        if self.probe_task.get_stage() != self.probe_task.get_stage_class().ONLINE:
            try:
                self.probe_task.stop()
            except:
                pass
            
            self.probe_task = self.new_probe_task()
            if self.probe_task.get_stage() == self.probe_task.get_stage_class().BUILT:
                self.probe_task.prepare(stage=PrepareStages.BOOT)
            else: 
                self.probe_task.prepare()
            
        run_id = uuid.uuid4().hex
        self.probe_task.run(
            run_id=run_id,
            with_logs=True,
            override={'vct': table([video_link], columns=['link'])}
        )
        return self.probe_task.results(run_id)[0].get_df()
    
    def index(self, video_link: str, video_name: str) -> table:
        if self.index_task.get_stage() != self.index_task.get_stage_class().ONLINE:
            try:
                self.index_task.stop()
            except:
                pass
            
            self.index_task = self.new_index_task()
            if self.index_task.get_stage() == self.index_task.get_stage_class().BUILT:
                self.index_task.prepare(stage=PrepareStages.BOOT)
            else:
                self.index_task.prepare()
            
        run_id = uuid.uuid4().hex
        self.index_task.run(
            run_id=run_id,
            with_logs=True,
            override={'vct': table([[video_link, video_name]], columns=['link', 'video_name'])}
        )
        return self.index_task.results(run_id)[0].get_df()
                    
video_flow = VideoFlow()