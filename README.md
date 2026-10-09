# Tetris — Vue PWA

Een klein, schermvullend Tetris-spel voor de telefoon. Vue 3 met Vite, zonder backend, advertenties, externe lettertypen of CDN-afhankelijkheden. Het pakket bevat de volledige broncode én de gebouwde website in `dist/`.

## Meteen gebruiken

Zet de **inhoud van `dist/`** op een statische webserver met HTTPS. Open de URL op je telefoon en kies **Spelen**. Er zijn geen accounts, API-sleutels of serverinstellingen nodig in het zelfstandige pakket.

- **iPhone/iPad:** open de URL in Safari, gebruik het deelmenu en kies **Zet op beginscherm**. Start daarna via het app-icoon.
- **Android:** open de URL in Chrome en kies de aangeboden installatieoptie of **Toevoegen aan startscherm / App installeren** in het browsermenu.
- Open het spel de eerste keer online en wacht totdat het is geladen. Daarna kan de geïnstalleerde app offline starten.

De meegeleverde online demonstratie is privé. Meld je daar zo nodig aan. Je kunt het zelfstandige pakket op je eigen domein zetten zonder die toegangslaag.

## Besturing

| Actie | Telefoon | Toetsenbord |
| --- | --- | --- |
| Draaien | Tik op het speelveld | Omhoog of X |
| Verplaatsen | Veeg naar links of rechts | Links / rechts |
| Meteen laten vallen | Veeg omlaag | Spatie |
| Langzaam laten zakken | Automatische zwaartekracht | Omlaag |
| Pauzeren / doorgaan | Pauzeknop / Verder spelen | P of Escape |

Een lange horizontale veeg verplaatst meerdere vakjes. Een neerwaartse veeg zet alleen het huidige blok vast: dezelfde aanraking laat nooit per ongeluk het volgende blok vallen. Het spel pauzeert als de app de focus verliest of op de achtergrond komt.

## Wat is inbegrepen

- Een veld van 10 × 20 vakjes en de zeven bekende tetromino's: I cyaan, J blauw, L oranje, O geel, S groen, T paars en Z rood.
- Klassieke blokjes met een subtiele afgeschuinde rand, een donkere achtergrond en een doorschijnende landingspositie.
- Een eigen T-logo, gekleurd woordmerk, app-iconen en opstartafbeeldingen voor gangbare iPhones en iPads.
- Een kleine transparante **Hierna**-toast rechtsboven; verdwijnt na 1,6 seconde en wordt bij een nieuw blok vernieuwd.
- Een korte confettiburst bij **2, 3 of 4 lijnen**: respectievelijk 36, 64 of 100 deeltjes. Zonder extra pop-ups of geluid. De burst duurt circa één seconde. Bij de instelling 'minder beweging' is het effect korter en rustiger.
- Een highscore die direct lokaal wordt opgeslagen, zodat herladen de score bewaart.
- Een willekeurige zak met alle zeven blokken, SRS-wandcorrecties, 500 ms bodemvertraging en maximaal 15 vertragingresets per blok.
- Een pauzescherm en een eenvoudige mogelijkheid om na game over opnieuw te spelen.
- Een manifest, lokale assets en een versiegebonden service worker met offlinecache. Updates laden nooit midden in een potje opnieuw.

### Score

| Lijnen tegelijk | Punten × huidig niveau |
| --- | ---: |
| 1 | 100 |
| 2 | 300 |
| 3 | 500 |
| 4 | 800 |

Een harde val geeft 2 punten per vakje; een zachte val met het toetsenbord 1 punt. Iedere 10 lijnen verhoogt het niveau en de valsnelheid. Geen ingewikkelde combo- of T-spin-bonussen.

## Ontwikkelen

Gebruik Node.js 22 LTS of nieuwer en npm. Open een terminal in deze map:

```sh
npm ci
npm run dev
```

Open het adres dat Vite toont. Voor een productieversie en de volledige automatische controle:

```sh
npm run check
npm run preview
```

`check` voert de tests uit, bouwt de app en controleert daarna alle offline-assets, HTML-verwijzingen, het manifest en de icoonafmetingen. De service worker is alleen actief in de productieversie, zodat de ontwikkelserver niet door oude caches wordt beïnvloed. Op localhost kan de PWA zonder HTTPS worden ontwikkeld; voor een echte telefoon is een HTTPS-adres nodig voor installatie en service workers.

Overige opdrachten:

```sh
npm test        # spel-, gebaar-, opslag- en service-workertests
npm run build  # maakt dist/, inclusief sw.js
npm run icons  # genereert de meegeleverde PNG-iconen en iOS-opstartschermen opnieuw
```

## Publiceren

1. Bouw met `npm ci` en `npm run build`, of gebruik de al meegeleverde `dist/`.
2. Upload alle bestanden **uit `dist/` samen**, inclusief de submappen `assets/` en `icons/`.
3. Serveer via HTTPS. `manifest.webmanifest` krijgt bij voorkeur `application/manifest+json` als contenttype; `sw.js` moet als JavaScript worden geserveerd.
4. Geef `sw.js` en `manifest.webmanifest` de header `Cache-Control: no-cache`. Een voorbeeldbestand `_headers` is meegeleverd voor hosts die dit formaat ondersteunen. Bij andere webservers stel je dezelfde headers in.
5. Open de app online, sluit alle geopende instanties en start opnieuw om een wachtende update te activeren.

Relatieve paden ondersteunen ook hosting in een submap, bijvoorbeeld `https://voorbeeld.nl/tetris/`. Laat de URL van een submap eindigen op `/`. Er is geen SPA-rewrite of backend nodig. Open `dist/index.html` niet rechtstreeks als `file://`; gebruik een webserver.

## Schermvullend en opslag

Het manifest vraagt `fullscreen` aan, met `standalone` als terugval. De knop **Spelen** vraagt daarnaast de Fullscreen API aan waar de browser dit ondersteunt. Voor de beste ervaring start je de geïnstalleerde app vanaf het beginscherm. Het besturingssysteem beslist welke status- en navigatiebalken zichtbaar blijven; iOS geeft webapps geen onbeperkte controle over die systeembalken. De spelinterface zelf bevat tijdens het spelen alleen het veld, de score, het record en de pauzeknop.

De highscore staat in `localStorage` onder `tetris-pocket.highscore.v1`. De score hoort bij dit toestel en deze browser/app; er is geen synchronisatie. Wissen van sitegegevens verwijdert het record. Als lokale opslag geblokkeerd is, blijft het spel werken en meldt het na de ronde dat bewaren niet is gelukt.

## Bestanden

| Bestand/map | Functie |
| --- | --- |
| `src/App.vue` | Spelschermen, touch- en toetsenbordbesturing |
| `src/style.css` | Schermvullende mobiele vormgeving |
| `src/game/engine.js` | Blokken, rotatie, zwaartekracht, lijnen en punten |
| `src/game/gestures.js` | Tikken en vegen zonder dubbele acties |
| `src/game/renderer.js` | Scherp canvasveld en korte confetti |
| `src/game/storage.js` | Lokale highscore |
| `src/game/webmcp.js` | Optionele, feature-detected browserhulpmiddelen |
| `src/service-worker.js` | Offlinecache; de build vult versienummer en assets in |
| `public/manifest.webmanifest` | PWA-installatiegegevens |
| `public/icons/` | App-iconen en iOS-opstartschermen |
| `vite.config.js` | Vue-build en genereren van de service worker |
| `scripts/` | Icoongenerator en controle van de gebouwde PWA |
| `tests/` | Automatische spel- en PWA-controles |
| `dist/` | Direct te publiceren productieversie |

## Controle en beperkingen

De automatische suite controleert de blokverdeling, botsingen, rotatie bij randen en vloer, harde val, één tot vier lijnen, puntentelling, niveauwissels, pauze, bodemvertraging, game over, gebaren en highscore. De echte service-workercode wordt in een geïsoleerde testomgeving uitgevoerd: offline navigatie en assets komen uit de cache, andere caches blijven bewaard en login-/API-verzoeken worden niet opgeslagen. Dit is een simulatie, geen test in een mobiele browser.

De productiebuild en assetcontrole zijn uitgevoerd. Live browser- en toesteltests waren in de leveromgeving niet beschikbaar. Controleer bij ingebruikname op het doeltoestel: installatie via het beginscherm, offline heropenen, schermvullend spelen, tikken/vegen en highscore na afsluiten. Native WebMCP-ondersteuning is optioneel en kon niet in een ondersteunde browser worden geverifieerd; de functies zijn wel getest tegen een testregister.

Technische referenties: [Vue + Vite](https://vuejs.org/guide/quick-start), [manifest display-modi](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display).

De implementatie en het eenvoudige logo zijn voor dit project gemaakt; dit is geen officiële uitgave van Tetris.
