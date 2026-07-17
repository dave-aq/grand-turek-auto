# Vlastní obličej (AI pixel art)

Hra automaticky použije PNG z této složky místo vestavěné kreslené
karikatury. Stačí sem nahrát soubory s těmito názvy (co chybí, za to se
dál kreslí vestavěná grimasa):

| Soubor | Kdy se zobrazí |
|---|---|
| `neutral.png` | klidná jízda |
| `grin.png` | nabourané auto — široký škleb |
| `wink.png` | projetí na červenou — mrknutí |
| `rage.png` | dření o krajnici — vztek |
| `pain.png` | poškození — bolestivá grimasa |
| `panic.png` | sanitka / skandál — panika |
| `ko.png` | game over — omráčený |
| `sunglasses.png` | kombo ×3+ — sluneční brýle |

**Formát:** čtvercové PNG, ideálně 96×96 nebo 64×64 px. Pixel art se
vykresluje ostře (bez vyhlazování). Průhledné pozadí funguje — pod
obrázkem je tmavý rám panelu/zrcátka.

## Postup generování (po jedné grimase)

1. Vygenerujte nejdřív `neutral.png` a dolaďte, dokud nesedí.
2. Další grimasy zadávejte **ve stejné konverzaci** a k promptu přidejte:
   *"Same character, same style, same palette, same framing as the
   previous image — change ONLY the facial expression."*
3. Chtějte čtvercové PNG, ideálně „true 64x64 pixel art upscaled with
   nearest neighbor".

### Základní prompt (vložit pokaždé, doplnit řádek Expression)

> Retro pixel art portrait sprite for a game HUD, like the Doom status
> bar face. Head and shoulders, front view, centered, head fills about
> 80% of a square canvas. Character: satirical caricature of a Czech
> politician type — blond hair combed back and up into a high pompadour
> with darker gold strands, high forehead, very square angular jaw,
> broad chin with a subtle crease, blue-grey eyes, thick darker-blond
> eyebrows, clean shaven, wearing a dark navy suit with a white shirt
> collar. Style: crisp pixel art on a 64x64 grid, bold readable
> features, limited palette, no anti-aliasing, flat very dark background
> (#151517), no text, no watermark. Expression: …

### Dovětky pro jednotlivé soubory

| Soubor | Expression: … |
|---|---|
| `neutral.png` | confident subtle smirk, relaxed eyes looking straight at the viewer |
| `grin.png` | huge triumphant grin showing a full row of white teeth, raised eyebrows, delighted |
| `wink.png` | one eye winking closed, the other open, sly conspiratorial smirk |
| `rage.png` | furious — whole face flushed red, eyebrows in a steep angry V, open shouting mouth with gritted teeth |
| `pain.png` | hurt grimace — eyes squeezed shut, eyebrows tilted up in pain, mouth twisted open, purple bruise on one cheek, small bandage on the forehead |
| `panic.png` | panicked — eyes wide open with tiny pupils, eyebrows raised high, small trembling open mouth, sweat drops on the temples |
| `ko.png` | knocked out — X-shaped closed eyes, dazed, tongue sticking slightly out of a small open mouth, three little yellow stars circling above the head |
| `sunglasses.png` | cool and smug — wearing large gold-framed teardrop aviator sunglasses with dark lenses, confident smirk |
| `smug.png` | smug and superior — one eyebrow raised high, self-satisfied lopsided smirk |
| `disgust.png` | disgusted — narrowed eyes, curled upper lip, sneering at something distasteful |
| `most.png` | delighted — eyes closed content, licking lips after a drink of fresh cider |

Zrcátko ve hře obraz stranově převrací (mrknutí „přeskočí" na druhé
oko — to je správně, je to odraz). Všechny varianty musí být ze stejného
„setu", jinak budou grimasy mezi sebou poskakovat.

**Poznámka:** držte se stylizované karikatury/pixel artu — fotorealistická
podoba skutečné osoby je právně i eticky ošemetnější než nadsázka.
