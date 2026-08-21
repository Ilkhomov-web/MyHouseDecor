# MyhouseShop — Do'kon tizimi

MyHouse brendining do'kon(lar)i uchun to'liq CRM/do'kon boshqaruv tizimi. Mahsulotlar, sotuvlar, harajatlar,
analitika va foydalanuvchilar (auth) bilan ishlaydigan production-yo'naltirilgan tizim.

> Eski versiya: `MyhouseShop CRM.html` — backendsiz, faqat brauzer xotirasida ishlaydigan boshlang'ich (MVP)
> demo edi (Claude Design orqali yaratilgan). Hozirgi versiya shu dizayn tilini (OKLCH rang tokenlari, Inter
> shrift, pill navigatsiya) asos qilib, to'liq backend + baza + autentifikatsiya bilan qayta qurildi.

## Arxitektura

- **`client/`** — React 19 + Vite frontend (SPA), React Router, Recharts (diagrammalar).
- **`server/`** — Node.js + Express backend, JWT (cookie-based) autentifikatsiya, SQLite baza
  (`better-sqlite3`), Excel eksport (`exceljs`).
- Ikkalasi ham alohida `npm` loyihasi; ildizdagi `package.json` ikkalasini birga ishga tushirish uchun.

## Ishga tushirish

```bash
npm run install:all   # server va client bog'liqliklarini o'rnatadi
npm run seed          # demo ma'lumotlar bilan bazani to'ldiradi (bir marta)
npm run dev           # server (:4000) va clientni (:5173) birga ishga tushiradi
```

Brauzerda: **http://localhost:5173**

### Production

```bash
npm run build   # client/dist ni yig'adi
npm start       # NODE_ENV=production bilan bitta server (:4000)
```

Production'da Express `client/dist` ni o'zi uzatadi (SPA fallback bilan), ya'ni frontend va API bitta
origin'da bo'ladi — alohida statik hosting yoki CORS sozlash kerak emas. Brauzerda: **http://localhost:4000**

Server `0.0.0.0` ga bog'lanadi, shuning uchun do'kondagi boshqa kompyuterlar `http://<server-IP>:4000`
orqali kira oladi. Faqat shu kompyuter bilan cheklash uchun `HOST=127.0.0.1`.

## Klientga topshirish

Quyidagilar **bir marta**, do'konga o'rnatishdan oldin bajariladi.

**1. Toza do'kon yarating** — demo ma'lumotlarsiz, o'z admin hisobingiz bilan:

```bash
npm run setup -- <login> <parol> "<To'liq ism>"
```

`npm run seed` — bu faqat ishlab chiqish uchun (soxta gilamlar va sotuvlar). Klientga hech qachon
seed qilingan bazani bermang. Agar bazada allaqachon demo ma'lumot bo'lsa, `--reset` qo'shing.

**2. `server/.env` ni sozlang:**

```ini
NODE_ENV=production
JWT_SECRET=<node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
COOKIE_SECURE=false     # HTTPS bo'lmasa (ichki tarmoq). HTTPS bo'lsa: true
TRUST_PROXY=false       # nginx/Render ortida bo'lsa: true
```

> **`COOKIE_SECURE` diqqat!** `true` bo'lsa brauzer sessiya cookie'sini faqat HTTPS orqali saqlaydi.
> `localhost` istisno, shuning uchun sinovda hammasi ishlaydi, lekin do'konda `http://192.168.x.x:4000`
> orqali kirilganda **login jimgina ishlamay qoladi**: server 200 qaytaradi, cookie esa saqlanmaydi va
> foydalanuvchi login sahifasiga qaytariladi. Ichki tarmoqda `false` qiling.

**3. Zaxira nusxani rejalashtiring:**

```bash
npm run backup                 # server/backups/ ichiga
npm run backup -- D:\zaxira    # flesh diskka
```

Butun do'kon ma'lumoti bitta SQLite faylida. Windows Task Scheduler'da kunlik `npm run backup`
qo'ying — bu eng arzon sug'urta. Oxirgi 30 nusxa saqlanadi, eskilari o'chiriladi.

**4. Serverni avtomatik ishga tushishini sozlang.** Loyihada bu yo'q: hozir `npm start` qo'lda
ishga tushiriladi va kompyuter o'chib yonsa qayta ishga tushmaydi. Windows uchun
[NSSM](https://nssm.cc/) yoki Task Scheduler ("At startup") ishlatiladi.

### Demo hisoblar

| Login  | Parol      | Rol           |
|--------|------------|---------------|
| admin  | admin123   | Administrator |
| sardor | sardor123  | Sotuvchi      |

`server/.env` faylida `JWT_SECRET` sozlangan bo'lishi shart. Yangi qiymat yaratish:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Production'da (`NODE_ENV=production`) sozlanmagan yoki 32 belgidan qisqa bo'lsa server ataylab ishga
tushmaydi — bu zaif kalit bilan jimgina ishlab ketishning oldini oladi.

## Autentifikatsiya va rollar

- JWT token `httpOnly` cookie orqali saqlanadi (7 kun amal qiladi).
- Ikki rol: **admin** (to'liq huquq: mahsulot/harajat qo'shish-tahrirlash-o'chirish, foydalanuvchilarni
  boshqarish) va **sotuvchi** (ko'rish + sotuv qo'shish, o'z sotuvini qaytarish va qarzini yopish).
- Himoyalangan sahifalar `ProtectedRoute` / `AdminRoute` orqali frontendda, `requireAuth` / `requireRole`
  middleware orqali backendda ta'minlangan. Frontenddagi yashirilgan tugmalar himoya emas — har bir amal
  backendda qayta tekshiriladi.
- Sotuvchi faqat **o'z** sotuvi bilan ishlay oladi (qaytarish, qarzni yopish); sotuvni butunlay o'chirish
  faqat adminda. Sotuvchi ismi har doim tizimga kirgan foydalanuvchidan olinadi (so'rov tanasidan qabul
  qilinmaydi).
- Login brute-force hujumidan himoyalangan: bir hisobga 15 daqiqada 10 urinish, IP bo'yicha umumiy 60 urinish.
  Cheklov (IP, login) juftligi bo'yicha ishlaydi — do'kondagi barcha xodimlar bitta IP ortida bo'lgani uchun
  bir kishining xato paroli hamkasblarini bloklab qo'ymaydi. Hisoblagichlar SQLite'da saqlanadi, shuning
  uchun serverni qayta ishga tushirish cheklovni nolga qaytarmaydi.
- Reverse proxy ortida ishlaganda `TRUST_PROXY=true` qilish shart, aks holda barcha so'rovlar proxy IP'sidan
  kelgandek ko'rinib, cheklov hammani birga bloklaydi.

### Parol boshqaruvi

- **O'z parolini o'zgartirish** — Profil sahifasi (topbar'dagi ism ustiga bosiladi), joriy parolni
  tasdiqlashni talab qiladi. Foydalanuvchining o'z sessiyasi saqlanadi (yangi token beriladi).
- **Admin tomonidan tiklash** — Foydalanuvchilar sahifasidagi qulf tugmasi. Admin o'z parolini bu yerdan
  tiklay olmaydi (joriy parol tekshiruvini chetlab o'tmaslik uchun) — buning uchun Profil sahifasi.
- Parol o'zgarganda `password_changed_at` yangilanadi va undan **oldin berilgan barcha tokenlar bekor
  bo'ladi**. Ya'ni admin parolni tiklasa, o'sha xodim barcha qurilmalarda darhol tizimdan chiqariladi.

### Admin parolni unutsa

Tizimda email orqali tiklash yo'q, shuning uchun zaxira yo'l — **server turgan kompyuterga jismoniy
kirish**. Loyiha papkasida terminal ochib:

```bash
npm run reset-password                          # foydalanuvchilar ro'yxatini ko'rsatadi
npm run reset-password -- admin YangiParol123   # parolni almashtiradi
```

Agar bironta ham admin qolmagan bo'lsa (masalan yagona admin o'chirilgan), istalgan hisobga admin
huquqini berish mumkin:

```bash
npm run reset-password -- sardor YangiParol123 --make-admin
```

Skript hisobni faollashtiradi va eski sessiyalarni bekor qiladi. Bu yo'l ataylab faqat serverga
kira oladigan odam uchun ochiq — brauzer orqali chetlab o'tib bo'lmaydi.

## Ma'lumotlar bazasi (SQLite, `server/data/myhouseshop.db`)

- `users` — ism, login, parol hash (bcrypt), rol, holat, parol o'zgargan vaqti.
- `products` — nom, kelgan narx, sotish narx, qoldiq.
- `sales` — mahsulot, miqdor, sana, chegirma, yakuniy summa, sotuvchi, holat (faol/qaytarilgan),
  to'lov holati (to'langan/qarz), mijoz ismi va telefoni.
- `expenses` — sana, tavsif, kategoriya, summa.
- `settings` — kam qolgan mahsulot chegarasi, valyuta, dollar kursi (Sozlamalar sahifasidan boshqariladi).
- `login_attempts` — login cheklovi hisoblagichlari.

Sxema o'zgarishlari `server/src/db/index.js` dagi idempotent migratsiyalar orqali qo'llanadi — mavjud
bazani o'chirib qayta yaratish shart emas.

## Sahifalar

1. **Bosh sahifa (Dashboard)** — davr filtri (bugun / 7 kun / 30 kun / hammasi) bo'yicha tushum, harajat,
   sof foyda va sotuvlar soni; kam qolgan mahsulotlar va so'nggi sotuvlar. Mahsulot soni va ombor qiymati
   joriy holatni ko'rsatadi, ularga filtr ta'sir qilmaydi.
2. **Mahsulotlar** — CRUD, nom/ID bo'yicha qidiruv, marja avtomatik hisoblanadi (kategoriyasiz).
3. **Sotuvlar** — mahsulotni qidirib tanlash, miqdor/chegirma, yakuniy summa avtomatik hisoblanadi, qoldiq
   avtomatik kamayadi/qaytariladi. Sana oralig'i, holat, to'lov va matn bo'yicha filtr; sahifalash
   (25 tadan); qarzga sotish va vozvrat; Excel eksport.
4. **Harajatlar** — sana, tavsif, kategoriya, summa (faqat admin qo'sha/o'chira oladi).
5. **Analitika** — haftalik/oylik tushum diagrammasi (Recharts), eng ko'p sotilgan mahsulotlar, harajatlar
   taqsimoti, oylik foyda xulosasi.
6. **Foydalanuvchilar** (faqat admin) — sotuvchi/admin hisoblarini qo'shish, faollashtirish/faolsizlantirish,
   o'chirish.
7. **Sozlamalar** (faqat admin) — kam qolgan mahsulot chegarasi, valyuta (So'm / Dollar switch) va
   dollar kursi. O'zgarishlar barcha sahifalarga darhol ta'sir qiladi.
8. **Profil** (barcha rollar) — hisob ma'lumotlari va parolni o'zgartirish.

## Hisob-kitob mantiqi

- Marja % = (sotish narx − kelgan narx) / sotish narx.
- Sotuv foydasi = yakuniy summa − (kelgan narx × miqdor).
- Sof foyda = jami sotuv foydasi − jami harajatlar.
- Kam qolgan mahsulot chegarasi: standart 5 dona (`settings` jadvalida sozlanadi).

## Qarzga sotish

Sotuv **to'langan** yoki **qarz** bo'ladi — bo'lib to'lash yo'q, qarz bir marta "To'landi" deb
belgilanadi. Qarzga sotishda mijoz ismi majburiy (kim qarzdorligi bilinishi uchun), telefon ixtiyoriy;
ikkalasi ham sotuv yozuvida saqlanadi.

Qarz **daromaddan ayirilmaydi**: sotuv sodir bo'lgan, pul hali kelmagan xolos. Shuning uchun tushum
avvalgidek hisoblanadi, qarzdorlik esa alohida ko'rsatkich sifatida Bosh sahifada va Sotuvlar
sarlavhasida chiqadi.

## Vozvrat (qaytarish)

Mijoz mahsulotni qaytarsa, sotuv **o'chirilmaydi** — `status` `returned` ga o'tadi, qoldiq omborga
qaytadi, yozuv esa tarixda qoladi. Qaytarilgan sotuv barcha hisobotlardan (tushum, foyda, diagramma,
eng ko'p sotilganlar) chiqarib tashlanadi.

O'chirish (`DELETE`) faqat **adminda** qoldi va u xato kiritilgan yozuvni tuzatish uchun — chunki u
tarixni butunlay yo'q qiladi. Sotuvchi o'z sotuvini qaytara oladi, lekin o'chira olmaydi.

## Excel eksport

`exceljs` orqali haqiqiy `.xlsx` yaratiladi (CSV emas). Sotuvlar, Mahsulotlar va Harajatlar
sahifalarida "Excel" tugmasi bor.

- Sotuvlar eksporti **ekrandagi filtrni** aynan takrorlaydi — server ham ro'yxat, ham eksport uchun
  bitta `buildSalesFilter()` dan foydalanadi, shuning uchun ular hech qachon ajralib ketmaydi.
- Summalar **son** sifatida yoziladi (matn emas), ustunga valyuta formati beriladi — shuning uchun
  Excelda ularni qo'shish/saralash mumkin. Dollar tanlangan bo'lsa kurs bo'yicha aylantiriladi.
- Har bir faylda muzlatilgan sarlavha, avtofiltr va oxirida JAMI qatori bor.

## Valyuta va dollar kursi

**Barcha summalar bazada faqat so'mda saqlanadi** — bu yagona haqiqat manbai. Dollar shunchaki ko'rsatish
qatlami: Sozlamalardagi qo'lda kiritiladigan kurs (`usd_rate`, standart 12 800) bo'yicha hisoblanadi.
Kurs o'zgartirilsa butun interfeys qayta hisoblanadi, baza tegilmaydi.

Dollar tanlanganda kiritish maydonlari ham dollarda ishlaydi (`0.01` qadam bilan) va saqlashda kursga
ko'paytirilib so'mga aylantiriladi. Masalan kurs 12 500 bo'lsa, `$10` → `125 000 so'm`.

Bir nozik joy: dollar qiymati sentgacha yaxlitlanadi, shuning uchun tahrirlash oynasini ochib narxni
**o'zgartirmasdan** saqlash saqlangan summani bir necha so'mga siljitishi mumkin edi. Buning oldi olingan —
maydon matni o'zgarmagan bo'lsa, asl so'm qiymati o'zgarishsiz qoladi (`priceToSom` in `Products.jsx`).

Grafikda ustunlar so'm qiymatida chiziladi (nisbatlar bir xil), faqat o'q yorliqlari va tooltip
konvertatsiya qilinadi — shu tariqa qiymat ikki marta aylantirilib yuborilmaydi.

## Dizayn tizimi

Asl `MyhouseShop CRM.html`dan olingan OKLCH rang tokenlari asosida qurilgan (`client/src/styles/tokens.css`):
binafsha aksent, yashil/qizil status ranglari, Inter shrift, 16px radius kartalar, pill-shakldagi
navigatsiya. Yorug'/qorong'u tema almashtirgichi `localStorage`da saqlanadi. Mobil qurilmalarda pastki
navigatsiya paneli va drawer-menyu ishlatiladi (responsive breakpoint: 900px).

Bo'shliqlar `--space-*` tokenlari orqali boshqariladi — bitta joydan o'zgartirsa butun interfeys zichligi
o'zgaradi.

### Logo

`client/public/logo.png` — shaffof fonli, qora chiziqli PNG (512×512, ~45 KB). Asl `logo.jpg` 4994×4974
va 897 KB edi; u kesilib, siqilib va oq foni shaffofga aylantirilib qayta tayyorlangan.

Bitta fayl ikkala temada ishlaydi: qorong'u temada CSS uni `filter: invert(1)` bilan oqqa aylantiradi
(`.brand-logo`), shuning uchun alohida "dark" versiya kerak emas. Logo sidebar'da, mobil topbar'da,
kirish sahifasida va favicon sifatida ishlatiladi (`client/public/favicon.png`, 64×64).

## Keyingi bosqich uchun g'oyalar

- Mijozlar bazasi (hozir mijoz ismi qarz sotuvining ichida saqlanadi, alohida jadval yo'q).
- Chek/kvitansiya chop etish, PDF eksport.
- Ombor kirimi (hozir qoldiq qo'lda tahrirlanadi, kelib tushish tarixi yozilmaydi).
- Zaxira nusxa olish buyrug'i.
- Ko'p do'konli (filial) tizimi.
- PostgreSQL'ga o'tish (hozirgi SQLite bitta server uchun mo'ljallangan).
- Parolni email/SMS orqali o'zi tiklash (hozir tiklashni admin bajaradi).
