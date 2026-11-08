FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY create_tables.py .

EXPOSE 8000

CMD ["sh", "-c", "python create_tables.py && exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"]
