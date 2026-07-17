# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Co to je

**Turkmageddon** (Grand Turek Auto) — satirická webová arkáda: first-person
jízda Prahou v Mercedesu G, bourání aut za „preferenční hlasy", pixel-art
obličej (Turkocam) ve zpětném zrcátku reagující grimasami na dění.
Parodie kauz Filipa Turka; kontext a reálie jsou v `GAME_CONCEPT.md`.
**Veškeré UI texty, commit messages i komunikace s uživatelem jsou česky.**

## Příkazy

- Žádný build, žádné závislosti — čisté HTML/CSS/JS (plain script tagy,
  sdílený namespace `window.GTA`; funguje i z `file://`).
- Spuštění: otevřít `index.html`, případně `npx serve .`.
- Syntaxe: `for f in js/*.js; do node --check "$f"; done`
- Nasazení: GitHub Pages (workflow build/deploy běží automaticky po pushi;
  Pages aktuálně jede z větve `claude/turek-carmageddon-game-b2s1dp`,
  po merge PR #1 uživatel přepne na `main`).
- Vývojová větev: `claude/turek-carmageddon-game-b2s1dp`, otevřený PR #1.

### Headless testování (zavedený vzor)

Playwright + předinstalované Chromium (`executablePath:
'/opt/pw-browsers/chromium'`); balíček `playwright` nainstalovat npm-em do
scratchpad adresáře, ne do repa. Stránka se otevírá přes `file://`. Hra
vystavuje debug hook `window.__gtaDebug`:
`boost(v)`, `damage(n)`, `warp(segIdx)`, `zones()`, `stats()`,
`spawnCrosser(offset, v)`, `crossers()`, `addBanner(...)`, `addFloat(...)`,
`face`. Typický test: Enter → řízení klávesami/boost → čtení `stats()` /
pixel-detekce / screenshot. Pozor: chybějící PNG v `assets/face/` vyhazují
v konzoli 404 (neškodné) — test na `console error` je musí filtrovat;
`pageerror` je čistý. Trik na vynucení typu auta: po načtení přepsat
`Math.random` (typy se losují kumulativní pravděpodobností v `pickType`).

## Architektura

Tři moduly + jedna stránka. `index.html` obsahuje overlaye: start,
blesková zpráva (`#overlay-article`), game over (noviny „Deník Šrot")
a dotykové UI. Herní stavy: `menu | playing | paused | article | over`.

### `js/turkmageddon.js` — hra (vše kromě obličeje a zvuku)

- **Pseudo-3D**: segmentová projekce à la OutRun/Jake Gordon. Konstanty:
  `SEG_L 200`, `ROAD_W 2200` (POLOVINA šířky), `CAM_DEPTH` z FOV 100,
  `DRAW_DIST 180`, exponenciální mlha. `playerX` je v jednotkách
  polovin šířky silnice (krajnice ±1, obrubník clamp ±1.15). Trať se
  generuje jednou: sekce zatáček se **střídají směrem** (jinak náhoda
  vyráběla trať skoro jen doleva), síla 0–4; kopce = sinusovky s celými
  cykly přes délku trati (spojitost smyčky).
- **Město**: pražské panorama (Hradčany + střechy, parallax `mtOff`),
  domy podél trati jako sprity per segment, kolem semaforových bran
  křižovatky (`seg.cross`, zebra `seg.zebra`), moštárny (`seg.most`,
  totem + budova, zóny v `mostarnas`).
- **Provoz**: `CAR_TYPES` (p = kumulativní šance, votes, ww = světová
  šířka; speciální flagy `ambulance`, `ev`, `hearse`, `tough`). Respawn za
  horizontem po předjetí. Pohřebák má stráž: max jeden na trati
  a ≥20 s rozestup. Přejíždějící „nesanitka" (`crossers`) se spawnuje při
  přiblížení ke křižovatce; čelní střet → stav `article` (freeze, motor
  chcípne, potvrzení libovolnou ČERSTVOU klávesou — `e.repeat` se
  ignoruje, zámek 1,2 s).
- **Skórování a bannery**: hlasy za vraky × kombo („SPIRÁLA REALISMU"),
  od 200 km/h trvalý banner „PLYNULÁ JÍZDA!" (100 hlasů/s), na 325
  „OSTRAVA!!!" (300/s), rostoucí počítadlo; sanitky hlasy PŘIDÁVAJÍ
  (+500, „Turek nemůže prohrát"); „DOJEZDOVÁ TÍSEŇ!" pod 25 % HP.
- **HP**: `MAX_HP = 180`; `face.update` očekává škálu 0–100, proto se
  všude předává `(health / MAX_HP) * 100`. Poškození: hitCar
  `(1.9 + 0.05·rel) × tough`, nesanitka 26, moštárna léčí +80
  (stačí projet vjezdem, rychlost je irelevantní).
- **Vstup**: klávesnice (digitální) + plovoucí dotykový joystick na
  window pointer eventech — funguje i mimo plátno; dotyk = VŽDY plný
  plyn, brzda tažením dolů (>30 px), řízení analogové (`input.steerX`).
  Odpor zatáčení se násobí |steer| (jinak mobilní mikrokorekce brzdily).
  Tlačítko pauzy se zobrazuje jen ve stavech playing/paused
  (`setPauseVisible`).
- **Kokpit**: palubovka podle reálného interiéru G (jeden výdech vlevo,
  dva + přepínače vpravo, madlo), volant s hvězdou, mávající ruka
  (`waveT`) při průjezdu křižovatkou, zrcátko kreslí obličej zrcadlově
  a `frameless`.

### `js/face.js` — Turkocam (nezávislý na pohledu hry)

Stavový automat (`PRIORITY/EXPR/DURATION`, `trigger(event)`) + pixel-art:
mřížka `BASE` 36×42 znaků s paletou, výrazy jako záplaty (oči/obočí/ústa)
v `PATCH`/`EXPR_PARTS`, varianty palety (rage = rudá, tier2 = potlučená),
cache offscreen canvasů klíčovaná `expr|blink|variant|look`. `look` =
doomovský pohled do strany při plném rejdu. Nad pixely se kreslí vektorové
vrstvy: modřiny dle HP tieru, pot, hvězdičky, velké aviatorky (kombo ×3+).
Externí PNG z `assets/face/<stav>.png` mají přednost (tiché 404 fallback);
názvy stavů a prompty pro AI generátor jsou v `assets/face/README.md`.

### `js/audio.js` — syntéza (žádné soubory)

Motor: 2 rozladěné pily hluboko + sinusový sub + **střední harmonická
vrstva** (`osc3`, kvůli reproduktorům telefonů) přes lowpass; LFO moduluje
hlasitost (bublání) a MUSÍ se tlumit s motorem, jinak v tichu pulzuje.
`stall()` = chcípnutí motoru (rampy: pokles otáček, škytnutí, ticho) —
**po zavolání `stall()` se v témže snímku nesmí volat `setEngine`**
(ruší rampy přes `cancelScheduledValues`); herní smyčka to hlídá
podmínkou `!over && state === "playing"`.

## Mantinely satiry (závazné)

- Karikatura, žádné reálné fotografie, loga stran ani plná jména
  v herních textech (užívá se „Pilot T.", „šéf strany", „expremiér").
- **Žádná nacistická symbolika** — hákové kříže ani gesto zdvižené
  pravice byly výslovně odmítnuty a nesmí se přidávat v žádné podobě;
  narážky na kauzy jen textově (viz titulek o „sbírce historických
  artefaktů"). Mávání z auta je záměrně královské (pokrčený loket).
- Titulky novin, bannery a hlášky vycházejí z reálných citátů
  (zdrojováno v konverzaci ke kauzám; přehled v `GAME_CONCEPT.md`).
- Bourá se jen do aut, žádní chodci.

## Drobnosti

- `BTC_ADDRESS` v `js/turkmageddon.js` je prázdná konstanta — donate UI
  (mini ₿ na startu, plné tlačítko na game overu) se zobrazí až po jejím
  vyplnění uživatelem. Adresu nikdy nevymýšlet.
- Titul na startu je responzivní (`clamp`), hra je hratelná na mobilu
  (viz dotykový joystick) — mobilní změny vždy ověřit emulací
  (`hasTouch: true, isMobile: true`).
- `GAME_CONCEPT.md` je historický návrh (koncept A byl odstraněn);
  `README.md` drží aktuální pravidla — při změnách mechanik aktualizovat.
