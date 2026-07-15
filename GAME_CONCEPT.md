# Grand Turek Auto 🏎️💥

> Satirická webová arkáda ve stylu Carmageddon / GTA 1 s karikaturou Filipa Turka v hlavní roli.
> **Toto je brainstormový koncept — nic z toho není finální.**

---

## 1. Elevator pitch

Top-down arkádová honička v silničním provozu. Hráč řídí veterána se řvoucím V8 a jeho
úkolem je nasbírat co nejvíc **preferenčních hlasů** — ty se získávají bouráním aut,
riskantní jízdou a projížděním na červenou. Dole na obrazovce je **Turkocam**: miniatura
karikovaného obličeje ve stylu Doomu, která živě reaguje grimasami na všechno, co se děje.
Hra končí, když je auto na šrot, nebo když se přeplní **metr mediálního skandálu**.

## 2. Předloha (satirická postava)

Postava „Pilot T." je karikaturou veřejně známé osoby a čerpá z veřejně známých motivů:

- bývalý závodník a sběratel veteránů (Jaguar klub, Rolls-Royce…),
- boj proti Green Dealu a elektromobilům, láska k V8,
- rekordní preferenční hlasy,
- mediální kauzy: nadhodnocená sbírka aut, jízda odbočovacím pruhem, videa z rychlé jízdy.

**Zásady:** čistá nadsázka a parodie, žádné reálné fotografie (osobnostní + autorská práva),
žádná loga stran, disclaimer na úvodní obrazovce. Bourá se **jen do aut** — žádní chodci
(na rozdíl od původního Carmageddonu).

## 3. Core loop

1. Jeď → bourej auta v provozu → sbírej preferenční hlasy (skóre).
2. Komba zvyšují násobič, riskantní jízda (červená, protisměr, odbočovák) přidává bonusy.
3. Poškození auta ubývá „zdraví", průšvihy plní metr skandálu.
4. Game over = zničené auto NEBO plný metr skandálu (tisková konference).
5. Za hlasy si hráč odemyká další veterány do garáže.

## 4. Turkocam — obličej ve stylu Doom HUD

Stavový automat se spritesheetem grimas. Každý stav má prioritu a minimální dobu
zobrazení (~600 ms), bolest přerušuje vše (jako v Doomu).

| Stav | Trigger | Grimasa |
|---|---|---|
| NEUTRAL | idle jízda | sebevědomý úsměšek, občas mrkne do kamery |
| GRIN | naboural auto | široký zubatý úsměv |
| ECSTASY | kombo 3+ | spadnou mu na oči sluneční brýle |
| WINK | projetí na červenou | spiklenecké mrknutí |
| SMUG | drift / jízda odbočovacím pruhem | povytažené obočí („zachránil jsem vám život") |
| DISGUST | poblíž elektromobil / nabíječka | ohrnutý ret, zelená ve tváři |
| RAGE | náraz do zdi, zdržení v koloně | zaťaté zuby, rudá hlava |
| PAIN 1–3 | poškození (3 stupně jako v Doomu) | postupně potlučenější obličej |
| PANIC | plnící se metr skandálu / houkačky | těkající oči, pot |
| KO | game over | hvězdičky kolem hlavy / blesky fotoaparátů |

## 5. Skórování

- **Měna skóre = preferenční hlasy.** Sražené auto = hlasy podle typu (drahé auto = víc).
- **Kombo:** řetěz bouraček do X sekund → násobič ×2, ×3… doprovázený hláškami komentátora.
- **Bonusy:** červená (+), protisměr (+/s), odbočovací pruh (+/s, ale vysoké riziko),
  téměř-minutí (near miss).
- **Penalizace:** náraz do sanitky / vozu s krví = obrovský skok metru skandálu + titulek
  novin přes obrazovku. Satira, ne oslava — hra tě za to reálně trestá.
- **Ironické skóre:** zničení elektromobilu → „Ušetřené emise: -100 %?" a pár hlasů navíc,
  ale přivolá Green Deal patrolu.

## 6. Svět a provoz

- Nekonečná/okruhová mapa: magistrála, kruháče, semafory, kolony.
- Civilní provoz: hatchbacky, dodávky, tramvaj (nezničitelná — přírodní nepřítel),
  elektromobily (jedou potichu — hůř slyšet, snadné překvapení).
- **Green Deal patrola:** modrá auta se žlutými hvězdami, honí hráče při vysokém skandálu.
- Speciální vozidla: sanitka (nebourat!), kamion s bateriemi (výbušný), pojízdný stánek
  s klobásami (power-up).

## 7. Power-upy

- **V8 Boost** — nitro se zvukem osmiválce.
- **Plná nádrž benzínu** — doplní zdraví (žádné nabíjení, zásadně).
- **Aristokratické mávnutí** — 5 s nesmrtelnosti, provoz uhýbá.
- **Mlžení pro média** — vynuluje kus metru skandálu.
- **Odhad znalce** — dočasně ×2 hodnota všeho, co nabouráš („sbírka za 44,8 mil.").

## 8. Herní módy (později)

1. **Arkáda / Time attack** — 3 minuty, co nejvíc hlasů. (MVP)
2. **Kampaň „Cesta na ministerstvo"** — Brusel → D1 → magistrála → Karlovy Vary (Pupp).
3. **Denní výzva** — seed dne, žebříček.

## 9. Audio

- Smyčka burácení V8 (pitch podle rychlosti), skřípění, plechové rány.
- Komentátor stylem sportovního přenosu: „Neuvěřitelné kombo!", „To bude titulní strana!"
- Elektromobily: ticho… a pak jen *cink*.

## 10. Vizuální styl

- Pixel-art nebo flat-vector top-down (GTA 1 vibe), auta ~32×64 px.
- Turkocam: ručně kreslená karikatura, spritesheet ~10 grimas, 2 snímky na stav (mrkání).
- UI prvky jako novinové titulky a volební billboardy.

## 11. Technický návrh

**MVP: vanilla JS + Canvas 2D, jediný `index.html`, žádný build.**

- ~60 FPS game loop (`requestAnimationFrame`), jednoduchá arkádová fyzika
  (žádný engine — AABB/OBB kolize stačí).
- Moduly: `game.js` (loop, stavy), `traffic.js` (spawner + jednoduchá AI pruhů),
  `player.js`, `face.js` (stavový automat Turkocam), `hud.js`, `audio.js` (Web Audio).
- Grafika: nejdřív barevné obdélníky (programmer art), pak spritesheet.
- Alternativa, kdyby MVP přerostl: Phaser 3 (hotová fyzika, částice, tweeny).
- Hostování: GitHub Pages — statická hra bez backendu.

### MVP checklist

- [x] Auto hráče: plyn/brzda/zatáčení, setrvačnost
- [x] Scrollující silnice + spawner provozu (3 pruhy)
- [x] Kolize + „vrakový" efekt, skóre a kombo
- [x] Semafor + detekce jízdy na červenou
- [x] Turkocam: NEUTRAL / GRIN / PAIN / RAGE / WINK (+ PANIC, ECSTASY, KO)
- [x] Zdraví, game over, restart (novinová titulní strana)
- [x] Zvuk motoru + rána (Web Audio, bez souborů)
- [x] Bonus: sanitka s penalizací, elektromobily, near-miss, kombo brýle

## 12. Koncept B — „STUNTS mód": first-person kokpit 🪞

> **Stav:** prototyp postaven (`stunts.html` + `js/stunts.js`) — pseudo-3D
> silnice se zatáčkami a kopci, provoz, kokpit s volantem a budíky, grimasy
> ve zpětném zrcátku (sdílený `face.js`). Výběr konceptu je v úvodním menu.

Druhá varianta inspirovaná DOS klasikou **Stunts (1990)**: pohled z kokpitu,
vidět je volant, palubní deska a **zpětné zrcátko, ve kterém sedí řidičova tvář
a šklebí se** — Turkocam přesunutý z Doom panelu do zrcátka. Tím se z HUD prvku
stává součást herního světa (diegetické UI) a gag je o level silnější: grimasy
nejsou „ukazatel", ale řidič, který se na sebe dívá.

### Kokpit

- **Volant** se otáčí podle řízení, na věnci ruce; při driftu ručkování,
  při power-upu „natáčení videa" jedna ruka drží telefon a volant klouže.
- **Palubní deska veterána**: chromované budíky — rychloměr, otáčkoměr
  (ručička do červené = zvuk V8 nahoru), teplota, palivo. Kontrolky jako
  easter eggy (kontrolka „EU" bliká, když je poblíž Green Deal patrola).
- **Zpětné zrcátko** — hlavní hvězda. Varianty provedení:
  1. *Úzké zrcátko, jen oči a obočí* — filmový záběr, intenzivní, ale přijdeme
     o úsměvy a zuby (polovina grimas žije v ústech).
  2. *Široké panoramatické zrcátko s celou tváří* — čitelné všechny grimasy.
  3. *Kombinace*: normálně oči, při velké události (kombo, sanitka) se zrcátko
     „nakloní"/přiblíží na celou tvář.
  - **Doporučení: 2 jako základ, 3 jako šťáva navrch.**
- Drobnosti: kývací figurka na palubovce (jaguár?), doutník v popelníku,
  rádio s přeladitelnými stanicemi (dechovka / motoristické zprávy).

### Render silnice — dvě cesty

| | Pseudo-3D (OutRun styl) | Skutečné 3D (Three.js) |
|---|---|---|
| Věrnost STUNTS | arkádová aproximace | blízko (flat-shaded polygony) |
| Zatáčky/kopce | ano (projekce segmentů) | ano |
| Skoky, rampy, looping | jde ošidit, looping těžko | přirozeně |
| Náročnost prototypu | 1–2 dny | ~týden+ |
| Závislosti | žádné (canvas) | three.js |

**Doporučení:** prototyp jako pseudo-3D na canvasu (segmentová projekce à la
klasické tutoriály „Lou's pseudo-3d"), sprity aut škálované vzdáleností.
Kdyby chtěl mód STUNTS prvky naplno (looping, vývrtka), přejít na Three.js.

### Gameplay rozdíly proti konceptu A

- Bourání zezadu a předjíždění — destrukce je „před tebou", kamera shake
  a praskliny na skle místo top-down jiskření.
- Protisměr = víc adrenalinu (čelní siluety rostou rychle).
- STUNTS dědictví: **kaskadérské prvky** — rampy, skoky, klopené zatáčky;
  příběhově „kaskadérská demonstrace proti Green Dealu".
- Track editor (velké později): skládání trati z dílků přesně jako ve STUNTS.

### Co se přenese z MVP konceptu A beze změny

- `face.js` — stavový automat grimas je na pohledu nezávislý; jen se kreslí
  do rámu zrcátka místo do panelu (a zrcadlově).
- Skórování, komba, typy aut a hodnoty hlasů, zvukový systém.
- Spawner provozu — z pruhů (1D) se stanou segmenty (vzdálenost + pruh).

### Srovnání konceptů

| | A: top-down Carmageddon | B: STUNTS kokpit |
|---|---|---|
| Čitelnost destrukce | výborná (vidíš celý chaos) | nižší (jen před sebou) |
| Wow efekt / humor | Doom panel, klasika | zrcátko — originálnější gag |
| Náročnost | nízká (hotové MVP) | střední až vysoká |
| Mobil / dotyk | snadné | těžší (víc UI na obrazovce) |
| STUNTS prvky (skoky…) | nedávají smysl | přirozené |

**Doporučení:** A zůstává hratelné jádro a hřiště pro ladění mechanik;
B stavět jako „v2" na sdílených modulech — nejdřív prototyp pseudo-3D silnice
se zrcátkem a třemi grimasami, ať se ověří, jak gag funguje v pohybu.

## 13. Právní a etické poznámky

- Politická satira veřejně činné osoby je legitimní, ale: **karikatura, ne fotky**;
  žádná loga a názvy stran; disclaimer „satirická parodie, vše v nadsázce".
- Nevkládat postavě do úst smyšlené citáty prezentované jako skutečné.
- Žádné bourání do chodců, sanitky hra trestá — humor míří na styl jízdy a kauzy,
  ne na zraněné lidi.
