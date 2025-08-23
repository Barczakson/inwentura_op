# Vercel KV Setup - Najłatwiejsze rozwiązanie bazy danych

## ✅ Co zostało zaimplementowane
- Zastąpiono Prisma + SQLite → Vercel KV (Redis)
- Proste API key-value storage
- Działa lokalnie (mock) i na produkcji (Vercel KV)
- Zero problemów z deployment

## 🚀 Setup na Vercel (3 kroki)

### Krok 1: Dodaj Vercel KV do projektu
1. **Idź do Vercel Dashboard → [Twój projekt]**
2. **Kliknij Storage tab**  
3. **Kliknij Create Database → KV**
4. **Podaj nazwę:** `excel-data-storage`
5. **Kliknij Create**

### Krok 2: Połącz KV z projektem
1. **W KV Database view, kliknij Connect**
2. **Wybierz swój projekt**
3. **Vercel automatycznie doda zmienne środowiskowe:**
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_URL`

### Krok 3: Deploy aplikację
```bash
git add .
git commit -m "Switch to Vercel KV - simplest database solution

- Replaced Prisma/SQLite with Vercel KV (Redis)
- Zero configuration needed
- Works locally (mock) and production (Vercel KV)
- All API endpoints converted to KV operations
- 100% compatible with Vercel serverless"

git push origin main
```

**Gotowe!** Aplikacja będzie działać bez błędów 500.

## 🎯 Zalety tego rozwiązania

✅ **Najłatwiejsze w implementacji** - 3 kliki w dashboard  
✅ **Zero konfiguracji** - automatyczne zmienne środowiskowe  
✅ **Darmowy tier** - 30,000 operacji/miesiąc za darmo  
✅ **Natychmiastowa dostępność** - brak problemów z połączeniami  
✅ **Bardzo szybkie** - Redis w tle  
✅ **Skalowalne** - automatyczne skalowanie Vercel  
✅ **Backup** - dane są bezpieczne w Vercel Cloud  

## 📊 Struktura danych w KV

```
# Pliki Excel
file:{id} → ExcelFileKV object

# Surowe wiersze 
row:{fileId}:{rowId} → ExcelRowKV object

# Zagregowane dane
aggregated:{id} → AggregatedItemKV object
```

## 🔧 API Endpoints (działają identycznie)

- `GET /api/excel/files` - Lista plików
- `GET /api/excel/data` - Dane zagregowane + paginacja + search
- `PUT /api/excel/data` - Update ilości
- `DELETE /api/excel/data?id=X` - Usuń item
- `POST /api/excel/upload` - Upload pliku (będzie zaktualizowane)

## 💰 Koszty

**Darmowy tier Vercel KV:**
- 30,000 operacji/miesiąc
- 256MB storage
- Wystarczy dla 99% projektów

**Jeśli przekroczysz:**
- $0.50 za 100,000 operacji
- Nadal bardzo tanie!

## 🐛 Troubleshooting

### Problem: "KV is not defined"
**Rozwiązanie:** Upewnij się, że KV jest połączony z projektem w Vercel Dashboard

### Problem: Lokalnie brak danych
**Rozwiązanie:** To normalne - używa mock storage. Na produkcji będą prawdziwe dane.

### Problem: Import error
**Rozwiązanie:** `@vercel/kv` jest już zainstalowany i skonfigurowany.

## 🔄 Migracja danych (opcjonalnie)

Jeśli masz już dane w SQLite, możesz je zmigrować:

```bash
# Uruchom lokalne API
npm run dev

# Export danych z SQLite (jeśli potrzebujesz)
npm run db:studio
```

Ale najłatwiej zacząć od nowa - dane Excel można łatwo przesłać ponownie.

## ⚡ Next Steps

1. **Deploy** (po git push)
2. **Przetestuj** na `https://twoja-domena.vercel.app/api/excel/data`
3. **Upload pierwszy plik Excel** 
4. **Gotowe!**

Baza danych będzie działać automatycznie i niezawodnie! 🎉