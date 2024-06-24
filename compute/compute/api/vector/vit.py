from typing import Iterable
import warnings
import torch

from PIL import Image

from .base import BaseImageEmbedder
from transformers import AutoModel, AutoProcessor

class VitImageEmbedder(BaseImageEmbedder):
    def __init__(self, model_name: str, device: str = 'cpu'):
        if device == 'cuda' and not torch.cuda.is_available():
            device = 'cpu'
            warnings.warn('CUDA is not available, switching to CPU.')
            
        self.device = device
        self.processor = AutoProcessor.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name).to(device)
        
        
    
    def vectorize(self, *images: Image.Image, batch_size: int) -> Iterable[list[float]]:                 
        with torch.no_grad():
            current_batch = []
            for image in images:
                inputs = self.processor(images=image, return_tensors='pt')
                current_batch.append(inputs)
                if len(current_batch) == batch_size:
                    batch_inputs = {
                        key: torch.cat([value[key] for value in current_batch], dim=0).to(self.device)
                        for key in current_batch[0].keys()
                    }
                    outputs = self.model(**batch_inputs)
                    embeddings = outputs.last_hidden_state[:, 0, :].cpu().tolist()
                    for embedding in embeddings:
                        yield embedding
                    
                    del embeddings
                    del outputs
                    del batch_inputs
                    
                    torch.cuda.empty_cache()
                    current_batch = []

            if current_batch:
                batch_inputs = {
                    key: torch.cat([value[key] for value in current_batch], dim=0).to(self.device)
                    for key in current_batch[0].keys()
                }
                outputs = self.model(**batch_inputs)
                embeddings = outputs.last_hidden_state[:, 0, :].cpu().tolist()
                for embedding in embeddings:
                    yield embedding


                del embeddings
                del outputs
                del batch_inputs
                
                torch.cuda.empty_cache()
                
                