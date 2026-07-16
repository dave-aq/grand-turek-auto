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

## Prompt pro generátor (např. ChatGPT / Midjourney)

> 96x96 pixel art portrait, head only, satirical caricature of a Czech
> politician type: blond hair combed back and up with volume, high
> forehead, very square jaw, broad chin, blue-grey eyes, clean shaven,
> navy suit collar, dark background, retro DOS game HUD style (like the
> Doom status bar face), bold readable features.
>
> Varianty: neutral confident smirk / huge grin with teeth / winking /
> furious red face gritting teeth / hurt grimace with bruise / panicked
> sweating / knocked out with X eyes and stars / wearing gold aviator
> sunglasses.

Ať jsou všechny varianty ze stejného „setu" (stejný styl, stejná velikost
hlavy), jinak budou grimasy poskakovat.

**Poznámka:** držte se stylizované karikatury/pixel artu — fotorealistická
podoba skutečné osoby je právně i eticky ošemetnější než nadsázka.
