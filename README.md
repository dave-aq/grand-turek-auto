# Turkmageddon (GTA — Grand Turek Auto)

Satirická webová arkáda: first-person kokpit hranatého teréňáku ve stylu
Mercedesu G, pseudo-3D jízda Prahou, bourání do aut v provozu a sbírání
**preferenčních hlasů**. V zpětném zrcátku celou dobu šklebí grimasy
**Turkocam** — karikatura, která reaguje na všechno, co se na silnici děje.

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
| Esc | pauza |

## Pravidla

- Nabourané auto = preferenční hlasy (dražší auto = víc hlasů).
- Řetěz bouraček do 4 sekund = kombo **SPIRÁLA REALISMU** (násobič až ×5,
  od ×3 aviatorky).
- Projetí na červenou = +200 hlasů; **každý pruh má vlastní semafor**
  (50 % času červená), rozhoduje pruh, kterým projedeš.
- Od 200 km/h běží **PLYNULÁ JÍZDA** („německá dálnice") — hlasy naskakují,
  dokud rychlost držíš, a počítadlo roste. Na maximálce **325 km/h** se
  přepne **REŽIM OSTRAVA** s trojnásobným přílivem. Zatáčení rychlost žere,
  takže to udržíš jen rovně.
- Elektromobily jedou potichu, nesou nejvíc hlasů a bonus +150.
- **Sanitkám se vyhýbej** — −500 hlasů a krvavý titulek přes obrazovku.
- Skoro zničené auto hlásí **DOJEZDOVOU TÍSEŇ**; hra končí, když je
  karoserie na šrot.
- Opravit karoserii jde v **MOŠTÁRNĚ** („rozhodně ne garáž") u silnice:
  zpomal pod 100 km/h a zajeď doprava na vjezd — +50 karoserie
  a razítko dodatečně.

## Vlastní obličej (AI pixel art)

Vestavěná karikatura jde nahradit vlastními obrázky (třeba vygenerovanými
AI): nahrajte PNG do `assets/face/` s názvy `neutral.png`, `grin.png`,
`wink.png`, `rage.png`, `pain.png`, `panic.png`, `ko.png`
a `sunglasses.png`. Hra je automaticky použije, chybějící stavy dál kreslí
sama. Detaily a hotový prompt: [assets/face/README.md](assets/face/README.md).

## Struktura

```
index.html          – hra (markup, start overlay, novinový game over)
css/style.css       – styly
js/face.js          – Turkocam: stavový automat grimas + procedurální
                      karikatura, volitelné PNG sprity z assets/face/
js/audio.js         – Web Audio: hluboký V8, rány, cinkání (žádné soubory)
js/turkmageddon.js  – hra: pseudo-3D silnice, provoz, skóre, kokpit,
                      zrcátko, bannery
assets/face/        – místo pro vlastní sprity obličeje
```

Historie návrhu a původní dva koncepty: [GAME_CONCEPT.md](GAME_CONCEPT.md).
(Původní top-down koncept A byl vyřazen — vývoj pokračuje jen na
Turkmageddonu.)
