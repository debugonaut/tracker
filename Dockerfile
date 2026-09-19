FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    TZ="Asia/Kolkata"

WORKDIR /app

# Install runtime and build dependencies for lxml and timezone
RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata \
    libxml2 \
    libxslt1.1 \
    gcc \
    libxml2-dev \
    libxslt1-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y gcc libxml2-dev libxslt1-dev \
    && apt-get autoremove -y

# Copy application source
COPY . .

# Cloud Run defaults to port 8080
EXPOSE 8080

CMD ["python", "server.py"]
