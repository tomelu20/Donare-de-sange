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

Rulați `backend/setup.sql` în SQL Server Management Studio sau cu `sqlcmd`. Scriptul creează baza `donare` numai dacă aceasta nu există, creează tabelele lipsă și aplică migrările de schemă peste tabelele existente. Poate fi rulat din nou și nu șterge baza, tabele sau rânduri. Are nevoie de permisiuni SQL Server pentru crearea bazei de date atunci când aceasta nu există și pentru modificarea schemei.
După actualizarea aplicației, rulați din nou `backend/setup.sql` pentru a adăuga coloana de preferință pentru notificări la utilizatorii existenți; aceștia rămân dezabonați implicit.

Scriptul păstrează datele existente; dacă găsește stări de programare neașteptate, oprește migrarea și revine asupra modificărilor tranzacționale, în loc să le șteargă. Scripturile SQL mai vechi rămân în director ca referință, dar nu trebuie rulate ca parte a configurării standard: unele șterg date, recreează baza sau modifică utilizatori/date exemplu. `setup.sql` nu creează un cont administrator și nu adaugă campanii sau întrebări de eligibilitate implicite.

### 3. Configurați și porniți backend-ul

```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install fastapi "uvicorn[standard]" sqlalchemy pydantic-settings python-dotenv apscheduler slowapi google-genai google-auth python-jose passlib[bcrypt] "pydantic[email]" pyodbc
```

Creați `backend/.env` cu valorile locale corespunzătoare mediului dumneavoastră:

Porniți de la `backend/.env.example` și completați valorile locale. Configurația minimă de dezvoltare arată astfel:

```dotenv
ENV=development
DATABASE_URL=sqlalchemy-url-pentru-sql-server
SECRET_KEY=cheie-locala-de-inlocuit
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
CORS_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173
GEMINI_API_KEY=
EMAIL_USER=
EMAIL_PASSWORD=
GOOGLE_CLIENT_ID=
```

`DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `CORS_ORIGINS` și `GEMINI_API_KEY` sunt setările backend definite în `backend/config.py`. Configurați URL-ul SQLAlchemy și driverul ODBC conform instalării SQL Server. Datele SMTP sunt necesare pentru e-mailurile de verificare/reminder, iar cheia Gemini și clientul Google sunt necesare pentru funcționalitățile respective. `GOOGLE_CLIENT_ID` poate rămâne necompletat dacă autentificarea Google nu este folosită; butonul Google va fi ascuns. Nu folosiți valorile-placeholder de mai sus în producție și nu publicați chei sau parole.

Pentru producție, setați `ENV=production`, folosiți o cheie aleatoare de cel puțin 32 de octeți (de exemplu `py -c "import secrets; print(secrets.token_urlsafe(48))"`), configurați numai origini HTTPS explicite în `CORS_ORIGINS`, un `FRONTEND_URL` HTTPS și ambele credențiale SMTP. Backend-ul refuză pornirea dacă aceste condiții nu sunt îndeplinite. Frontend-ul trebuie construit cu `frontend/.env` configurat; păstrați frontend-ul și API-ul pe același site (de exemplu `www.exemplu.ro` și `api.exemplu.ro`) pentru ca cookie-ul de sesiune `SameSite=Lax` să funcționeze.

Autentificarea frontend-ului folosește cookie-ul `HttpOnly`; tokenul nu este păstrat în `sessionStorage`. Cererile care folosesc cookie-ul trebuie să provină dintr-o origine aprobată. În producție, terminați HTTPS la un reverse proxy și rulați un singur worker API, deoarece scheduler-ul și limitatoarele actuale sunt locale procesului.

Rulați API-ul din directorul `backend` în dezvoltare:

```powershell
uvicorn main:app --reload
```

În producție, porniți fără `--reload` (de exemplu `uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1`) și expuneți serviciul numai prin reverse proxy HTTPS.

API-ul este disponibil implicit la `http://127.0.0.1:8000`; documentația interactivă Swagger este la `http://127.0.0.1:8000/docs` numai în dezvoltare.

### 4. Instalați și porniți frontend-ul

Într-un terminal nou, copiați `frontend/.env.example` în `frontend/.env`, configurați adresa API și, dacă folosiți Google OAuth, client ID-ul Google. Apoi, din rădăcina proiectului:

```powershell
cd frontend
npm install
```

Frontend-ul folosește `VITE_API_URL` ca adresă API; în dezvoltare valoarea implicită este `http://localhost:8000`. Orice modificare de variabile Vite necesită rebuild/restart.

Porniți serverul de dezvoltare:

```powershell
npm run dev
```

Deschideți adresa indicată de Vite (implicit `http://localhost:5173`). Pentru un build de producție sau verificarea regulilor Oxlint:

```powershell
# Asigurați-vă că frontend/.env conține VITE_API_URL=https://adresa-api
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
- Folosiți `backend/setup.sql` pentru schema unificată. Fișierele SQL vechi sunt păstrate separat și pot conține operații distructive ori date exemplu.

## Documentație suplimentară

- [Documentație arhitecturală](ARCHITECTURE.md)
- [Sursa backend-ului](backend/)
- [Sursa frontend-ului](frontend/)
