FROM python:3.11-bookworm as system-build

RUN apt install make automake gcc g++ subversion

WORKDIR /app

RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY ./api /app/api

ENTRYPOINT ["uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8001"]

