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

- [ ] Auto hráče: plyn/brzda/zatáčení, setrvačnost
- [ ] Scrollující silnice + spawner provozu (3 pruhy)
- [ ] Kolize + „vrakový" efekt, skóre a kombo
- [ ] Semafor + detekce jízdy na červenou
- [ ] Turkocam: NEUTRAL / GRIN / PAIN / RAGE / WINK (5 stavů stačí na start)
- [ ] Zdraví, game over, restart
- [ ] Zvuk motoru + rána

## 12. Právní a etické poznámky

- Politická satira veřejně činné osoby je legitimní, ale: **karikatura, ne fotky**;
  žádná loga a názvy stran; disclaimer „satirická parodie, vše v nadsázce".
- Nevkládat postavě do úst smyšlené citáty prezentované jako skutečné.
- Žádné bourání do chodců, sanitky hra trestá — humor míří na styl jízdy a kauzy,
  ne na zraněné lidi.
