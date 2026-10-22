# Firebase ortam sınırları

Ortak kimlik projesi `algomim-agents`; auth domain `algomim-agents.firebaseapp.com`, mevcut bucket `algomim-agents.firebasestorage.app`. Bu değerler public web yapılandırmasıdır. Sağlayıcı anahtarları, service-account JSON'u, ödeme secret'ları ve erişim token'ları web bundle'ına girmez.

## Yerel credential ve production

API Firebase Admin SDK kullanır. Yerelde `GOOGLE_APPLICATION_CREDENTIALS` dışarıdaki mevcut dosyayı işaret edebilir; `FIREBASE_PROJECT_ID` hedef projeyi açıkça belirtir. `.env.local` ve service-account dosyaları git ve Docker context'inden dışlanır. Credential dosyası repoya kopyalanmaz.

Cloud Run'da credential JSON'u taşımak yerine atanmış service account'un Application Default Credentials kimliği kullanılır. Backend'in IAM yetkileri ile uygulamanın tenant/rol yetkileri farklı kontrollerdir. Admin SDK, Firestore Security Rules'ı uygulamaz; uygulama erişimini API denetler.

Auth için ortak projeyi kullanmak, uygulamaların veri modellerini veya bütün yetkilerini paylaşmak anlamına gelmez. Bu uygulama yalnız `canvasConsole/v1` namespace'ini kullanır. Ayrı geliştirme ve production projeleri kullanılacaksa her ortamın proje/credential eşlemesi açıkça yapılmalıdır.

Web Google popup ile giriş yapar. Firebase Authentication'da Google provider ve kullanılan web adresinin authorized domains kaydı etkin olmalıdır. Production web build'inde `VITE_APP_MODE=firebase` ve `VITE_API_URL` olarak API'nin HTTPS origin'i ayarlanır; API'deki `WEB_ORIGIN` web sitesinin origin'iyle aynı olmalıdır. Identity Platform tenant kullanılırsa web `VITE_FIREBASE_TENANT_ID` ve API `FIREBASE_TENANT_ID` eşleşmelidir.

## Yerel rules ve emülatör

`firestore.rules` ve `storage.rules` bütün browser erişimini kapatan başlangıç şablonlarıdır. Bu repoda browser Firestore erişimi veya dosya yükleme özelliği yoktur. API'deki IAM erişimi bu kurallardan bağımsızdır. `firestore.indexes.json` başlangıçta boştur; yeni sorgu gerçekten gerektirdiğinde index eklenir.

Firebase CLI ile emülatörleri başlatmak için Java kurulu olmalıdır; kurulu CLI sürümünün Java gereksinimini izleyin. Demo çalışması veya standart `npm run check` için emülatör gerekmez.

```powershell
npx firebase-tools emulators:start --project demo-canvas-console --only auth,firestore,storage
```

Portlar: Auth 9099, Firestore 8081, Storage 9199, Emulator UI 4000. `demo-` proje kimliği canlı projeden ayrıdır. Bu komut emülatörleri başlatır; uygulamaya ait uçtan uca emülatör test paketi bu sürümün standart kontrolüne dahil değildir. Emülatör kullanacak backend için `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST` ayarları yalnız ilgili yerel süreçte bulunmalıdır. Production'a taşınmaz.

Emülatöre bağlanan uygulamalarda mod yine `firebase` olmalıdır. API `FIREBASE_PROJECT_ID=demo-canvas-console`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8081`; web `VITE_FIREBASE_PROJECT_ID=demo-canvas-console`, `VITE_FIREBASE_API_KEY=demo-key`, `VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099` kullanır. Gerçek servis hesabını bu emülatör sürecine bağlamayın.

## Hosting ayrı hedefle bağlanır

Repoda mevcut platforma ait site ID'si veya varsayılan proje seçen `.firebaserc` yoktur. `firebase.json` yalnız `canvas-console` adlı Hosting target'ını tanımlar. Mevcut `algomim-agents` veya `algomim-website` Hosting sitelerine target atamayın.

İleride yayın kararı verildiğinde, ayrı ve henüz kullanılmayan bir site ID'si seçilerek aşağıdaki adımlar uygulanabilir. Bunlar otomatik kurulumun parçası değildir:

```powershell
npx firebase-tools hosting:sites:create YOUR_NEW_SITE_ID --project algomim-agents
npx firebase-tools target:apply hosting canvas-console YOUR_NEW_SITE_ID --project algomim-agents
npm run build
npx firebase-tools deploy --only hosting:canvas-console --project algomim-agents
```

Bu dar deployment yalnız seçilen Hosting target'ını yayımlar. Genel `firebase deploy`, `--only firestore` veya `--only storage` komutlarını bu repodan ortak projede çalıştırmayın. Buradaki deny-all şablonlar mevcut platformun proje çapındaki kurallarının yerine geçebilir. Rules değişiklikleri ortak platform kurallarıyla birleştirilmeli ve emülatörde doğrulanmalı; alternatif olarak uygulamaya ayrı veri projesi/bucket tahsis edilmelidir.

Web'in API URL'si bağımsızdır. Gelecekte uzun SSE/model çağrıları API'nin doğrudan Cloud Run adresi veya uygun API domain'i üzerinden akmalıdır; Firebase Hosting rewrite'ının 60 saniyelik süresi uzun çağrılar için kullanılmaz.

## Container

Dockerfile API workspace'ini derler; web ayrı Hosting dağıtımıdır. Image build'e credential veya `.env.local` dahil edilmez. Runtime'da `APP_MODE=firebase`, `FIREBASE_PROJECT_ID`, uygun `WEB_ORIGIN` ve Cloud Run service account'u ayarlanır. Production demo modu desteklenmez. Image'i build etmek remote deployment yapmaz:

```powershell
docker build -t canvas-console-api .
```

Kaynaklar: [Firebase Admin token doğrulama](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Firestore server SDK yetkileri](https://firebase.google.com/docs/firestore/client/libraries), [Firebase Hosting / Cloud Run sınırı](https://firebase.google.com/docs/hosting/cloud-run).
