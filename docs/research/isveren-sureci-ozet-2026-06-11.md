# İşveren Tarafı İşe Alım Süreci — Özet Rapor

Tarih: 2026-06-11
Amaç: HR-ops (Talent-Ops) projesinin iş (business) temelini netleştirmek.
Kaynaklar: `Talent Ops Proje Analizi.md` (vizyon analizi) + `talent-ops-ux-research-2026-06-11.md` (kamu kaynaklı UX araştırması). Bu doküman ikisinin sentezidir; üç soruya göre düzenlenmiştir.

---

## Soru 1: Bir işveren aradığı elemanı nasıl bulur? Kıstaslar nelerdir?

### Nereden bulur (kanallar)

| Kanal | Açıklama | Not |
| --- | --- | --- |
| **Inbound** | İlana gelen başvurular: kariyer sayfası, iş panoları (LinkedIn, Indeed, kariyer.net vb.) | En yaygın kanal, ama sinyal kalitesi en düşük olan |
| **Outbound (sourcing)** | Aktif arama: LinkedIn taraması, GitHub maintainer'ları, Kaggle yarışmacıları, StackOverflow, konferans konuşmacıları, akademik yayınlar | Pasif adaylara (iş aramayanlara) ulaşmanın tek yolu; en iyi adaylar genelde burada |
| **Referans** | Çalışan tavsiyeleri | Hızlı ama önyargı (bias) riski yüksek; hacim baskısı altında recruiter'lar buna aşırı yaslanıyor |
| **Talent memory** | Geçmişte başvurmuş/reddedilmiş güçlü adayların yeniden keşfi ("silver medalist" — finale kalıp seçilmeyenler) | Mevcut ATS'lerde en zayıf halka: adaylar "ölü kayda" dönüşüyor, her rolde sourcing sıfırdan başlıyor |

### Neye göre değerlendirir (kıstaslar)

İyi işleyen süreçte kıstaslar ilandan önce, **rol tasarımından türetilen "aday personası"** olarak tanımlanır (örn. "AI/SaaS deneyimli, Python + Kubernetes bilen, 5-8 yıl tecrübeli"). Değerlendirme 5 katmanlıdır:

1. **Sert filtreler** — lokasyon, çalışma izni, asgari dil seviyesi. İkili (geçti/kaldı) kontroller.
2. **Yetkinlik eşleşmesi (skill match)** — beceri uyumu. Modern yaklaşım birebir kelime eşleşmesi değil *yakınlık*: ilan "Tableau" istiyorsa ve adayda "PowerBI" varsa, geleneksel ATS eler; doğrusu kısmi puan vermektir (ikisi de iş zekâsı ailesinde, hızla öğrenilir).
3. **Deneyim eşleşmesi** — istenen süre vs adayın sektör derinliği.
4. **Kanıt eşleşmesi (evidence match)** — CV'deki iddianın dış kaynakla teyidi: GitHub'da o teknolojiyle yazılmış kod var mı? Blog yazısı, yayın, sertifika, üretim (production) hikâyesi var mı? **Temel felsefe: "CV ≠ Aday"** — CV sübjektif bir beyandır, karar kanıta dayanmalıdır.
5. **Davranışsal sinyaller** — açık kaynak topluluğunda liderlik, konferans konuşmaları, problem çözme hızı.

### Sektör gerçekleri (neden bu kadar zor)

- İşe alım liderlerinin **%58'i CV'deki becerileri doğrulayamıyor**, %47'si kültür uyumunu ölçemiyor, %43'ü nitelikli aday bulamıyor (TestGorilla/TechRadar, 2025).
- En iyi adayların **%58'i süreç yavaş ilerlediği için** sistemden kopuyor.
- Recruiter zamanının **%52'si idari işlere** gidiyor (veri girişi, takvim, ATS güncellemesi); gerçek değerlendirmeye kalan pay küçük.
- Paradoks: şirketler "çok başvuru alıyor" ama hâlâ "nitelikli aday bulamıyor" — problem aday kıtlığı değil, **sinyal ayrıştırma** problemi.

---

## Soru 2: İş ilanını nasıl açar?

### Adım adım akış

1. **İşgücü planlaması** — "Neden işe alıyoruz?" Pozisyonun iş hedefiyle bağı, bütçe kısıtı, aciliyet, başarı metrikleri. Boş koltuk doldurma refleksi yerine gerekçeli talep. (Doldurulamayan her pozisyon haftada ~4.000 USD verimlilik kaybı.)
2. **Rol tasarımı** — Hiring manager (işe alımı talep eden yönetici) ile kalibrasyon. Cevaplanması gereken sorular:
   - Adayın **ilk 90 gündeki** somut başarı hedefleri ne?
   - Hangi yetkinlik **olmazsa olmaz**, hangisi öğretilebilir?
   - "Bu işe alım 90 günde nasıl başarısız olur?" (ters senaryo)
   - Çıktı: yazılı, onaylı bir **rol sözleşmesi (Role Decision Contract)** — iş ihtiyacı, başarı çıktıları, must-have kanıtları, elenme kriterleri, mülakat planı, skor ağırlıkları.
3. **Aday personası** — Rol sözleşmesinden ideal profil modeli çıkarılır (Soru 1'deki kıstasların kaynağı).
4. **İlan metni (JD) üretimi** — Rol özeti, sorumluluklar, gereksinimler, yan haklar, mülakat süreci. İki kalite kontrolü:
   - **Bias temizliği:** "Rockstar", "ninja", "genç", "agresif" gibi yaş ayrımcılığı/toksik kültür sinyali veren ifadeler çıkarılır.
   - **Gereksinim disiplini:** Persona'da olmayan "olsa iyi olur" şişirmeleri eklenmez (şişkin ilan = yanlış başvuru havuzu).
5. **Yayın** — Kariyer sayfası + seçilen panolar; başvuruların tek havuzda (ATS/tracker) toplanması.

### Kritik bulgu: süreç nerede kırılıyor?

Yaygın kanının aksine süreç ilan *metninde* değil, **rol tanımı aşamasında** kırılıyor:

- İşe alım "kıdemli bir AI mühendisi al" gibi belirsiz bir taleple başlıyor.
- Recruiter belirsiz kriterlerle sourcing yapıyor; hiring manager adayları gördükçe beklentiyi değiştiriyor (**criteria drift**).
- Bu yüzden modern pratik: rol sözleşmesi hiring manager tarafından **onaylanmadan** ilan yayınlanmaz, sourcing başlamaz. Beklenti değişirse sözleşme açıkça revize edilir (sessizce kayması engellenir).

---

## Soru 3: İlana gelen CV'leri nasıl tasnif eder?

### Problem boyutu

- Ortalama ilan **242 başvuru** alıyor (2017'nin ~3 katı); recruiter başına başvuru oranı **500:1** (Greenhouse verisi / Business Insider, 2025).
- Bu hacimde doğrusal inceleme imkânsız → recruiter'lar "acil durum triage'ına" düşüyor: sadece ilk gelenleri okumak, referanslılara öncelik, kaba anahtar kelime filtresi. Sonuç: **nitelikli ama bariz olmayan adaylar kayboluyor**.
- CV'lerin artan kısmı AI ile yazılıyor/optimize ediliyor → anahtar kelime sinyali değersizleşti.

### Geleneksel vs kanıta dayalı tasnif

| | Geleneksel ATS | Kanıta dayalı (önerilen) |
| --- | --- | --- |
| Birim | CV (belge) | İddia (claim) + kanıt |
| Yöntem | Anahtar kelime eşleşmesi | Kaynaklı kanıt + güven skoru |
| Skor | Tek bileşik puan (kara kutu) | Ayrıştırılabilir: sert filtre / beceri / deneyim / kanıt / davranış |
| Red | Otomatik, sebepsiz | Sebep kodlu, insan onaylı |
| Sonrası | Kayıt ölür | Talent memory'ye yazılır (neden reddedildi, hangi role uyar, ne zaman tekrar bakılmalı) |

### Modern tasnif akışı

1. **Ön işleme:** CV ayrıştırma (parse), normalizasyon, tekilleştirme (dedupe), sert filtreler.
2. **Evidence Ledger:** Her aday için iddia → kaynak (CV/LinkedIn/GitHub/mülakat) → kanıt → güven skoru → doğrulama durumu (doğrulanmadı / AI çıkarımı / insan onaylı / çelişkili). "Beceri beyanı" ile "beceri kanıtı" ayrı tutulur.
3. **Kalibrasyon:** Toplu elemeden önce recruiter + hiring manager ilk 10-20 adayı **birlikte** değerlendirir, rol rubriği kilitlenir. (Beklenti kaymasını en baştan yakalar.)
4. **Triage workbench:** Düz başvuru tablosu değil, sıralı "nitelikli sinyal kuyruğu". Her aday kartında: uygunluk gerekçesi, eksik kanıt, risk, kaynak, önerilen aksiyon. Toplu işlemler sebep kodludur.
5. **Anti-miss kontrolleri:** Elenenlerden rastgele örneklem incelemesi, gözden kaçmış adayları yeniden yüzeye çıkarma, çeşitlilik/olumsuz etki (adverse impact) izleme.
6. **Karar:** AI önerir, **insan karar verir**. Her karar gerekçesiyle loglanır.

### Yasal çerçeve (tasarımda zorunlu)

- **EU AI Act:** İşe alım AI'ı **yüksek risk** sınıfında. İnsan gözetimi (md. 14), açıklanabilirlik ve müdahale imkânı zorunlu.
- **GDPR md. 22:** Tamamen otomatik kararla aday elemek yasak; "görünürde onay" (rubber-stamping) da ihlal sayılır — insan denetimi *anlamlı* olmalı.
- **NYC Local Law 144:** Otomatik karar araçları için bias denetimi + adaya bildirim.
- **Aday güveni:** AI mülakatına giren İngiliz adayların %30'u bu yüzden süreçten çekilmiş; %82'sine AI kullanımı önceden söylenmemiş. Şeffaflık sadece yasal değil, aday kaybını önleyen bir gereklilik.
- ⚠️ **Açık nokta:** Türkiye bağlamı (KVKK, kariyer.net/LinkedIn TR pratikleri) mevcut research'te **yok**. Hedef pazar Türkiye'yi içeriyorsa ek araştırma gerekir.

---

## Sistem İçin Çıkarımlar (tasarım fazına köprü)

Research'in işaret ettiği v1 asgari yapı taşları:

1. **Role Decision Contract** — AI destekli rol tanımlama görüşmesi → onaylı rol sözleşmesi (Soru 2'nin ops karşılığı)
2. **JD Generator** — rol sözleşmesinden bias-kontrollü ilan üretimi (Soru 2)
3. **Evidence Ledger + Skorlama** — iddia/kanıt ayrımı, ayrıştırılabilir 5 katmanlı skor (Soru 1 kıstasları + Soru 3)
4. **Triage Workbench** — kuyruk, kalibrasyon, sebep kodlu toplu karar (Soru 3)
5. **Interview Kit + Decision Packet** — kanıt boşluklarına göre yapılandırılmış mülakat planı ve karar dosyası
6. **Talent Memory (hafif v1)** — sebep kodlu red kaydı, gelecek-rol etiketi, yeniden iletişim tarihi
7. **Güven/uyumluluk temeli** — AI kullanım bildirimi, karar logları, insan onay durumları

Kaçınılması gerekenler: tek kara-kutu "işe alınabilirlik skoru", insan görmeden otomatik red, sürpriz AI mülakatı, jenerik tek dashboard, mevcut ATS'i değiştirme şartı.

Pozisyonlama (research önerisi): *"Otonom recruiter" değil — kanıta dayalı, insan yönetiminde işe alım işletim sistemi.* Career-ops'un mottosunun simetriği: aday şirketleri seçmek için AI kullanıyorsa, işveren de doğru adayı **kanıtla** seçmek için AI kullanmalı.

---

## Açık Sorular

1. **Hedef ilan uyuşmazlığı:** LinkedIn 4408666454 şu an **Allianz Benelux – "AI & Automation Specialist (HR)"** (Brüksel) ilanını gösteriyor; vizyon dokümanı ise aynı ID'yi **Coalition – "Talent Operations Specialist"** olarak analiz etmiş. Pilot/hedef hangisi?
2. **Hedef kullanıcı ve pazar:** Sistem Unico Studio'nun iç İK süreci için mi, yoksa career-ops gibi açık/genel bir ürün mü? (Dil, KVKK, entegrasyon kararlarını belirler.)
3. **Form factor:** career-ops simetrisi (Claude Code skill + markdown veri + scriptler) mi, yoksa research dokümanlarının ima ettiği daha büyük platform mu? (MVP için ilki çok daha hızlı.)
4. **İlk iş akışı:** Üç akıştan (eleman bulma / ilan açma / CV tasnifi) hangisi v1'in çekirdeği?

Kaynak dokümanlar: [Talent Ops Proje Analizi.md](Talent%20Ops%20Proje%20Analizi.md) · [talent-ops-ux-research-2026-06-11.md](talent-ops-ux-research-2026-06-11.md)
