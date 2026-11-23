FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

RUN pip install --no-cache-dir 'markitdown[pdf,docx,pptx,xlsx,xls]==0.1.7' \
    fastapi uvicorn python-multipart

COPY app.py index.html ./

RUN useradd --create-home conversor
USER conversor

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
