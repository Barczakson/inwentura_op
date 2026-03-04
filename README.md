


# inwentura_op

System do zarządzania inwentaryzacją i przetwarzania danych Excel. Aplikacja Next.js 15 zintegrowana z bazą PostgreSQL (Supabase) i komunikacją w czasie rzeczywistym.

##  Stos Technologiczny

* **Framework:** Next.js 15 (App Router, Server Components)
* **Język:** TypeScript 5
* **Baza Danych:** PostgreSQL (Supabase) + Prisma ORM
* **Stylizacja:** Tailwind CSS 4 + shadcn/ui
* **Zarządzanie Stanem:** Zustand (klient) + TanStack Query (serwer)
* **Obsługa Danych:** TanStack Table (tabele), Recharts (wykresy), SheetJS (parsowanie Excel)
* **Real-time:** Socket.IO (Custom Node.js Server)

##  Główne Funkcjonalności

* **Import Excel:** Parsowanie plików `.xlsx`/`.xls` i automatyczna ekstrakcja pól.
* **Agregacja:** Grupowanie danych po ID przedmiotu, nazwie i jednostce z sumowaniem ilości.
* **Zarządzanie:** Pełne CRUD na danych, edycja wewnątrz tabeli i eksport wyników.
* **Deployment:** Gotowa konfiguracja pod Vercel (Connection Pooling, IPv4, migracje runtime).

##  Struktura Projektu

```text
src/
├── app/          # Routing i logika stron (Next.js App Router)
├── components/   # Komponenty React (w tym /ui z shadcn)
├── hooks/        # Niestandardowe hooki (ReactUse, logika biznesowa)
├── lib/          # Konfiguracja Prisma, narzędzia i utility
└── server.ts     # Niestandardowy serwer Node.js dla Socket.IO

```

##  Szybki Start

### 1. Instalacja

```bash
npm install

```

### 2. Zmienne środowiskowe (.env)

Wymagane połączenie z Supabase (Transaction Pooler dla Vercela):

```env
DATABASE_URL="postgres://postgres.[REF]:[PASS]@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgres://postgres.[REF]:[PASS]@aws-1-eu-north-1.pooler.supabase.com:5432/postgres"

```

### 3. Baza danych

```bash
npm run db:push      # Synchronizacja schematu
npm run db:generate  # Generowanie klienta Prisma

```

### 4. Uruchomienie

```bash
npm run dev          # Start serwera deweloperskiego (Socket.IO + Next.js)

```

##  Specyfikacja Deploymentu (Vercel)

Aplikacja jest skonfigurowana pod serwerless, ale ze względu na **Socket.IO**, wymaga uruchomienia własnej instancji serwera lub skorzystania z adapterów (np. Ably/Pusher) w środowisku czysto brzegowym (Edge). Obecna konfiguracja zakłada **Custom Server** dla pełnej obsługi WebSockets.

---

