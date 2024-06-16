import logging
import os
import datetime

from pathlib import Path

current_time = datetime.datetime.now()

# /var/copyright-backend
default_log_folder = os.getenv('LOG_FOLDER', '/var/log/copyright-api')

try:
    os.makedirs(default_log_folder, exist_ok=True)
except Exception as e:
    try:
        os.makedirs('/var/log/copyright-api', exist_ok=True)
        
        default_log_folder = '/var/log/copyright-api'
        Path(default_log_folder).chmod(0o777)
    except Exception as e:
        default_log_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'logs'))
        os.makedirs(default_log_folder, exist_ok=True)
        import warnings
        warnings.warn(f"Could not create log folder at {default_log_folder}. Using {default_log_folder} instead.")
            
    
log_file = os.path.join(default_log_folder, f"compute-api-{current_time.strftime('%Y-%m-%d')}.log")

logger = logging.getLogger('api')
logger.setLevel(logging.INFO)
logger.propagate = False

formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler = logging.FileHandler(log_file)

handler.setFormatter(formatter)

logger.addHandler(handler)

__all__ = ['logger']