# جسر Interactive Brokers لترقّب

يعطي ترقّب **أسعار خيارات لحظية رسمية (OPRA)** من حسابك في Interactive Brokers، بتكلفة بيانات نحو 1.5–4.5$ شهرياً + خادم صغير نحو 5$.

الجسر **يحاكي واجهة Tradier** التي بُني عليها ترقّب (الأسعار، السلاسل، تواريخ الانتهاء، الساعة)، فتبقى كل فحوص الحداثة وبوابات الدخول المعايرة كما هي. يكفي أن تضع رابطه ومفتاحه في Vercel.

```
ترقّب (Vercel) ──HTTPS + مفتاح سري──▶ Caddy ─▶ bridge (FastAPI) ─▶ IB Gateway ─▶ Interactive Brokers
```

## الأمان
- **قراءة فقط:** الاتصال بـ IB مفتوح بـ `readonly=True`، والبوابة تعمل بـ `READ_ONLY_API=yes`، والجسر لا يحوي أي كود أوامر.
- كل طلب يحتاج `Authorization: Bearer <BRIDGE_TOKEN>`.
- المنفذ الوحيد المفتوح للعالم: 443 (و80 لشهادة HTTPS). منفذ IB Gateway داخلي فقط.
- كلمة مرور IBKR تُكتب **على الخادم فقط** في ملف `.env` — لا في GitHub ولا في محادثة.

## المتطلبات (عليك)
1. **حساب Interactive Brokers** معتمد وممول حسب شروطهم، مع تفعيل **IBKR Mobile** للتحقق الثنائي.
2. **اشتراك بيانات السوق** من Client Portal ← Settings ← Market Data Subscriptions، بصفة **Non-Professional**:
   - **OPRA Top of Book** (خيارات أمريكية لحظية) — نحو 1.5$، أو
   - **US Equity and Options Add-On Streaming Bundle** (أسهم + خيارات) — نحو 4.5$، وهو الأفضل لأن ترقّب يحتاج SPY/QQQ لحظياً أيضاً.
   - اختياري: اشتراك مؤشرات **Cboe** لقيمة SPX/VIX الرسمية لحظياً. بدونه يُحسب SPX من SPY اللحظي (كما يفعل ترقّب أصلاً).
3. **خادم VPS صغير:** Ubuntu 24.04، 2 معالج و2–4 جيجا ذاكرة (مثل Hetzner CX22 أو DigitalOcean 6$).
4. **نطاق فرعي** مثل `ibkr.trqob.com` بسجل A يشير إلى عنوان IP الخادم.

## التشغيل
على الخادم:
```bash
# 1) Docker
curl -fsSL https://get.docker.com | sh

# 2) الجدار الناري: SSH + HTTPS فقط
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

# 3) ملفات الجسر
git clone https://github.com/<حسابك>/taraqob.git && cd taraqob/ibkr-bridge
cp .env.example .env
openssl rand -hex 24          # انسخ الناتج إلى BRIDGE_TOKEN
nano .env                     # اكتب بيانات IBKR والنطاق والمفتاح

# 4) التشغيل
docker compose up -d --build
docker compose logs -f ib-gateway   # وافق على إشعار الدخول في تطبيق IBKR Mobile
```

## التحقق
```bash
curl https://ibkr.trqob.com/health
# {"ok":true,"connected":true,...}

curl -H "Authorization: Bearer <BRIDGE_TOKEN>" "https://ibkr.trqob.com/v1/markets/quotes?symbols=SPY"
```
أثناء الجلسة يجب أن يظهر `"delayed": false` و`bid_date` غير فارغ.

## الربط بترقّب (Vercel ← Settings ← Environment Variables، نوع Secret)
| الاسم | القيمة |
|---|---|
| `IBKR_BRIDGE_URL` | `https://ibkr.trqob.com` |
| `IBKR_BRIDGE_TOKEN` | نفس `BRIDGE_TOKEN` |

ثم **Redeploy**. متى وُجد الاثنان يصبح الجسر هو المصدر المباشر المعتمد، ويبقى Alpaca المجاني احتياطياً.

## التشغيل اليومي
- IB Gateway يُعاد تشغيله تلقائياً كل ليلة 11:45 م بتوقيت نيويورك (خارج الجلسة).
- **مرة أسبوعياً** (عادة الأحد) تطلب IBKR إعادة التحقق: وافق على الإشعار في IBKR Mobile.
- عند أي انقطاع يعود ترقّب للمحاولة بعد دقيقتين، ويستخدم Alpaca المؤجل في الأثناء (موسوماً غير معتمد للدخول).

## حدود معروفة
- **لم يُختبر بعد على حساب IBKR حقيقي** — الأجزاء الصافية مختبرة (`python -m unittest test_tradier_format`)، والاتصال الفعلي يُتحقق منه عند أول تشغيل.
- IB يسمح بنحو 100 خط بيانات متزامن: السلسلة تُجلب على دفعات (حتى 120 عقداً قرب السعر) وتُخزّن 20 ثانية؛ الأسعار المطلوبة للتحقق قبل الدخول تبقى مفتوحة لحظياً.
- ساعة السوق لا تعرف العطل الرسمية الأمريكية.
- **الترخيص:** اشتراك Non-Professional للاستخدام الشخصي. عرض الأسعار اللحظية الخام لمشتركين يدفعون يحتاج ترخيصاً تجارياً — ترقّب يستخدمها لصناعة القرار.
