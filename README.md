# GTA - Grand Turek Auto

Satirická webová arkáda. Bourej auta v provozu, sbírej **preferenční hlasy**
a sleduj **Turkocam** — karikovaný obličej, který se šklebí podle toho, co se
na silnici právě děje.

> Satirická parodie. Všechny postavy jsou karikatury, vše je nadsázka.

Hra má dva koncepty, vybírá se v úvodním menu (`index.html`):

- **Koncept A — GTA** (`gta.html`): pohled shora, tři pruhy,
  Turkocam v panelu ve stylu Doom.
- **Koncept B — Turkmageddon** (`turkmageddon.html`): first-person kokpit hranatého
  teréňáku ve stylu Mercedesu G (palubovka s kulatými výdechy, widescreen
  budíky, volant s hvězdou) s pseudo-3D silnicí — a grimasami
  ve **zpětném zrcátku**. Semafor tu má **každý pruh vlastní**.

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
| Esc | zpět do menu |
| 1 / 2 (v menu) | výběr konceptu |

## Pravidla

- Nabourané auto = preferenční hlasy (dražší auto = víc hlasů).
- Řetěz bouraček do 4 sekund = **kombo** (násobič až ×5, od ×3 sluneční brýle).
- Projetí na červenou = +200 hlasů a spiklenecké mrknutí.
- Turkmageddon: drž maximálku 250 km/h a naskočí **BOMBY!** — hlasy
  přibývají, dokud rychlost udržíš (zatáčení rychlost žere).
- Elektromobily jedou potichu a nesou nejvíc hlasů (ve STUNTS módu
  s bonusem +150 a velkým oznámením).
- **Sanitkám se vyhýbej** — −500 hlasů, mediální skandál (ve STUNTS módu
  krvavý titulek přes obrazovku).
- Hra končí, když je karoserie na šrot.

## Vlastní obličej (AI pixel art)

Vestavěná karikatura jde nahradit vlastními obrázky (třeba vygenerovanými
AI): nahrajte PNG do `assets/face/` s názvy `neutral.png`, `grin.png`,
`wink.png`, `rage.png`, `pain.png`, `panic.png`, `ko.png`
a `sunglasses.png`. Hra je automaticky použije, chybějící stavy dál kreslí
sama. Detaily a hotový prompt: [assets/face/README.md](assets/face/README.md).

## Struktura

```
index.html       – úvodní menu s výběrem konceptu
gta.html         – koncept A (top-down)
turkmageddon.html – koncept B (first-person kokpit)
css/style.css    – styly (hry, menu, novinový game over)
js/face.js       – Turkocam: stavový automat grimas + procedurální karikatura
                   (sdílený oběma koncepty — panel v A, zrcátko v B)
js/audio.js      – Web Audio: motor V8, rány, cinkání (sdílený, žádné soubory)
js/game.js       – koncept A: provoz, kolize, skóre, semafory
js/main.js       – koncept A: bootstrap, vstup, smyčka
js/stunts.js     – koncept B: pseudo-3D silnice, provoz, kokpit, zrcátko
```

Detailní návrh obou konceptů: [GAME_CONCEPT.md](GAME_CONCEPT.md).
