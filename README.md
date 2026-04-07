# Album Story Viewer

Prosta aplikacja HTML/CSS/JavaScript do przeglądania obrazkowych historii z jednego katalogu.

## Jak przygotować katalog

Umieść w jednym folderze:

- obrazy: `jpg`, `jpeg`, `png`, `webp`, `gif`, `bmp`, `svg`, `avif`
- wideo: `mp4`, `webm`, `ogg`, `mov`, `m4v`
- pliki tekstowe `.txt` o tej samej nazwie co multimedia
- opcjonalnie także pliki opisów w formacie `nazwa_obrazu.rozszerzenie.txt`, np. `01-przyjazd.jpg.txt`

Przykład:

```text
wakacje/
  story.txt
  cover.jpg
  01-przyjazd.jpg
  01-przyjazd.txt
  02-spacer.mp4
  02-spacer.txt
```

## Zawartość plików tekstowych

Plik sceny, np. `01-przyjazd.txt`:

```text
Przyjazd nad morze
To jest pełny opis tej sceny. Pierwsza linia staje się nagłówkiem,
a reszta pliku opisem widocznym na kafelku i w widoku szczegółowym.
```

Możesz też użyć wariantu z zachowanym rozszerzeniem pliku multimedialnego,
np. `01-przyjazd.jpg.txt` albo `02-spacer.mp4.txt`. Jeśli istnieją oba pliki,
bardziej szczegółowy wariant z rozszerzeniem ma pierwszeństwo.

Dla wideo możesz opcjonalnie dodać metadane na początku pliku, aby sterować
fragmentem używanym w miniaturkach:

```text
@previewStart: 12.5
@previewEnd: 18

Spacer po plaży
Miniaturka wideo zacznie się od 12.5 sekundy i będzie zapętlać fragment
do 18 sekundy.
```

Obsługiwane metadane:

- `@previewStart:` czas startu miniaturki w sekundach
- `@previewEnd:` opcjonalny czas końca miniaturki w sekundach

Plik `story.txt`:

```text
Nasze wakacje
Krótki opis całej historii widoczny w górnym banerze aplikacji.
```

## Plik główny tła

Opcjonalnie możesz dodać jedno z poniższych mediów:

- `cover.*`
- `hero.*`
- `background.*`
- dowolny obraz zawierający `hero` w nazwie, np. `moje-hero-zdjecie.jpg`

To multimedia zostanie użyte jako tło głównego widoku i nie będzie pokazane później w galerii.

## Uruchomienie

Wystarczy otworzyć plik `index.html` w przeglądarce i wybrać katalog z historią.
