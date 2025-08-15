# Plan działań - Usprawnienia interfejsu użytkownika

## 1. Czytelność i hierarchia informacji

### Problem:
Dane są zlepione, trudno od razu zorientować się, co jest ważne, a co tło.

### Propozycje:

#### Grupowanie danych
- Wszystkie wpisy z danego pliku w jednej sekcji (kolapsowalnej)
- Możliwość zwijania/rozwijania sekcji dla każdego pliku
- Widoczny nagłówek sekcji z nazwą pliku i podstawowymi informacjami (liczba rekordów, data przesłania)

#### Wyróżnienie kluczowych pól
- Nazwa towaru, ilość, jednostka - powinny być na pierwszym planie
- Grubsza czcionka dla nazwy towaru
- Większy rozmiar czcionki dla ilości
- Wyróżnienie kolorystyczne dla wartości liczbowych

#### Odwrócenie kolejności kolumn
- Aktualna kolejność: ID | Nazwa | Ilość | Jednostka | Źródło | Akcje
- Proponowana kolejność: Nazwa | Ilość | Jednostka | Źródło | ID | Akcje
- Umieszczenie najważniejszych informacji na początku

#### Skrócone nazwy plików
- Zamiast pełnej nazwy pliku wyświetlać skrót np. "inwentura (2)"
- Pełna nazwa w tooltipie po najechaniu kursorem
- Ograniczenie długości wyświetlanej nazwy do 20 znaków + licznik plików

#### Ikony zamiast tekstu
- Ikona pliku Excela zamiast nazwy "ExcelFile" lub pełnej nazwy pliku
- Ikona kosza dla usuwania
- Ikona ołówka dla edycji
- Ikona pobierania dla eksportu

#### Tagi kolorowe
- Każdy plik może mieć inny, delikatny kolor tła wierszy
- Kolorystyka powinna być subtelna, nie rozpraszająca
- Użycie pastelowego koloru dla tła wiersza lub paska po lewej stronie
- Legenda kolorów w nagłówku sekcji

## 2. Workflow implementacyjny

### Etap 1: Analiza i planowanie
1. Przegląd obecnego stanu komponentów:
   - `DataTable` - główny komponent wyświetlania danych
   - `page.tsx` - strona główna z logiką
   - `data-table.tsx` - komponent tabeli
2. Określenie potrzebnych zmian w strukturze danych
3. Wybór biblioteki do kolorowania (lub własna implementacja)
4. Projekt ikon i systemu kolorów

### Etap 2: Implementacja grupowania danych
1. Modyfikacja API do zwracania danych pogrupowanych według plików
2. Aktualizacja komponentu `DataTable` do obsługi grupowania
3. Implementacja mechanizmu zwijania/rozwijania sekcji
4. Stylowanie nagłówków sekcji

### Etap 3: Wyróżnienie kluczowych pól
1. Zmiana stylu czcionki dla nazwy towaru (bold)
2. Zwiększenie rozmiaru czcionki dla ilości
3. Wyróżnienie kolorystyczne dla wartości liczbowych
4. Testowanie czytelności na różnych urządzeniach

### Etap 4: Zmiana kolejności kolumn
1. Przestawienie kolumn w komponencie `DataTable`
2. Aktualizacja nagłówków tabeli
3. Dostosowanie responsywności do nowej kolejności
4. Testowanie na różnych rozdzielczościach

### Etap 5: Skracanie nazw plików i ikony
1. Implementacja funkcji skracania nazw plików
2. Dodanie tooltipów z pełnymi nazwami
3. Zastąpienie tekstowych nazw ikonami
4. Wybór lub stworzenie odpowiednich ikon

### Etap 6: Tagi kolorowe
1. Wygenerowanie delikatnej palety kolorów (6-8 kolorów pastelowych)
2. Przypisanie kolorów do plików
3. Implementacja kolorowania wierszy lub pasków bocznych
4. Dodanie legendy kolorów w nagłówkach sekcji

### Etap 7: Testowanie i optymalizacja
1. Testowanie całościowego rozwiązania
2. Optymalizacja responsywności
3. Poprawki UX/UI
4. Testowanie dostępności
5. Dokumentacja zmian

### Etap 8: Wdrożenie
1. Przygotowanie pull requesta
2. Code review
3. Testy akceptacyjne
4. Wdrożenie na środowisko testowe
5. Wdrożenie na produkcję