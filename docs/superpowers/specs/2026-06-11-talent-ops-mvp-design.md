# Talent-Ops MVP — Tasarım Dokümanı

- Tarih: 2026-06-11
- Durum: Onaylı (brainstorming oturumunda bölüm bölüm onaylandı)
- Temel: `docs/research/` altındaki üç doküman (vizyon analizi, UX research, işveren süreci özeti)
- Model alınan proje: [santifer/career-ops](https://github.com/santifer/career-ops) — aday tarafının işveren simetriği

---

## 1. Bağlam ve Amaç

Career-Ops, adaylara AI destekli bir iş arama komuta merkezi verdi (740+ ilan değerlendirme, A-F skorlama, dosya tabanlı mimari). Talent-Ops aynı denklemin işveren tarafıdır: işe alım ekibinin **rol tanımlama → ilan → gelen CV'leri kanıta dayalı tasnif → mülakat → karar** akışını "ops"a döker.

Konumlandırma (research önerisi, aynen benimsendi):

> Otonom recruiter değil — kanıta dayalı, insan yönetiminde işe alım işletim sistemi. AI önerir, insan karar verir.

Temel felsefe: **CV ≠ Aday.** Her beyan kaynağı, kanıtı ve güven skoruyla izlenir; tek kara-kutu puan yoktur.

## 2. Verilen Kararlar

| Karar | Seçim | Gerekçe |
| --- | --- | --- |
| Hedef kitle | **Baştan open-source ürün** | career-ops gibi topluluk hedefli; EN-first; skill ekosisteminde işveren tarafı boş (doğrulandı: en yakın skill <110 kurulum) |
| MVP dilimi | **İlandan karara, inbound** | En büyük acı burada (ilan başına ort. 242 başvuru); dış veri bağımlılığı yok. Outbound sourcing v2'ye |
| Mimari | **Hibrit: dosya tabanlı çekirdek + lokal web board** | Skill + markdown/YAML veri + .mjs script'ler (career-ops simetrisi) + MVP'de triage için lokal web viewer |
| Uyumluluk çerçevesi | GDPR + EU AI Act (+ NYC LL144 dokümantasyon uyumu) | OSS/global hedef; işe alım AI'ı "yüksek risk" sınıfında |
| Demo rol | LinkedIn 4408666454 — Allianz Benelux "AI & Automation Specialist (HR)" | URL'in bugünkü gerçek içeriği (not: eski research aynı ID'yi farklı ilan olarak analiz etmişti; güncel içerik esas alındı) |
| Dil | Ürün EN-first; dil katmanı (modes/tr vb.) sonradan, career-ops paterniyle | OSS erişimi |

## 3. Kapsam

### MVP'de VAR

1. **Role Decision Contract** — AI destekli rol tanımlama görüşmesi → onaylı rol sözleşmesi (skorlama rubriğinin kaynağı)
2. **JD üretimi** — bias taraması + gereksinim disiplini denetimiyle
3. **CV intake** — PDF/DOCX/CSV ayrıştırma, normalizasyon, tekilleştirme, sert filtreler
4. **Evidence Ledger** — aday başına iddia/kaynak/kanıt/güven/doğrulama kaydı
5. **5 katmanlı skorlama** — ayrıştırılabilir skor + güven + eksik kanıt listesi
6. **Triage** — sıralı kuyruk, kalibrasyon koruması, sebep kodlu kararlar, anti-miss örneklem
7. **Interview kit** — kanıt boşluklarını hedefleyen yapılandırılmış plan + scorecard
8. **Decision packet** — kanıt + skor + mülakat geri bildirimi + zorunlu insan kararı
9. **Talent memory (hafif)** — sebep kodlu red kaydı, future-fit etiketi, recontact tarihi, rediscovery sorgusu
10. **Web board** — lokal, dosya okuyan, dar aksiyon setli triage arayüzü
11. **Uyumluluk temeli** — AI bildirimi, karar logları, denetim paketi export'u, unutulma script'i
12. **Demo seti** — örnek rol + ~10 kurgu CV (golden set; test + onboarding aynı anda)

### MVP'de bilinçli olarak YOK

- Outbound sourcing (LinkedIn/GitHub aday tarama) → v2. MVP'de tek istisna: adayın CV'sinde verdiği public linkleri ajan ziyaret edip kanıt toplayabilir
- ATS entegrasyonları (Greenhouse/Lever/Workday) → v2; MVP import yolu dosya/CSV
- Otomatik red — hiçbir koşulda insansız red yok
- Tek bileşik "işe alınabilirlik" skoru ana arayüz olarak
- AI mülakatı, yüz/ses/kişilik analizi
- Board'da çoklu kullanıcı, auth, analitik sayfası, board'dan skill tetikleme
- E-posta gönderimi / aday iletişim otomasyonu

## 4. Mimari

Üç katman, tek doğruluk kaynağı dosyalar:

1. **Zekâ katmanı — AI CLI skill** (`/talent-ops ...`): router `SKILL.md` + mode dosyaları. Tüm LLM işleri (görüşme, üretim, ayrıştırma, skorlama) burada. `AGENTS.md` ile diğer CLI'lara taşınabilir (career-ops paterni).
2. **Veri katmanı — dosyalar**: YAML frontmatter (yapılandırılmış) + markdown gövde (insan-okur gerekçe). Git history = denetim izi.
3. **Görüntüleme katmanı — web board**: `npm run board` ile kalkan tek Node process; dosyaları okur, beyaz-listeli aksiyonları dosyalara yazar. Opsiyoneldir; sistem CLI-only tam çalışır.

### Repo yapısı

Bu yapı mevcut HR-ops reposunun köküne kurulur; ürünün açık kaynak adı **talent-ops**'tur. (`docs/research` ve `docs/superpowers` mevcut yerinde kalır.)

```
talent-ops/   (= HR-ops repo kökü)
├── .claude/skills/talent-ops/SKILL.md   # router
├── AGENTS.md                            # CLI-bağımsız talimatlar
├── modes/
│   ├── _shared.md        # felsefe, veri sözleşmesi, skorlama kuralları (açık metin)
│   ├── define-role.md    # rol görüşmesi → Role Contract
│   ├── jd.md             # kontrat → bias-kontrollü ilan
│   ├── intake.md         # inbox → aday dosyaları
│   ├── screen.md         # tek aday: evidence + skor
│   ├── batch.md          # paralel screen (subagent/worker başına aday)
│   ├── triage.md         # kuyruk + sebep kodlu kararlar
│   ├── interview-kit.md  # kanıt boşluğu → mülakat planı
│   ├── decision.md       # karar paketi
│   ├── tracker.md        # pipeline özeti + SLA uyarıları
│   └── memory.md         # talent memory / rediscovery
├── config/company-profile.example.yml   # şirket kimliği, değerler, comp bantları,
│                                        # JD ton ayarı, disclosure varsayılanları,
│                                        # kullanıcı kimliği (human:<ad>)
├── roles/{rol-slug}/
│   ├── role-contract.md
│   ├── jd.md
│   └── candidates/{aday-slug}/
│       ├── source/           # orijinal CV (pdf/docx) + aday linkleri
│       ├── profile.md        # normalize profil
│       ├── evidence.md       # Evidence Ledger
│       ├── score.md          # 5 katman skor
│       └── decision.md       # karar (insan zorunlu)
├── data/
│   ├── inbox/                # yeni başvurular buraya
│   ├── quarantine.md         # parse edilemeyenler
│   ├── tracker.md            # kanonik pipeline tablosu
│   └── talent-memory.md
├── board/                    # Node server + Vite/React SPA
├── scripts/
│   ├── verify.mjs            # tutarlılık denetimi
│   ├── dedupe.mjs
│   ├── export-audit.mjs      # rol bazlı denetim paketi
│   └── forget.mjs            # GDPR md.17 — aday verisini sil
├── templates/                # role-contract, jd, scorecard, decision, disclosure
└── examples/                 # demo rol (Allianz HR-AI) + kurgu CV'ler
```

Akış: `define-role` → rol klasörü → CV'ler `inbox`'a → `intake` + `screen`/`batch` → board'da triage → kararlar dosyalara → dosyalar git'e.

**PII sınırı:** talent-ops repo'su şablondur; kullanıcı gerçek veriyle kendi *private* kopyasında çalışır. `examples/` yalnızca kurgu veri içerir.

## 5. Veri Modeli

Ortak kurallar: her dosyada YAML frontmatter + markdown gövde; her yazmada köken damgası (`ai:<model>` veya `human:<ad>`); slug'lar `kebab-case`; tüm yazmalar atomik (tmp + rename).

### 5.1 `role-contract.md`

```yaml
---
role: ai-automation-specialist-hr
title: "AI & Automation Specialist (HR)"
status: draft | approved | revised      # approved olmadan jd/screen/triage çalışmaz
approved_by: human:<ad>
approved_date: <tarih>
location: "..."
hard_filters:                            # geçti/kaldı
  work_permit: EU
  language: English C1
scoring_weights:                         # toplam 1.0; rol bazında ayarlanır
  skill_match: 0.30
  experience_match: 0.20
  evidence_match: 0.30
  behavior_signals: 0.20
must_have:
  - skill: Python
    evidence_required: repo | production-story | certification
nice_to_have: [SuccessFactors]
disqualifiers: ["cloud deneyimi yok"]
---
## Business need (neden alıyoruz)
## İlk 90 gün başarı çıktıları
## Başarısızlık senaryosu ("90 günde nasıl başarısız olur?")
## Mülakat aşamaları
## Criteria drift log    ← her beklenti değişikliği revizyon olarak buraya; sessiz kayma yok
```

### 5.2 `profile.md` (normalize aday profili)

Frontmatter: ad, e-posta, lokasyon, kaynak (`inbound:<kanal>`), başvuru tarihi, aday linkleri (github/portfolio/linkedin — adayın verdiği), deneyim özeti (yıl, son roller), dil(ler). Gövde: yapılandırılmış özgeçmiş özeti.

### 5.3 `evidence.md` (Evidence Ledger)

```yaml
claims:
  - claim: Python
    source: cv | linkedin | github | portfolio | interview
    evidence: "<somut referans veya boş>"
    evidence_type: repo | publication | certification | story | none
    confidence: high | medium | low | none
    status: unverified | ai-inferred | human-confirmed | contradicted
    note: "<gerekçe>"
```

"Beceri beyanı" ile "beceri kanıtı" daima ayrıdır; kanıtsız iddia `confidence: none` olarak kalır.

### 5.4 `score.md`

```yaml
scores:
  hard_filters: pass | fail(<filtre>)
  skill_match: <1-5>
  experience_match: <1-5>
  evidence_match: <1-5>
  behavior_signals: <1-5>
weighted_total: <1-5>          # kontrat ağırlıklarıyla
confidence: high | medium | low
missing_evidence: [<beceri listesi>]   # interview-kit'in girdisi
risks: [<metin>]
recommendation: advance | shortlist | hold | reject-suggest   # assistive etiketli AI önerisi
scored_by: ai:<model>
scored_at: <zaman>
```

Gövde: katman katman gerekçeler. Skor asla gerekçesiz sunulmaz.

### 5.5 `decision.md`

```yaml
decision: advanced | interviewing | offer | hired | rejected | withdrawn
reason_code: <states.yml sözlüğünden>   # serbest metin değil
reason_detail: "<kısa açıklama>"
decided_by: human:<ad>                  # ai:* ŞEMA İHLALİ — üç katman doğrular
ai_recommendation: <skor dosyasındaki öneri>
override: true | false                  # insan AI'dan saptı mı (metrik)
future_fit: [<rol-slug>]                # talent memory
recontact_after: <tarih>
decided_at: <zaman>
```

### 5.6 `templates/states.yml`

- Aşamalar: `inbox → parsed → screened → triage → interview → decision → hired | rejected | withdrawn`
- Karar ↔ aşama eşlemesi: `decision.md`'deki karar adayı taşır — `advanced` → `interview`; `offer` karar değeridir, aşama değildir (aday `decision` aşamasında bekler); `hired`/`rejected`/`withdrawn` → uç (terminal) aşamalar
- Sebep kodu başlangıç sözlüğü: `missing-must-have`, `insufficient-evidence`, `experience-level-mismatch`, `hard-filter-fail`, `compensation-mismatch`, `stronger-shortlist`, `candidate-withdrew`, `position-filled`
- Kodlar olgusaldır; "culture fit" gibi bias'a açık kod yoktur.

### 5.7 `data/tracker.md`

Tek kanonik tablo: aday | rol | aşama | skor+güven | son aksiyon | sonraki aksiyon | aşamada geçen gün.

## 6. İş Akışları (Mode'lar)

| Mode | Girdi → Çıktı | Kritik davranış |
| --- | --- | --- |
| `define-role` | Görüşme → `role-contract.md` | Kalibrasyon soruları (90 gün, must-have vs öğretilebilir, başarısızlık senaryosu). Kontrat `approved` olmadan bağlı mode'lar reddeder |
| `jd` | Onaylı kontrat → `jd.md` | Bias taraması (yaş/cinsiyet/toksik kültür dili) + gereksinim disiplini (kontratta olmayan şart ilana giremez) + disclosure bloğu. LinkedIn'e hazır varyant |
| `intake` | `data/inbox/*` → aday klasörleri | Parse, normalize, dedupe, sert filtre. Başarısız parse → `quarantine.md` |
| `screen <aday>` | Aday → `evidence.md` + `score.md` | İddia çıkarımı → kanıt eşleştirme → 5 katman skor. Adayın verdiği public linkler ziyaret edilebilir; otomatik dış tarama yok |
| `batch` | Tüm `parsed` adaylar | Aday başına paralel subagent; ilerleme + kaldığı yerden devam (career-ops batch paterni) |
| `triage` | Skorlanmışlar → kararlar | Güven bantlı kuyruk; ilk 10-15 aday "HM ile kalibre et" etiketli; ağırlık değişimi kontrat revizyonu olarak loglanır; red önerilenlerden rastgele örneklem insan kontrolüne çıkar |
| `interview-kit <aday>` | Kontrat + `missing_evidence` | Kanıt boşluklarını hedefleyen sorular + scorecard şablonu |
| `decision <aday>` | Tüm dosyalar → karar paketi | İnsan kararı + sebep kodu zorunlu; güçlü-ama-red adaylar memory'ye |
| `tracker` | — → pipeline özeti | Takılanlar, SLA uyarıları |
| `memory` | Yeni rol → eşleşmeler | Rediscovery + tazelik uyarısı |

### Skorlama kuralları (`modes/_shared.md`'de açık metin — kullanıcı okuyabilir/düzenleyebilir)

1. **Sert filtreler:** geçti/kaldı; kalan aday dahi otomatik reddedilmez, insan onayına düşer.
2. **Beceri eşleşmesi:** kısmi puanlı — komşu beceri (PowerBI≈Tableau) gerekçeli kısmi puan alır.
3. **Deneyim:** süre + sektör derinliği.
4. **Kanıt:** güven ağırlıklı; repo'lu iddia > çıplak iddia; eksikler `missing_evidence`'a.
5. **Davranış sinyalleri:** yalnızca aday materyalinden (OSS, konuşma, yazı).

Çıktı: ağırlıklı toplam + güven + eksik kanıt + riskler. Tek başına bileşik skor hiçbir arayüzde ana gösterim değildir.

## 7. Web Board

- **Çalıştırma:** `npm run board` → tek Node process, localhost. Dosya watcher + SSE ile canlı yenileme. Stack: Node server + Vite/React hafif SPA. DB yok, auth yok (tek kullanıcı, MVP).
- **Ekranlar:** (1) Pipeline kanban — kartta: isim, skor+güven, tek satır uygunluk gerekçesi, eksik kanıt sayısı, kaynak, aşama günü/SLA rengi; (2) Aday detayı — profil + Evidence Ledger tablosu + 5 katman skor kırılımı + karar geçmişi; (3) Triage kuyruğu — kalibrasyon etiketleri, çoklu seçim, sebep kodlu toplu karar, anti-miss örneklem kutusu; (4) Rol görünümü — kontrat özeti, drift log, JD.
- **Yazma aksiyonları (beyaz liste):** aşama değiştir (yalnız uç olmayan aşamalar arası); karar + sebep kodu (dropdown, `states.yml`); kanıt durumu işaretle (`human-confirmed`/`contradicted`); not ekle. Başka yazma yok. Uç aşamalara (`hired`/`rejected`/`withdrawn`) geçiş yalnız karar aksiyonuyla olur — sebep kodsuz red için arka kapı yoktur.
- **Güvenceler:** şema doğrulama → atomik yazma → `decided_by: human:<config kullanıcısı>` damgası. Board üzerinden `ai:*` karar yazılamaz. Yazmadan önce dosya yeniden okunur; render'dan beri değiştiyse uyarı.

## 8. Uyumluluk (by-design)

| Gereklilik | Mekanizma |
| --- | --- |
| İnsan gözetimi (EU AI Act md.14, GDPR md.22) | `decided_by: ai:*` üç katmanda reddedilir: skill talimatı, board sunucusu, `verify.mjs` |
| Şeffaflık / bildirim (LL144, AI Act) | `templates/disclosure.md` → JD'ye eklenen blok: AI neyi değerlendirir/değerlendirmez, son karar insanda, itiraz yolu |
| Kayıt tutma | Git history + `decision.md` alanları (model, zaman, override) + `export-audit.mjs` rol bazlı paket |
| Unutulma hakkı (GDPR md.17) | `forget.mjs <aday>` — klasör + tracker + memory temizliği |
| Önyargı azaltma | JD bias taraması; olgusal sebep kodları; anti-miss örneklem; ayrıştırılabilir skor |
| Köken (provenance) | Her kayıtta `ai:`/`human:` damgası; `AI Draft → Human Edited → Human Approved` durumları |

## 9. Hata Yönetimi

- Parse hatası → `quarantine.md`; sessiz veri kaybı yasak.
- `screen`/`jd`, eksik veya onaysız kontratla çalışmaz; eksik alanı adıyla söyler.
- `verify.mjs`: tracker ↔ dosya tutarlılığı; geçersiz aşama/sebep kodu; onaysız kontratla skorlanmış aday; `ai:*` karar taraması; kopuk dosya referansları.
- Mükerrer başvuru (isim+e-posta) → otomatik birleştirme değil, birleştirme önerisi.
- Tüm yazmalar atomik; board çakışma uyarısı (bkz. §7).

## 10. Test Stratejisi

1. **Script'ler:** vitest unit testleri — fixture CV'lerle parse/dedupe/verify; `forget` ve `export-audit` davranış testleri.
2. **LLM davranışı (golden set):** `examples/` demo rol + ~10 kurgu CV üzerinde davranış asertleri:
   - must-have kanıtı olmayan aday `advance` önerisi alamaz
   - draft kontratla `screen`/`jd` çalışmaz
   - bias'lı ifade içeren taslak JD temiz çıkar
   - `decision.md`'ye `ai:*` yazılamaz (verify yakalar)
3. **Board:** Playwright e2e — board açılır → kart görünür → karar yazılır → dosya frontmatter'ı doğrulanır.

## 11. MVP Başarı Kriteri ve Metrikler

> Yabancı biri repo'yu klonlayıp demo rolü açar, 10 örnek CV'yi inbox'a atar ve 30 dakika içinde: onaylı rol kontratı + bias-temiz JD + kanıt gerekçeli skorlanmış aday seti + board'da sebep kodlu triage kararları üretir — hiçbir aday insansız reddedilmeden.

Metrikler (research'ten v1'e uyanlar): saat başına incelenen başvuru; shortlist'te kanıt kapsama oranı; AI önerisi override oranı; audit-complete karar oranı.

## 12. Yol Haritası (MVP sonrası, bağlayıcı değil)

- **v2:** Outbound sourcing (LinkedIn/GitHub/Kaggle zeka katmanı), ATS entegrasyonları (önce Greenhouse veya Lever), talent memory'nin graf modeline taşınması, dil katmanları (modes/tr ...), TUI alternatifi
- **v3:** Mülakat planlama/takvim otomasyonu, tam karar motoru raporları, kurumsal yetenek haritalama

## 13. Riskler ve Varsayımlar

- **LLM skor tutarlılığı:** aynı aday iki çalıştırmada farklı skor alabilir → golden set + skorlama kurallarının `_shared.md`'de açık ve sıkı yazılması; güven bantları tekil sayıdan önde sunulur.
- **UX varsayımları doğrulanmadı:** research kamu kaynaklı; gerçek recruiter görüşmesi yapılmadı (research "needs deeper research" diyor). MVP'nin OSS erken kullanıcıları bu doğrulamanın yerine geçer.
- **Hacim sınırı:** dosya tabanlı yapı yüzlerce aday/rol ölçeğinde rahattır; binlerce eşzamanlı adayda board ve tracker zorlanabilir → MVP hedef segmenti (küçük/orta ekip) için yeterli.
- **Hukuk notu:** uyumluluk mekanizmaları "by-design" kolaylaştırıcıdır; hukuki danışmanlık değildir (README'de açıkça belirtilecek).
