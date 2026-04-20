# RoomBuddy Backend

Django REST API for the RoomBuddy platform.

## Tech Stack

- **Python 3.11+**
- **Django 5.1** — Web framework
- **Django REST Framework** — API layer
- **drf-spectacular** — Swagger/OpenAPI documentation
- **Gunicorn** — Production WSGI server
- **WhiteNoise** — Static files in production

## Project Structure

```
backend/
├── config/                  # Django project configuration
│   ├── settings.py          # All settings
│   ├── urls.py              # Root URL routing + Swagger
│   └── wsgi.py              # WSGI entry point
├── core/                    # Core app (health check, utilities)
│   ├── api/
│   │   ├── views.py         # API views
│   │   └── serializers.py   # Response serializers
│   ├── models.py
│   └── urls.py              # Core URL routing
├── .env.example             # Environment variables template
├── build.sh                 # Render build script
├── manage.py
├── Procfile                 # Render start command
├── render.yaml              # Render deployment config
└── requirements.txt         # Python dependencies
```

## Local Development

```bash
cd backend
python3 -m venv venv
source venv/bin/activate      # Mac/Linux
pip install -r requirements.txt
python3 manage.py migrate
python3 manage.py runserver
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/hello/ | GET | Health check |
| /api/docs/ | GET | Swagger UI |
| /api/redoc/ | GET | ReDoc |
| /api/schema/ | GET | OpenAPI schema |
| /admin/ | GET | Django admin |

## Deploy to Render

1. Push to GitHub
2. Go to render.com → New Web Service
3. Connect your repo
4. Root Directory: `backend`
5. Build Command: `chmod +x build.sh && ./build.sh`
6. Start Command: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
7. Add env vars: DJANGO_SECRET_KEY, DJANGO_DEBUG=False, DJANGO_ALLOWED_HOSTS=.onrender.com
