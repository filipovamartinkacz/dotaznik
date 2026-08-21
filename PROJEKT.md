# Dotazník JsemBlažená.cz — projektová dokumentace

> Pracovní název: Dotaznik
> Poslední aktualizace: 2026-08-21

---

## Koncept

Jednorázový průzkumový dotazník pro chystanou platformu **JsemBlažená.cz** (souvislost s [Katalogem](../katalog/PROJEKT.md) — stejný vizuální brand, ale samostatná aplikace, ne jeho součást). Autorka a tvář dotazníku je **Nikola Hodovská** — texty jsou psány v první osobě jejím jménem, tykáním.

**Cíl:** zjistit, jaký je zájem o platformu propojující ženy s odbornicemi na péči o tělo a duši (kosmetičky, terapeutky, koučky, masérky...), a pochopit publikum — kdo by platformu využíval, co od ní očekává, jaké odbornice by hledal.

Otázky vycházejí z dotazníku na Survio, texty jsou průběžně sladěné s aktuální verzí tam (viz "Historie sladění" níže).

**Nasazeno a živé:** `https://dotaznik.lazena.cz`

---

## Architektura

| Vrstva | Technologie |
|---|---|
| Frontend + formulář | Next.js (App Router, TypeScript), jedna komponenta `src/components/Survey.tsx` |
| Styling | Tailwind CSS v4, brand shodný s Katalogem (`globals.css`) |
| Fonty | Livvic (tělo textu) + Thasadith (nadpisy), lokální `.ttf` v `/fonts` |
| Úložiště odpovědí | Google Sheets, zápis přes Google Apps Script Web App (`google-apps-script.gs`, `doPost`) |
| E-maily | Resend, doména `jsemblazena.lazena.cz` (viz "E-maily" níže) |
| Hosting | Vercel, `git push origin main` → `vercel --prod` (žádné feature branches, přímo do main) |

**Datový tok při odeslání:** formulář → `/api/submit` (Next.js route — server-side validace + XSS escapování, nezávislé na klientu) → `GOOGLE_SCRIPT_URL` (Apps Script) → `appendRow` do Sheetu → (pokud vyplněný e-mail) poděkování + PDF dárek → (pokud zaškrtnuté) interní upozornění na newsletter/odbornici.

Žádné monitorování chyb (Sentry/Vercel Analytics/GA) — vědomě vynecháno pro tak malý projekt.

---

## Struktura dotazníku

**20 číslovaných otázek** (jednovýběrové, vícevýběrové s možností "jiná (prosím uveď)", chipy pro krátké odpovědi / seznam se zaškrtávátky pro dlouhé) + **závěrečný krok** ("outro"), který není součástí číslované řady:

- Volný vzkaz (nepovinné)
- E-mail (povinný, pokud zaškrtnutý newsletter nebo "jsem odbornice")
- Souhlas s odběrem novinek (checkbox, nezaškrtnutý, odkaz na zásady zpracování osobních údajů)
- "Jsem odbornice a mám zájem o platformu" (checkbox) → animovaně se objeví pole "Čemu se věnuješ?"

Validace (`src/lib/outro-validation.ts`) běží na klientu (živé chyby) i na serveru (nezávislá pojistka).

### Sloupce v Google Sheetu (28 celkem)

`Časové razítko` + text všech 20 otázek + `Vzkaz`, `E-mail`, `Souhlas s novinkami`, `Datum souhlasu`, `Verze textu souhlasu` (`CONSENT_VERSION` v kódu), `Je odbornice`, `Čemu se věnuje`.

Vícevýběrové otázky ukládají zaškrtnuté volby do jedné buňky spojené `"; "`.

⚠️ **Known issue:** volba "wikipedie" u otázky 13 obsahuje v textu doslovný středník, který koliduje s tímhle oddělovačem — při statistickém zpracování je nutné ho nejdřív sloučit zpět (viz `generate.py` v sekci Statistiky). Oprava přímo v `survey-data.ts` zatím nepotvrzená uživatelkou.

---

## Co je hotové

- Kompletní dotazník (20 otázek), texty sladěné se Survio, jednotný pravopis (e-mail s pomlčkou, "jiná" malé j, brand "JsemBlažená.cz" s diakritikou všude)
- Fotky na úvodní/otázkové/děkovací obrazovce (desktop `sticky` napravo přes celou výšku, mobil banner nahoře), zdroj magnific.com
- Závěrečný formulář (vzkaz/e-mail/souhlas/odbornice) s plnou validací a XSS ochranou
- Sdílení dotazníku z děkovací stránky (`navigator.share` + fallback na kopírování odkazu)
- **E-maily** (Resend, doména `jsemblazena.lazena.cz` — zvolena kvůli omezení free planu na 1 doménu a záměrné izolaci reputace od `lazena.cz` i budoucího newsletteru na `novinky.lazena.cz` přes SmartEmailing):
  - Poděkování + PDF dárek "50 cest k sobě" (odkaz na `public/soubory/...pdf`, ne příloha — kvůli doručitelnosti; neuhodnutelný název souboru + `noindex` hlavička + `robots.txt`, ale s hezkým brandovaným názvem pro stažený soubor přes `Content-Disposition`)
  - Interní upozornění na `filipova.martina@seznam.cz` při přihlášení k newsletteru
  - Interní upozornění na `nikolahodovska@gmail.com` při přihlášení odbornice
- Vizuální report statistik z odpovědí (viz níže)

## Statistiky

Report generovaný z CSV exportu Sheetu — headline metriky, křížení věku se zájmem o platformu, demografie, chování/preference, volné citace. Vizuál na míru brandu (barvy odvozené z `--primary`, ověřená barevná škála pro graf věk×zájem přes `dataviz` skill).

**Zatím ruční pipeline** (skripty mimo repo, v `/tmp/dotaznik-report/`): uživatelka exportuje CSV ze Sheetu → nahraje do projektu → `compute_stats.py` spočítá `/tmp/survey_stats.json` z CSV → `generate.py` z něj vygeneruje HTML → vloží se do stránky Google Sites (Dashboard projektu) přes "Vložit HTML".

`generate.py` generuje dvě varianty (fonty Livvic/Thasadith): `report.html` s vloženými fonty jako base64 (pro Claude Artifact — CSP tam blokuje externí požadavky) a `report-sites.html` s běžným `<link>` na Google Fonts (pro Sites — ověřeno 2026-08-17, sandbox pro vložené HTML tam `<link>` na fonty toleruje, na rozdíl od aktivního `fetch()`). Do `statistiky-report.html` v projektu se kopíruje ta druhá (link) varianta.

**Plánovaná automatizace:** přepsat generování do Google Apps Script Web App (`doGet()`), vložitelné do Sites přes "Vložit URL", počítající statistiky živě ze Sheetu. Čeká se na schůzku uživatelky s Nikolou (doladění vzhledu/obsahu reportu) a na zpomalení frekvence potřebných refreshů (teď časté kvůli novosti dotazníku, za ~půl roku stačí měsíčně).

**Poslední regenerace:** k 20. 8. 2026, 145 odpovědí (90 % zájem, 85 % by doporučilo, 52 % chce newsletter, 44 % stáhlo e-book, 23 % odbornic se přihlásilo).

---

## Bezpečnost / provoz — poučení

- **CSV exporty a vygenerované reporty nesmí do gitu** (`*.csv`, `.~lock.*`, `statistiky-report.html` v `.gitignore`) — obsahují e-maily respondentek. 2026-08-11 se omylem dostal CSV export do veřejného GitHub repa, opraveno `git reset --soft` + force-push (soubory byly jen v jednom nepublikovaném commitu, šlo to čistě). **Vždy `git status` před `git add -A`.**
- Testování `/api/submit` přímými požadavky (curl apod.) zapisuje do **živého** Google Sheetu — žádné staging prostředí. Testovat radši s přepsaným `window.fetch` v prohlížeči, nebo importem `src/lib/email.ts` přímo přes `node --env-file=.env.local`.
- `RESEND_API_KEY` je v `.env.local` i na Vercelu.

---

## Otevřené otázky (do budoucna)

- Potvrdit a opravit středník v textu otázky 13 ("wikipedie")
- Apps Script automatizace statistik (po schůzce s Nikolou)
- Případná registrace na GitHub podpoře ohledně vymazání cache starého commitu s uniklými daty (uživatelka zatím odmítla, riziko akceptováno)
