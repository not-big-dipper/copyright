from abc import ABC, abstractmethod
from typing import Iterable
from PIL.Image import Image


class BaseImageEmbedder(ABC):
    @abstractmethod
    def vectorize(self, *images: Image, batch_size: int) -> Iterable[list[float]]:
        pass