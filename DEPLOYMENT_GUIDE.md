# راهنمای استقرار و پیکربندی سامانه حضور و غیاب آزمایشگاه ترنج (Toranj Lab)
## دامنه هدف: `https://app.nexahealth.ir`

این راهنما مراحل کامل آماده‌سازی، تنظیم متغیرهای محیطی، اتصال دامنه اختصاصی، پیکربندی امنیت و راه‌اندازی در محیط ابری (Cloud Run / VPS / Firebase) را تشریح می‌کند.

---

### ۱. معماری و پیش‌نیازها
- **فرانت‌اند**: React 19 + TypeScript + Tailwind CSS (RTL و تقویم جلالی).
- **بک‌اند**: Node.js + Express (مسئول تولید مهرهای زمانی معتبر سرور، محاسبه فواصل Haversine، کنترل وضعیت نشست‌ها و اعمال دسترسی‌ها).
- **پایگاه داده**: دیتابیس ماندگار در مسیر `/data/toranj_db.json` یا پایگاه‌داده ابری Cloud Firestore / PostgreSQL.

---

### ۲. متغیرهای محیطی (`.env`)
در سرور پروداکشن، متغیرهای زیر را در فایل `.env` یا در تنظیمات Cloud Run تنظیم فرمایید:

```env
NODE_ENV=production
PORT=3000

# دامنه رسمی سامانه
APP_URL=https://app.nexahealth.ir

# کلید رمزنگاری نشست‌ها و توکن‌ها (یک عبارت تصادفی حداقل ۳۲ کاراکتری)
SESSION_SECRET=toranj_lab_jwt_secure_super_secret_key_2026

# مختصات مرکز آزمایشگاه ترنج (تهران)
LAB_LATITUDE=35.7592
LAB_LONGITUDE=51.4116
LAB_ALLOWED_RADIUS_METERS=100
LAB_LATENESS_TOLERANCE_MINUTES=15
```

---

### ۳. مراحل استقرار پروداکشن (Deployment Steps)

#### روش ۱: استقرار با داکر / Google Cloud Run (پیشنهادی)
یک فایل `Dockerfile` در ریشه پروژه قرار دهید:
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src/types ./src/types
EXPOSE 3000
CMD ["npm", "start"]
```
دستور ساخت و استقرار:
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/toranj-app
gcloud run deploy toranj-attendance \
  --image gcr.io/PROJECT_ID/toranj-app \
  --platform managed \
  --region europe-west2 \
  --allow-unauthenticated \
  --port 3000
```

#### روش ۲: استقرار روی سرور اختصاصی ابری ایران / اوبونتو (Nginx + PM2)
```bash
# نصب پکیج‌ها و بیلد
npm ci
npm run build

# راه‌اندازی با PM2
pm2 start server.ts --name toranj-lab --interpreter ./node_modules/.bin/tsx
pm2 save
```

---

### ۴. اتصال دامنه اختصاصی (`app.nexahealth.ir`)

#### الف) تنظیم رکوردهای DNS
به پنل مدیریت دامنه خود (ثبت‌کننده دامنه یا Cloudflare / ابرآروان) مراجعه کرده و رکورد زیر را اضافه فرمایید:

| نوع رکورد | نام میزبان (Host) | مقدار (Target) | TTL |
| :--- | :--- | :--- | :--- |
| **CNAME** | `app` | آدرس سرور یا CNAME ارائه‌شده توسط Cloud Run | خودکار / Auto |
| **A** (در صورت استفاده از سرور اختصاصی) | `app` | `IP.ADDRESS.OF.SERVER` | 300 ثانیه |

#### ب) کانفیگ Nginx معکوس (Reverse Proxy) + SSL رایگان Let's Encrypt
```nginx
server {
    listen 80;
    server_name app.nexahealth.ir;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.nexahealth.ir;

    ssl_certificate /etc/letsencrypt/live/app.nexahealth.ir/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.nexahealth.ir/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
دریافت گواهی SSL:
```bash
certbot --nginx -d app.nexahealth.ir
```

---

### ۵. چک‌لیست امنیتی پروداکشن (Security Checklist)
- [x] تولید و ذخیره مهرهای زمانی تردد صرفاً توسط سرور (غیرقابل دستکاری با ساعت گوشی).
- [x] اعتبارسنجی شعاع مجاز GPS با فرمول ریاضی Haversine روی بک‌اند.
- [x] عدم مسدودی خروج پرسنل در صورت باز بودن وظایف اجباری (ماده ۱۲ ضوابط ترنج).
- [x] ماسک کردن شماره حساب بانکی و شبا برای کاربران عادی و سرپرستان.
- [x] جلوگیری از تایید وظایف شخصی توسط خود فرد (Self-approval prohibition).
- [x] لاگ ممیزی غیرقابل حذف (Append-only Audit Log) برای تمام تغییرات پرسنلی و شیفت‌ها.
- [x] سازگاری کامل با خروجی‌های اکسل حاوی حروف فارسی (BOM UTF-8).
