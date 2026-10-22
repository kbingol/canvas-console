# Canvas Console

Bağımsız model gateway'i için müşteri ve operatör paneli ile API yönetim temeli. Web React + TypeScript + Fluent UI v9, API Fastify, kalıcı veri Firestore kullanır. Ortak tipler npm workspace paketinde tutulur.

**Bu sürüm tamamlanmış inference veya ücretli model servisi değildir.** Sağlayıcıya model çağrısı, ödeme tahsilatı ve üretim muhasebe mutabakatı henüz bağlı değildir. Demo verisi gerçek kullanım göstermez. Hiçbir sağlayıcı veya ödeme credential'ı repoya eklenmez.

## Yerelde başlatma

Node.js 22.12 veya üstü ve npm gerekir. Bağımlılık kurulumunda npm 10.9.8 kullanılır. Komutları repo kökünde çalıştırın:

```powershell
npx --yes npm@10.9.8 ci
Copy-Item apps/api/.env.example apps/api/.env.local
Copy-Item apps/web/.env.example apps/web/.env.local
npm run dev
```

`packageManager` alanı sürümü kaydeder; npm bunu kendiliğinden zorlamaz. npm 11'deki [workspace/override hatası](https://github.com/npm/cli/issues/9514) güvenlik override'ını yok sayabildiği için kurulum ve bağımlılık güncellemelerini sabit sürümle yapın. Global npm'i değiştirmeniz gerekmez; kurulumdan sonra normal `npm run dev` kullanılabilir.

Demo için API'de `APP_MODE=demo`, web'de `VITE_APP_MODE=demo` kullanın. Demo yalnız development ortamında loopback üzerinde çalışır; uzaktan erişim için açılmaz. API ve web env dosyaları kendi workspace dizinlerinden yüklenir.

Web: `http://127.0.0.1:5173`. API: `http://127.0.0.1:8080`. Port değişirse web'in API adresini ve API'nin `WEB_ORIGIN` değerini birlikte güncelleyin.

```powershell
npm run check
```

Bu komut tip kontrolünü, testleri ve production build'ini çalıştırır. Tek tek `npm run typecheck`, `npm test`, `npm run build` da kullanılabilir. CI aynı kontrolü Node 22 ile çalıştırır.

## Firebase ile çalışma

Mevcut platformun ortak kimlik projesi `algomim-agents` kullanılır. Firebase web ayarları public yapılandırmadır; Admin SDK credential'ı değildir. Gerçek mod için:

1. `apps/web/.env.local` içinde `VITE_APP_MODE=firebase` ve public Firebase ayarlarını girin.
2. `apps/api/.env.local` içinde `APP_MODE=firebase`, `FIREBASE_PROJECT_ID=algomim-agents` ayarlayın.
3. Yerelde `GOOGLE_APPLICATION_CREDENTIALS` ile mevcut service-account dosyasının dışarıdaki yolunu referans verin. Dosyayı bu repoya kopyalamayın. Production'da Cloud Run service account'u ve Application Default Credentials kullanın.
4. Gerekirse ilk operatör UID'sini server tarafındaki `ADMIN_UIDS` listesine ekleyin. Bu değer web env'ine konulmaz.

Firebase modu gerçek projeye bağlanabilir ve API işlemleri veri yazabilir. Yerel ortamın seçimi bu nedenle bilinçli yapılmalıdır. Bu kurulum sırasında Firebase, Hosting, Cloud Run veya rules deployment'ı yapılmaz.

Panel Firebase ID token'ıyla, model API istemcileri ise servisimizin kendi API anahtarıyla kimlik doğrular. Browser Firestore'a doğrudan erişmez. Firestore Admin SDK rules'ı atladığı için tenant ve rol kontrolleri API'de uygulanır.

## Dizinler ve sınırlar

| Dizin | Sorumluluk |
| --- | --- |
| `apps/web` | Müşteri/operatör arayüzü, tema ve Firebase giriş akışı |
| `apps/api` | Kimlik doğrulama, yetki, model/anahtar yönetimi ve veri erişimi |
| `packages/contracts` | Web ve API'nin paylaştığı tipler |
| `docs` | Firebase sınırları, veri modeli ve arayüz kararları |

API sözleşmesi ve desteklenen işlemler için [backend belgesi](docs/backend.md), veri düzeni için [veri modeli](docs/data-model.md), yerel/emülatör ve Hosting ayrımı için [Firebase notları](docs/firebase.md), arayüz için [tasarım kararları](docs/design.md).

`firebase.json` yerel bir başlangıç şablonudur. **Bu repodan ortak projeye genel `firebase deploy` veya rules deploy çalıştırmayın:** deny-all kurallar mevcut platformun kurallarının yerine geçer. Ayrı Hosting target'ı ve proje kurallarını birleştirme sınırları Firebase belgesinde açıklanır.
