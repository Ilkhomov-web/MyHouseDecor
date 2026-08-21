# Deploy: backend → Railway, frontend → Vercel

Ikkala servis alohida domenda ishlaydi, shuning uchun sozlashda uchta narsa
bir-biriga mos bo'lishi shart: **CORS ro'yxati**, **cookie rejimi** va
**`VITE_API_URL`**. Biri noto'g'ri bo'lsa login 200 qaytaradi-yu, foydalanuvchi
login sahifasiga qaytariladi.

---

## 1. Railway (backend)

### 1.1 Servis yaratish

1. Railway → **New Project** → **Deploy from GitHub repo** → shu repo.
2. Servis sozlamalarida **Root Directory** ni `server` qilib belgilang.
   Build/start buyruqlari `server/railway.json` dan olinadi.

### 1.2 Volume — buni o'tkazib yubormang

Baza SQLite fayl. Railway konteynerining diski **vaqtinchalik**: Volume
ulanmasa, har bir deploy'da barcha sotuvlar, mahsulotlar va harajatlar
yo'qoladi.

1. Servis → **Variables** yonidagi **Volumes** → **New Volume**
2. **Mount path:** `/data`
3. `DB_PATH` o'zgaruvchisini `/data/myhouseshop.db` qiling.

Shu sababli `railway.json` da `numReplicas: 1` turibdi — SQLite faylini bir
nechta nusxa bir vaqtda yoza olmaydi. Bu qiymatni oshirmang.

### 1.3 O'zgaruvchilar (Variables)

`JWT_SECRET` ni avval yarating:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

| O'zgaruvchi | Qiymat |
| --- | --- |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | yuqorida yaratilgan qiymat (kamida 32 belgi) |
| `DB_PATH` | `/data/myhouseshop.db` |
| `TRUST_PROXY` | `true` |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `none` |
| `CLIENT_ORIGIN` | `https://<loyiha>.vercel.app,https://*.vercel.app` |
| `ADMIN_USERNAME` | do'kon egasining logini |
| `ADMIN_PASSWORD` | kuchli parol (kamida 8 belgi) |
| `ADMIN_NAME` | `To'liq Ism` |

`PORT` ni qo'lda qo'ymang — Railway o'zi beradi.

`CLIENT_ORIGIN` ni Vercel domeni ma'lum bo'lgach kiritasiz, shuning uchun
odatda avval 2-bosqich bajariladi, keyin bu qiymat qo'shiladi.

> `ADMIN_*` o'zgaruvchilari **faqat foydalanuvchilar jadvali butunlay bo'sh
> bo'lganda** ishlaydi. Qayta deploy mavjud hisobni tiklamaydi va parolni
> almashtirmaydi. Birinchi kirishdan keyin ularni Railway'dan o'chirib
> tashlang va profil sahifasidan parolni yangilang.

### 1.4 Tekshirish

Deploy tugagach Railway bergan manzilni oching:

```
https://<servis>.up.railway.app/api/health
```

`{"ok":true,"name":"MyhouseShop CRM API"}` chiqishi kerak.

---

## 2. Vercel (frontend)

1. Vercel → **Add New Project** → shu repo.
2. **Root Directory:** `client`. Framework `Vite` deb aniqlanadi, qolgan
   sozlamalar `client/vercel.json` dan olinadi.
3. **Environment Variables** → Production (va Preview) uchun:

   ```
   VITE_API_URL = https://<servis>.up.railway.app/api
   ```

   Oxiridagi `/api` shart, oxirida `/` bo'lmasin.
4. Deploy.

`VITE_API_URL` build paytida bundle ichiga yoziladi — keyinchalik
o'zgartirsangiz, **qayta deploy qilish kerak**.

---

## 3. Yakuniy bog'lash

Vercel domeni ma'lum bo'lgach, Railway'dagi `CLIENT_ORIGIN` ni yangilang:

```
https://myhouse.vercel.app,https://*.vercel.app
```

Ikkinchi yozuv preview deploy'lar uchun. Preview'lar kerak bo'lmasa, uni
tashlab yuboring — ro'yxat qanchalik tor bo'lsa, shunchalik yaxshi.

Railway o'zgaruvchi o'zgarganda servisni avtomatik qayta ishga tushiradi.

---

## 4. Production'da test ma'lumot yo'qligini tekshirish

Loyihada demo ma'lumotlar `npm run seed` orqali qo'shiladi va u
**`NODE_ENV=production` bo'lganda ishlashdan bosh tortadi**. Deploy jarayonida
bu buyruq umuman chaqirilmaydi.

Deploy'dan keyin tekshirish ro'yxati:

- [ ] Login sahifasida hech qanday demo login/parol ko'rsatilmaydi
      (u faqat `import.meta.env.DEV` da chiqadi va production build'da
      butunlay olib tashlanadi).
- [ ] Login maydonining placeholder'i `Loginingiz` — hisob nomini ishora
      qilmaydi.
- [ ] Mahsulotlar sahifasi bo'sh (`Gilam "Klassik" 2x3` kabi demo yozuvlar
      bo'lmasligi kerak).
- [ ] Sotuvlar va Harajatlar sahifalari bo'sh.
- [ ] `admin / admin123` bilan kirib bo'lmaydi.

Agar demo ma'lumot baribir ko'rinsa, bu bazada eski nusxa qolganini
bildiradi. Railway CLI orqali tozalang:

```bash
railway link
railway run npm run setup -- <login> <parol> "<To'liq ism>" --reset
```

`--reset` barcha sotuv, mahsulot, harajat va foydalanuvchilarni o'chiradi.

---

## 5. Zaxira nusxa

Volume ham buzilishi mumkin, shuning uchun vaqti-vaqti bilan:

```bash
railway run npm run backup
```

---

## Tez-tez uchraydigan xatolar

**Login 200 qaytaradi, lekin sahifa qayta login so'raydi.**
Cookie saqlanmayapti. `COOKIE_SECURE=true` va `COOKIE_SAMESITE=none`
ekanini tekshiring — alohida domenlarda `lax` cookie brauzer tomonidan
umuman yuborilmaydi.

**Brauzer konsolida CORS xatosi.**
`CLIENT_ORIGIN` dagi manzil brauzerdagi manzil bilan aynan bir xil
bo'lishi kerak: `https://` bilan, oxirida `/` siz.

**So'rovlar `localhost:4000` ga ketyapti.**
Vercel'da `VITE_API_URL` qo'yilmagan yoki qo'yilgandan keyin qayta deploy
qilinmagan.

**Deploy'dan keyin baza bo'shab qoladi.**
Volume ulanmagan yoki `DB_PATH` Volume mount path'idan tashqarida
(`/data/...` bo'lishi shart).

**Barcha foydalanuvchilar login urinishida bloklanmoqda.**
`TRUST_PROXY=true` qo'yilmagan — proxy ortida hamma so'rov bitta IP dan
kelgandek ko'rinadi.
