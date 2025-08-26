# 🔧 Naprawa błędu "table does not exist" na Vercel

## Problem
Po deployment na Vercel widzisz błąd:
```
The table `public.AggregatedItem` does not exist in the current database
```

## Rozwiązanie

### Opcja 1: Automatyczna migracja przy kolejnym deployment
**Package.json został już zaktualizowany** - przy następnym deployment migracje uruchomią się automatycznie.

Wypchnij zmiany:
```bash
git add .
git commit -m "Add database migrations for PostgreSQL deployment"
git push
```

Następny deployment na Vercel automatycznie utworzy tabele.

### Opcja 2: Ręczne uruchomienie migracji (natychmiastowe)

1. **Skopiuj DATABASE_URL z Vercel dashboard**
   - Idź do Vercel → Your Project → Settings → Environment Variables
   - Skopiuj wartość `DATABASE_URL`

2. **Ustaw lokalnie i uruchom migrację:**
   ```bash
   # Ustaw DATABASE_URL tymczasowo
   export DATABASE_URL="postgresql://username:password@host.neon.tech/database?sslmode=require"
   
   # Uruchom migrację
   npx prisma migrate deploy
   
   # Opcjonalnie: dodaj sample data
   npx prisma db seed
   ```

3. **Zresetuj aplikację Vercel:**
   - Idź do Vercel dashboard
   - Deployments → Force redeploy latest

### Opcja 3: Przez Vercel CLI
```bash
# Jeśli masz vercel CLI
vercel env pull .env.production
export DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d '=' -f2)
npx prisma migrate deploy
```

## Weryfikacja
Po uruchomieniu migracji sprawdź:
1. **Neon Dashboard** - powinny być widoczne tabele
2. **Aplikacja** - powinna ładować się bez błędów

## Pliki dodane:
- `prisma/migrations/0001_init/migration.sql` - SQL do utworzenia tabel
- `prisma/migrations/migration_lock.toml` - lock file dla PostgreSQL
- Zaktualizowany `package.json` z `prisma migrate deploy` w build process

## Troubleshooting

**Błąd: "Environment variable not found: DATABASE_URL"**
- Upewnij się, że DATABASE_URL jest ustawiony w Vercel dashboard

**Błąd: "Connection refused"**
- Sprawdź czy connection string jest prawidłowy
- Neon database musi być aktywny (może być w sleep mode)

**Błąd: "permission denied"**
- Sprawdź czy user ma uprawnienia CREATE TABLE w Neon

---

**Szybkie rozwiązanie: po prostu wypchnij zmiany do git - kolejny deployment załatwi wszystko automatycznie!** 🚀