# GTA - Grand Turek Auto

Satirická webová arkáda ve stylu Carmageddon. Bourej auta v provozu, sbírej
**preferenční hlasy** a sleduj **Turkocam** — obličej ve stylu Doom HUD, který
se šklebí podle toho, co se na silnici právě děje.

> Satirická parodie. Všechny postavy jsou karikatury, vše je nadsázka.

## Jak spustit

Žádný build, žádné závislosti — stačí otevřít `index.html` v prohlížeči,
případně pustit lokální server:

```
npx serve .
```

Hra je statická, takže funguje i na GitHub Pages
(Settings → Pages → Deploy from a branch).

## Ovládání

| Klávesa | Akce |
|---|---|
| ← / → nebo A / D | řízení |
| ↑ nebo W | plyn |
| ↓ nebo S | brzda |
| M | zvuk zap/vyp |
| R | restart |

## Pravidla

- Nabourané auto = preferenční hlasy (dražší auto = víc hlasů).
- Řetěz bouraček do 4 sekund = **kombo** (násobič až ×5, od ×3 sluneční brýle).
- Projetí na červenou = +200 hlasů a spiklenecké mrknutí.
- Elektromobily jedou potichu a nesou nejvíc hlasů.
- **Sanitkám se vyhýbej** — −500 hlasů, mediální skandál.
- Hra končí, když je karoserie na šrot.

## Struktura

```
index.html      – markup + overlaye (start, novinový game over)
css/style.css   – styly
js/face.js      – Turkocam: stavový automat grimas + procedurální karikatura
js/audio.js     – Web Audio: motor V8, rány, cinkání (žádné soubory)
js/game.js      – herní logika: provoz, kolize, skóre, semafory
js/main.js      – bootstrap, vstup, herní smyčka
```

Modul `face.js` je záměrně nezávislý na pohledu hry — počítá se s ním i pro
koncept B (first-person „STUNTS mód“, grimasy ve zpětném zrcátku), viz
[GAME_CONCEPT.md](GAME_CONCEPT.md).
