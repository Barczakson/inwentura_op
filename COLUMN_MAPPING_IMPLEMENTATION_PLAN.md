# Plan Implementacji Elastycznego Mapowania Kolumn

## Status: ✅ Backend Complete - 🚧 Frontend Required

### Już Zaimplementowane (Backend):
- ✅ System automatycznej detekcji kolumn
- ✅ API dla zarządzania mapowaniami kolumn  
- ✅ Preview API dla podglądu struktury plików
- ✅ Rozszerzony upload z obsługą custom mappings
- ✅ Model bazy danych z zapisywaniem konfiguracji

---

## Następne Kroki - Frontend UI

### Krok 6: Component dla Mapowania Kolumn
```typescript
// src/components/column-mapping-dialog.tsx
// - Interfejs do mapowania kolumn podczas uploadu
// - Drag & drop lub dropdown dla przypisywania kolumn
// - Podgląd pierwszych wierszy pliku
// - Zapisywanie i ładowanie mapowań
```

### Krok 7: Rozszerzenie Upload UI
```typescript  
// src/app/page.tsx (lub nowy upload page)
// - Dodanie kroku preview przed uploadem
// - Integracja z column-mapping-dialog
// - Wybór zapisanych mapowań
// - Walidacja mapowania przed wysyłką
```

### Krok 8: Zarządzanie Mapowaniami
```typescript
// src/components/saved-mappings.tsx
// - Lista zapisanych mapowań kolumn
// - Edycja i usuwanie mapowań
// - Ustawianie domyślnych mapowań
// - Statystyki użycia
```

---

## Szczegółowy Plan Frontend

### 6.1 Column Mapping Dialog Component

**Funkcjonalności:**
- 📋 Wyświetlanie wykrytych nagłówków
- 🎯 Dropdown/Select dla przypisywania kolumn
- 👀 Preview przykładowych danych
- ✅ Walidacja kompletności mapowania
- 💾 Zapisywanie nowego mapowania
- 🔄 Ładowanie zapisanych mapowań

**Przykładowy UI:**
```
┌─────────────────────────────────────────┐
│ Mapowanie Kolumn - plik.xlsx            │
├─────────────────────────────────────────┤
│ Wykryte nagłówki:                       │
│ ┌─────────┬──────────┬─────────────────┐ │
│ │ Kolumna │ Nagłówek │ Przypisz do     │ │
│ ├─────────┼──────────┼─────────────────┤ │
│ │ A       │ L.p.     │ [L.p. ▼]       │ │
│ │ B       │ Kod      │ [Nr indeksu ▼] │ │
│ │ C       │ Nazwa    │ [Nazwa ▼]      │ │
│ │ D       │ Ilość    │ [Ilość ▼]      │ │
│ │ E       │ JM       │ [Jednostka ▼]  │ │
│ └─────────┴──────────┴─────────────────┘ │
│                                         │
│ Przykładowe dane:                       │
│ ┌─────┬─────┬─────────┬─────┬─────┐     │
│ │ 1   │ A01 │ Produkt │ 100 │ kg  │     │
│ │ 2   │ A02 │ Część   │ 50  │ szt │     │
│ └─────┴─────┴─────────┴─────┴─────┘     │
│                                         │
│ □ Zapisz jako "Standardowy Layout"      │
│                                         │
│ [Anuluj] [Importuj]                     │
└─────────────────────────────────────────┘
```

### 6.2 Upload Flow z Preview

**Nowy przepływ:**
1. **Wybór pliku** → Wyślij do /api/excel/preview
2. **Podgląd struktury** → Pokaż wykryte kolumny
3. **Mapowanie kolumn** → Użytkownik potwierdza/edytuje
4. **Wysyłka z mapowaniem** → Upload z column mapping
5. **Potwierdzenie** → Standardowy sukces

### 6.3 API Integration

**Potrzebne hooki:**
```typescript
// src/hooks/use-column-mapping.ts
- useColumnPreview(file)
- useColumnDetection(headers, sampleData)  
- useSavedMappings()
- useSaveMapping(mapping)
- useDeleteMapping(id)
```

---

## Przykłady Użycia

### Scenariusz 1: Automatyczna Detekcja
```
Plik: inventory.xlsx
Nagłówki: ["L.p.", "Kod produktu", "Nazwa", "Stan", "Jednostka"]
Rezultat: ✅ Automatycznie wykryto wszystkie kolumny (pewność: 95%)
Akcja: Użytkownik klika "Importuj" bez zmian
```

### Scenariusz 2: Ręczne Mapowanie  
```
Plik: export_sap.xlsx
Nagłówki: ["Position", "Material", "Description", "Amount", "UoM"]
Rezultat: ⚠️ Wykryto częściowo (pewność: 60%)
Akcja: Użytkownik ręcznie mapuje kolumny i zapisuje jako "SAP Export"
```

### Scenariusz 3: Zapisane Mapowanie
```
Plik: weekly_report.xlsx  
Nagłówki: ["Item", "Product Name", "Qty", "Unit"]
Rezultat: ✅ Znaleziono zapisane mapowanie "Weekly Reports"
Akcja: Użytkownik wybiera zapisane mapowanie i importuje
```

---

## Korzyści Systemu

### Dla Użytkowników:
- 🎯 **Elastyczność** - obsługa różnych formatów plików
- ⚡ **Szybkość** - automatyczna detekcja w większości przypadków  
- 💾 **Wygoda** - zapisywanie często używanych mapowań
- 🔍 **Kontrola** - podgląd przed importem

### Dla Systemu:
- 🏗️ **Skalowalność** - łatwe dodawanie nowych formatów
- 📊 **Analityka** - śledzenie popularności mapowań
- 🛡️ **Niezawodność** - walidacja przed importem
- 🔄 **Evolucja** - uczenie się z użycia

---

## Timeline Implementacji

**Faza 1 (2-3 dni):** Column Mapping Dialog Component
**Faza 2 (1-2 dni):** Integracja z Upload Flow  
**Faza 3 (1 dzień):** Zarządzanie Zapisanymi Mapowaniami
**Faza 4 (1 dzień):** Testy i Dokumentacja

**Całkowity czas:** ~5-7 dni roboczych

---

## Testing Strategy

### Pliki Testowe:
- ✅ Standard format (L.p. | Nr indeksu | Nazwa | Ilość | JMZ)
- ✅ Minimum required (Nazwa | Ilość | Jednostka)  
- ✅ SAP export format (Position | Material | Description | Amount | UoM)
- ✅ Custom order (Ilość | Nazwa | Kod | Jednostka | L.p.)
- ❌ Missing required columns
- ❌ Duplicate column assignments

### Automated Tests:
- Unit tests dla column detection logic
- Integration tests dla API endpoints
- E2E tests dla upload flow
- Performance tests z dużymi plikami