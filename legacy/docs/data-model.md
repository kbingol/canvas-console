# Veri modeli ve para işlemleri

Firestore namespace'i sabittir: `canvasConsole/v1`. Mevcut platformun `users`, `orders`, `subscriptions` veya `meters` koleksiyonları bu uygulamanın verisi değildir.

```text
canvasConsole/v1
├─ users/{uid}
├─ providers/{providerId}
└─ workspaces/{workspaceId}
   ├─ keys/{keyId}
   ├─ usage/{usageId}
   ├─ ledger/{entryId}
   ├─ walletOperations/{operationId}
   └─ reservations/{reservationId}
```

| Kayıt | Amaç |
| --- | --- |
| `users/{uid}` | Server tarafından tutulan `uid`, `workspaceId`, `role`, `status` eşlemesi |
| `providers/{id}` | Platformun sağlayıcı tanımları; okuma/yazma rolü API tarafından denetlenir |
| `workspaces/{id}` | Hesap bilgisi ve `balanceMicros`, `reservedMicros`, `currency` cüzdan özeti |
| `keys/{id}` | Workspace'e ait API anahtarı kaydı; secret değeri liste cevaplarına veya loglara konulmaz |
| `usage/{id}` | Çalıştırmanın kullanım ve maliyet kaydı; ödeme işlemiyle aynı şey değildir |
| `ledger/{id}` | Tamamlanmış para hareketi; düzeltme eski kaydı değiştirmek yerine yeni hareket üretir |
| `walletOperations/{id}` | Tekrarlanan işlemin aynı sonucu vermesini sağlayan idempotency kaydı |
| `reservations/{id}` | İstek öncesi ayrılmış tutar ve tamamlanma/serbest bırakma durumu |

API, workspace'i güvenilir kimlik eşlemesinden çözer. İstemcinin ilettiği bir workspace ID tek başına erişim yetkisi vermez. Operatör yetkisi müşteri workspace rolünden ayrıdır.

## Para birimi ve transaction sınırı

`Micros`, para biriminin milyonda biridir; örneğin 1 USD = 1.000.000 micros. Bu alanlar güvenli tamsayı olarak doğrulanır. `currency` farklı para birimlerinin sessizce toplanmasını engeller. Kullanılabilir tutar `balanceMicros - reservedMicros` üzerinden hesaplanır.

Para işlemleri yalnız server transaction'ında yürür. İşlem kimliği önce kontrol edilir; aynı idempotency anahtarı aynı işlem için tekrar kullanıldığında ikinci para hareketi oluşmaz. Aynı anahtarla farklı tutar/işlem gönderilmesi hata olmalıdır.

Hedef inference akışı:

1. Transaction: cüzdanı kontrol et, tutarı rezerve et, rezervasyon ve işlem kaydını oluştur.
2. Transaction dışında: sağlayıcıya isteği gönder, sağlayıcı istek/iş kimliğini kaydet.
3. Transaction: gerçek ücreti ledger'a ekle, bakiyeyi düş, rezervasyonu kaldır ve işlemi tamamlandı olarak işaretle.
4. Ücret oluşmadığı doğrulanmışsa transaction ile rezervasyonu serbest bırak.

Firestore transaction callback'i yeniden çalışabilir. İçinde upstream model çağrısı, ödeme tahsilatı, webhook gönderimi veya e-posta bulunmaz. Zaman aşımı sağlayıcıdaki işi otomatik olarak iptal etmez; bilinmeyen sonuç uzlaştırılmadan aynı ücretli istek yeniden başlatılmaz veya tutar iade edilmez.

Bu sürümdeki cüzdan işlemleri, gerçek ödeme ve inference muhasebesinin tamamlandığı anlamına gelmez. Provider adapter'ı, ödeme webhook doğrulaması ve mutabakat bağlanmadan ücretli servis ilan edilmemelidir. Aynı wallet belgesindeki paralel işlemler contention oluşturabileceğinden concurrency limiti ve yük testiyle kapasite ölçülmelidir.
