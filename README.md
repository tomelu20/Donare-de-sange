# Platformă pentru donarea de sânge

Aplicație web pentru organizarea campaniilor de donare, gestionarea programărilor și comunicarea dintre donatori și administratori. Proiectul include o interfață React, un API FastAPI și o bază de date Microsoft SQL Server.

## Funcționalități

- Înregistrare și autentificare cu verificarea adresei de e-mail; autentificare Google este disponibilă în interfață.
- Listarea campaniilor și rezervarea unui interval disponibil, inclusiv înscrierea unei alte persoane.
- Chestionar de eligibilitate configurabil, prezentat în fluxul de programare.
- Listă de așteptare cu interval preferat și timp estimat de deplasare; administratorii pot gestiona ofertele.
- Panou administrativ pentru campanii, programări, participanți, întrebări de eligibilitate și notificări.
- Actualizarea profilului și consultarea istoricului relevant pentru donator.
- Asistentul Don AI, bazat pe Google Gemini, pentru întrebări despre donare și campaniile active.
- Notificări prin e-mail și sarcină periodică pentru expirarea ofertelor din lista de așteptare.

## Tehnologii

| Componentă | Tehnologii |
| --- | --- |
| Frontend | React 19, Vite, React Router, Axios, Lucide, React Markdown |
| Backend | Python, FastAPI, SQLAlchemy, Pydantic Settings |
| Bază de date | Microsoft SQL Server |
| Servicii opționale | Google Gemini, Google OAuth, SMTP/Gmail |

## Structura proiectului

```text
.
├── backend/
│   ├── main.py                 # Aplicația FastAPI și configurarea routerelor
│   ├── config.py               # Setările backend-ului
│   ├── database.py             # Conexiunea SQLAlchemy
│   ├── models.py               # Modelele bazei de date
│   ├── routers/                # Autentificare, campanii, programări etc.
│   ├── schemas/                # Schemele API/Pydantic
│   ├── tables.sql              # Script de inițializare a bazei de date
│   └── *.sql                   # Scripturi SQL pentru modificări și date
├── frontend/
│   ├── src/                    # Componentele și paginile React
│   ├── package.json
│   └── vite.config.js
├── ARCHITECTURE.md             # Note arhitecturale existente
└── README.md
```

## Cerințe

- Git
- Node.js și npm (versiune compatibilă cu Vite 8; Node.js 20.19+ sau 22.12+)
- Python 3.10+
- Microsoft SQL Server și un driver ODBC compatibil instalat pe sistem
- Opțional: cont/API key Google Gemini, credențiale SMTP/Gmail și configurarea clientului Google OAuth

## Instalare și rulare locală

### 1. Obțineți proiectul

```bash
git clone https://github.com/tomelu20/Donare-de-sange.git
cd Donare-de-sange
```

### 2. Pregătiți baza de date

Creați/configurați o bază Microsoft SQL Server și aplicați schema necesară din scripturile `backend/*.sql`. `backend/tables.sql` șterge și recreează baza de date `donare`; rulați-l numai într-un mediu local/de test și verificați conținutul înainte de utilizare. Scripturile de modificare a schemei trebuie aplicate în ordinea potrivită bazei de date existente.

### 3. Configurați și porniți backend-ul

```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install fastapi "uvicorn[standard]" sqlalchemy pydantic-settings python-dotenv apscheduler slowapi google-genai google-auth python-jose passlib[bcrypt] "pydantic[email]" pyodbc
```

Creați `backend/.env` cu valorile locale corespunzătoare mediului dumneavoastră:

```dotenv
DATABASE_URL=sqlalchemy-url-pentru-sql-server
SECRET_KEY=generati-o-cheie-lunga-si-aleatoare
ALGORITHM=HS256
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
GEMINI_API_KEY=
EMAIL_USER=
EMAIL_PASSWORD=
GOOGLE_CLIENT_ID=
```

`DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `CORS_ORIGINS` și `GEMINI_API_KEY` sunt setările backend definite în `backend/config.py`. Configurați URL-ul SQLAlchemy și driverul ODBC conform instalării SQL Server. Datele SMTP sunt necesare pentru e-mailurile de verificare/reminder, iar cheia Gemini și clientul Google sunt necesare pentru funcționalitățile respective. Nu folosiți valorile-placeholder de mai sus în producție și nu publicați chei sau parole.

Rulați API-ul din directorul `backend`:

```powershell
uvicorn main:app --reload
```

API-ul este disponibil implicit la `http://127.0.0.1:8000`; documentația interactivă Swagger este la `http://127.0.0.1:8000/docs`.

### 4. Instalați și porniți frontend-ul

Într-un terminal nou, din rădăcina proiectului:

```powershell
cd frontend
npm install
```

Frontend-ul folosește implicit `http://127.0.0.1:8000` ca adresă API. Pentru o adresă diferită, creați `frontend/.env.local`:

```dotenv
VITE_API_URL=http://127.0.0.1:8000
```

Porniți serverul de dezvoltare:

```powershell
npm run dev
```

Deschideți adresa indicată de Vite (implicit `http://localhost:5173`). Pentru un build de producție sau verificarea regulilor Oxlint:

```powershell
npm run build
npm run lint
```

## Utilizarea aplicației

**Donatori:** creați un cont sau autentificați-vă, selectați o campanie, completați chestionarul și alegeți un slot disponibil. Dacă nu sunt locuri, vă puteți înscrie pe lista de așteptare. Din dashboard puteți gestiona programările și profilul.

**Administratori:** conturile cu rol `admin` au acces la administrarea campaniilor, programărilor și listei de așteptare, configurarea întrebărilor de eligibilitate și trimiterea reminderelor.

**Don AI:** asistentul poate răspunde la întrebări generale și poate consulta campaniile active. Răspunsurile sale nu înlocuiesc evaluarea personalului medical sau criteriile oficiale de eligibilitate.

## Note pentru dezvoltare

- Configurația API frontend este `VITE_API_URL`; schimbările acesteia necesită repornirea serverului Vite.
- Backend-ul citește setările din variabilele de mediu și din `backend/.env`.
- API-ul folosește CORS; includeți origin-ul frontend-ului în `CORS_ORIGINS`.
- Backend-ul pornește un job de fundal care verifică periodic ofertele expirate de pe lista de așteptare.
- În acest moment proiectul nu include un fișier backend `requirements.txt`; comenzile de instalare de mai sus instalează pachetele importate de backend.
- Fișierele SQL din `backend` includ scripturi de schemă, actualizări și seed-uri. Revizuiți-le înainte de rulare, în special pe baze de date cu date existente.

## Documentație suplimentară

- [Documentație arhitecturală](ARCHITECTURE.md)
- [Sursa backend-ului](backend/)
- [Sursa frontend-ului](frontend/)
