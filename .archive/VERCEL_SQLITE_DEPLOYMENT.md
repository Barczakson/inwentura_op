# Instrukcje Deployment na Vercel - SQLite

## ✅ Przygotowanie aplikacji (GOTOWE)
Aplikacja została już przystosowana do SQLite. Następujące zmiany zostały wprowadzone:

- ✅ Prisma schema przełączona na SQLite
- ✅ Pola JSON zmienione na String (SQLite compatibility)
- ✅ .env skonfigurowana dla SQLite
- ✅ vercel.json zaktualizowana z build commands
- ✅ Lokalne testy przeszły pomyślnie

## 🚀 Kroki do deployment na Vercel

### Krok 1: Przygotuj repozytorium
```bash
# Commit wszystkie zmiany
git add .
git commit -m "Switch to SQLite for all environments

- Updated Prisma schema to use SQLite
- Changed JSON fields to String for SQLite compatibility
- Updated build configuration for Vercel
- Fixed database connection issues"

# Push do głównej gałęzi
git push origin main
```

### Krok 2: Konfiguruj Vercel Dashboard
1. **Idź do https://vercel.com/dashboard**
2. **Znajdź swój projekt** (inwentura-opp lub podobnie)
3. **Kliknij Settings → Environment Variables**
4. **Usuń wszystkie zmienne PostgreSQL/Neon** jeśli istnieją:
   - `DATABASE_URL` (stara wersja z Neon)
   - `POSTGRES_*` (jeśli istnieją)

### Krok 3: Ustaw nowe zmienne środowiskowe
W Vercel Dashboard → Settings → Environment Variables dodaj:

**Production Environment:**
```
DATABASE_URL = file:/tmp/production.db
```

**Preview Environment:**
```
DATABASE_URL = file:/tmp/preview.db
```

**Development Environment:**
```
DATABASE_URL = file:./prisma/dev.db
```

**Opcjonalnie (wszystkie środowiska):**
```
NEXT_TELEMETRY_DISABLED = 1
```

### Krok 4: Redeploy aplikacji
**Opcja A - Automatyczny redeploy:**
```bash
git push origin main
```

**Opcja B - Manual redeploy w Dashboard:**
1. Idź do Vercel Dashboard → Deployments
2. Kliknij "Redeploy" na ostatnim deploymencie
3. Zaznacz "Use existing Build Cache" = OFF
4. Kliknij "Redeploy"

### Krok 5: Monitoruj deployment

**Sprawdź logi:**
1. Vercel Dashboard → Functions
2. Sprawdź czy build przeszedł pomyślnie
3. Sprawdź czy brak błędów w Runtime Logs

**Przetestuj API:**
Po udanym deploymencie przetestuj:
```bash
curl https://twoja-domena.vercel.app/api/health
curl https://twoja-domena.vercel.app/api/excel/data
```

## 🔧 Troubleshooting

### Problem: "Database file not found"
**Rozwiązanie:** Vercel automatycznie utworzy plik SQLite przy pierwszym uruchomieniu.

### Problem: "ENOENT: no such file or directory"
**Rozwiązanie:** 
1. Sprawdź czy `DATABASE_URL` w Vercel ENV jest poprawna
2. Upewnij się, że ścieżka to `file:./prisma/production.db`

### Problem: Build fails
**Rozwiązanie:**
1. Sprawdź czy `prisma generate` jest w build command
2. W vercel.json powinno być: `"buildCommand": "npm run build && npm run db:generate"`

### Problem: Functions timeout
**Rozwiązanie:** SQLite jest szybkie, ale jeśli nadal są problemy:
1. Zwiększ timeout w vercel.json
2. Sprawdź czy nie ma nieskończonych pętli w kodzie

## 📊 Zalety tego rozwiązania

✅ **Prostota** - zero konfiguracji bazy danych  
✅ **Koszt** - całkowicie darmowe  
✅ **Wydajność** - SQLite jest bardzo szybkie dla tej skali  
✅ **Niezawodność** - brak problemów z połączeniami  
✅ **Backup** - dane można łatwo pobrać z /prisma/production.db  

## 🔄 Przyszłe aktualizacje

Jeśli w przyszłości będziesz potrzebować większej skali, możesz przejść na:
- **Turso** (SQLite w chmurze)
- **PlanetScale** (MySQL)
- **Vercel Postgres** (płatne)

Ale dla 99% przypadków SQLite w zupełności wystarczy!

## ⚡ Quick Commands

```bash
# Jeśli coś pójdzie nie tak, przywróć lokalne testy:
npm run dev
curl http://localhost:3000/api/health

# Sprawdź status bazy:
npm run db:studio

# Regeneruj Prisma client:
npm run db:generate
```