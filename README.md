# MoneyFlow 💸

> "Know where your money goes."

MoneyFlow is a personal and shared-money management platform built for friends, roommates, students, and small groups to track expenses, shared debts, settlements, and financial analytics.

## Tech Stack (Phase 1 Foundation)

- **Frontend**: React 18, Vite, Tailwind CSS, React Router v6, Axios
- **Backend**: Python 3.10+, Django 5.x, Django REST Framework, Simple JWT
- **Database**: PostgreSQL / SQLite (Development Fallback)

## Project Structure

```
MoneyFlow/
├── frontend/             # React + Vite application
├── backend/              # Django REST Framework backend
│   ├── config/           # Django project configuration
│   └── apps/             # Modular Django applications
│       ├── users/        # Custom User model & Auth endpoints
│       └── common/       # Shared utilities & helpers
├── .gitignore
├── README.md
└── .env.example
```

## Quick Start (Development)

### 1. Backend Setup

```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py runserver 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will run at `http://localhost:5173` and communicate with the backend at `http://127.0.0.1:8000/api/v1`.
