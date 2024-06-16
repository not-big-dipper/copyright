from celery import Celery

celery_app = Celery('main', broker='redis://redis:6379/')