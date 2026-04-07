# Album Story Viewer

Prosta aplikacja HTML/CSS/JavaScript do przeglądania obrazkowych historii z jednego katalogu.

## Jak przygotować katalog

Umieść w jednym folderze:

- obrazy: `jpg`, `jpeg`, `png`, `webp`, `gif`, `bmp`, `svg`, `avif`
- wideo: `mp4`, `webm`, `ogg`, `mov`, `m4v`
- pliki tekstowe `.txt` o tej samej nazwie co multimedia

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

To multimedia zostanie użyte jako tło głównego widoku.

## Uruchomienie

Wystarczy otworzyć plik `index.html` w przeglądarce i wybrać katalog z historią.
