# Talent-Ops — career-ops Parity Feature Wave — Tasarım Dokümanı

- Tarih: 2026-06-17
- Durum: Onaylı (brainstorming oturumunda bölüm bölüm onaylandı)
- Temel: [santifer/career-ops](https://github.com/santifer/career-ops) feature incelemesi → talent-ops'a simetrik uyarlama
- Mevcut sistem: talent-ops main'de tam çalışır (10 mode + 4 script + web board, dosya-tabanlı, zero-dep, Node ≥20)

---

## 1. Bağlam ve Amaç

career-ops adayın işini otomatikleştirir; talent-ops işverenin. career-ops'un olgun feature'ları incelendi; çoğunun doğal bir işveren-tarafı ayna karşılığı var. Bu dalga, en yüksek değerli dört simetriği mevcut mimariye ve MVP ilkelerine sadık şekilde ekler.

| career-ops (aday) | talent-ops simetriği (işveren) |
| --- | --- |
| `contacto` — adaydan recruiter'a LinkedIn mesajı | **`outreach`** — recruiter'dan adaya mesaj taslağı |
| `followup` — başvuru takip kadansı | **`followup`** — bekleyen adaylar + cadence + adaya draft |
| `patterns` — red kalıpları/funnel analizi | **`analytics`** — hiring funnel + içgörü |
| Block G — scam/ghost job tespiti | **authenticity signals** — CV authenticity sinyalleri |

**Değişmez ilkeler (mevcut sistemle aynı):** İnsan karar verir, AI taslak/öneri üretir. Mode = markdown LLM talimatı; script = zero-dep `.mjs` (deterministik, LLM çağırmaz). Dosya = doğruluk kaynağı, git = denetim izi.

## 2. Verilen Kararlar

| Konu | Karar |
| --- | --- |
| Paketleme | Tek spec, **iki plan**: Plan 1 (non-invasive üçlü) → Plan 2 (authenticity) |
| outreach mesaj türleri | mülakat daveti · nazik red · teklif (eksik-kanıt isteği YOK — interview-kit kapsıyor) |
| outreach yazım yeri | `candidate/outreach.md` (kronolojik, `drafted_by: ai:<model>` + insan onayı); gönderim YOK |
| followup kapsamı | screened→triage · interview→karar · offer→yanıt gecikmeleri + adaya draft |
| followup eşikleri | `company-profile.yml` `cadence:` + makul default (screened 5 / interview 7 / offer 5 gün) |
| analytics metrikleri | funnel+dönüşüm · sebep-kodu dağılımı · override oranı · source→qualified + hız |
| analytics fairness | proxy süreç uyarıları + zorunlu "korumalı-sınıf denetimi DEĞİL" disclaimer |
| authenticity sinyalleri | doğrulanamayan abartı · iç tutarsızlık · jenerik/AI-dil · kanıt-yokluğu yoğunluğu |
| authenticity yer/etki | `score.md` `authenticity_signals[]` + risks özeti; otomatik etki **YOK** (sadece görünür sinyal) |
| authenticity etik sınır | metin-içi + kanıt-doğrulanabilirlik; YASAK: yüz/ses/video, kişilik, sosyal medya, demografi |

## 3. Kapsam

### VAR
- **Plan 1 (non-invasive):** `outreach` mode · `followup` mode + `scripts/followup.mjs` · `analytics` mode + `scripts/analyze-funnel.mjs` · `candidate/outreach.md` dosyası · `company-profile.yml` `cadence:` bölümü
- **Plan 2 (invasive):** `score.md` `authenticity_signals[]` · `modes/screen.md` authenticity adımı · `modes/_shared.md` authenticity bölümü + etik sınır · board (model+render) authenticity rozeti · golden-check

### YOK (bilinçli)
- E-posta/LinkedIn **gönderimi** (yalnız taslak — MVP sınırı)
- PDF CV üretimi, `apply`/form-doldurma, `training`/`project` değerlendirme (aday-spesifik)
- Outbound sourcing/scan (v2 — LinkedIn ToS), çoklu dil (v2)
- Korumalı-sınıf adverse-impact denetimi (veri toplanmıyor; yalnız proxy sinyaller)
- authenticity'nin skora/recommendation'a otomatik etkisi (etik: otomatik ceza yok)

## 4. Ortak Mimari

Tüm yeni feature'lar mevcut katmanlara oturur: `modes/*.md` (LLM talimatı), `scripts/*.mjs` + `scripts/lib/*` (deterministik), dosya-tabanlı veri. Hiçbiri mevcut çekirdeği yeniden yazmaz.

**Ortak draft altyapısı (outreach + followup paylaşır):**
`candidate/outreach.md` — kronolojik append dosyası. Her giriş:
```markdown
## <type> — <YYYY-MM-DD> · drafted_by: ai:<model> · status: draft
<mesaj gövdesi>
```
`type ∈ {invite, reject, offer, followup-update}`. İnsan onaylayınca `status: approved`. **Gönderim yok** — taslak üretimi + insan kopyalar. Ton `company-profile.yml`'ın `jd.tone` + `company.values`'ından türetilir. Atomik yazma (`scripts/lib/atomic.mjs` — append için oku→ekle→atomik-yaz).

## 5. Plan 1 — `outreach` mode

**Dosya:** `modes/outreach.md`. **Çağrı:** `/talent-ops outreach <role-slug> <candidate-slug> [invite|reject|offer]`

- **Önkoşul:** candidate `profile.md` var. Tür belirtilmezse stage'den çıkar: interview/advanced→`invite`, rejected→`reject`, offer→`offer`. Tür stage ile çelişirse uyar.
- **Kişiselleştirme kaynakları:** `profile.md` (isim, lokasyon) · `evidence.md` (güçlü kanıt → davette "X üretim deneyiminiz dikkat çekti") · `score.md` (güçlü yön) · `decision.md` (red → `reason_code`'a sadık ama insani ve saygılı; teklif → `company-profile.yml` comp band).
- **Çıktı:** `candidate/outreach.md`'ye yeni giriş append + chat'te göster. `drafted_by: ai:<model>`, `status: draft`.
- **Kurallar:** Gönderim YOK. Red mesajı sebep koduyla tutarlı (uydurma gerekçe yok). PII'yi dışarı yollamaz. outreach bir KARAR değildir — `decided_by: human:*` kuralı outreach'i bağlamaz; ama teklif/red taslağı yalnız ilgili karar (`decision.md`) mevcutsa üretilir.
- **Hata modları:** Karar henüz yokken `reject`/`offer` istenirse → reddet, "önce decision kaydet" de. Comp band eksikse teklif taslağında uydurma yok → boş bırak + uyar.

## 6. Plan 1 — `followup` mode + `scripts/followup.mjs`

**`scripts/followup.mjs`** (deterministik, zero-dep, saf fonksiyon + CLI — `verify.mjs` paterni):
- `collectFollowups(root, {now, cadence})` → bekleyen adaylar listesi. Her kayıt: `{role, slug, stage, waitingFor, daysWaiting, urgency, updatedAt}`.
- `waitingFor`: `triage` (stage=screened, X gün), `decision` (stage=interview, Y gün), `candidate-response` (decision.md `decision: offer`, Z gün).
- `updatedAt` türetme `board/lib/model.mjs` ile aynı kural (decided_at > scored_at > applied_at).
- Eşikler: `company-profile.yml` `cadence: {screened, interview, offer}` (gün); yoksa default `{screened: 5, interview: 7, offer: 5}`.
- `urgency`: eşik aşımına göre `waiting | due | overdue`.
- CLI: `node scripts/followup.mjs` → urgency'ye göre sıralı dashboard. `package.json`'a `"followup"`.

**`modes/followup.md`** — `/talent-ops followup [role-slug]`:
- `scripts/followup.mjs` çıktısını sun (dashboard: aday · rol · ne bekliyor · kaç gün · urgency).
- İstenirse bekleyen adaya `followup-update` draft (outreach altyapısı → `candidate/outreach.md`): nazik "süreciniz devam ediyor / bir sonraki adım" mesajı. Yine sadece taslak.

## 7. Plan 1 — `analytics` mode + `scripts/analyze-funnel.mjs`

**`scripts/analyze-funnel.mjs`** (deterministik, zero-dep, saf fonksiyon + CLI):
- `analyzeFunnel(root, {role?})` → metrikler nesnesi:
  - **funnel:** stage başına sayı + ardışık dönüşüm oranları
  - **reasonCodes:** terminal kararların `reason_code` dağılımı
  - **overrideRate:** `override: true` / toplam kararlı aday
  - **source:** kaynak başına outcome (qualified = screened ve üstü); source disparity
  - **timing:** ortalama time-in-stage + time-to-decision
  - **fairnessSignals (proxy):** source disparitesi + reason-code konsantrasyonu + stage-bazlı red oranı; **her çıktıda disclaimer alanı**: "Bu korumalı-sınıf adverse-impact denetimi DEĞİLDİR; talent-ops korumalı nitelik verisi toplamaz. Bunlar yalnız operasyonel adalet sinyalleridir."
- Rol arg'ı verilirse o rol; verilmezse tüm roller (cross-role özet).
- CLI: `node scripts/analyze-funnel.mjs [role]`. `package.json`'a `"analyze-funnel"`.

**`modes/analytics.md`** — `/talent-ops analytics [role-slug]`:
- Script çıktısını insan-okunur sun + ilk 3-5 öneri (örn. "screened'de 12 aday triage bekliyor", "override %40 — kalibrasyonu gözden geçir").
- Rapor yaz: `roles/<role>/analytics-<date>.md` (rol bazlı) veya cross-role'de `data/analytics-<date>.md`. Atomik yazma.

## 8. Plan 2 — authenticity signals (invasive)

**Şema (geriye uyumlu, `score.md`'ye opsiyonel alan):**
```yaml
authenticity_signals:
  - signal: unverifiable-exaggeration   # internal-inconsistency | generic-ai-language | evidence-absence
    severity: low | medium | high
    basis: "<somut dayanak — CV'den alıntı/gözlem>"
```
+ `risks[]`'e tek satır özet (görünürlük). **Otomatik etki YOK:** `weighted_total`, `recommendation`, `confidence` matematiği değişmez. Yalnız insana görünür sinyal.

**Dokunulan yerler:**
- **`modes/screen.md`** — skorlama sonrası yeni adım: dört sinyali değerlendirip `authenticity_signals[]` yaz. Hiçbir sinyal yoksa boş bırak (uydurma yok).
- **`modes/_shared.md`** — "Authenticity signals" bölümü + **etik sınır**:
  - Yalnız metin-içi tutarlılık + kanıt-doğrulanabilirlik.
  - YASAK: yüz/ses/video analizi, kişilik çıkarımı, sosyal medya gözetimi, demografik tahmin.
  - `generic-ai-language` en kırılgan sinyal → zorunlu not: "kesin değil, tek başına olumsuz kanıt değil, yalnız insan-kontrol işareti".
  - Data contract'a `authenticity_signals` eklenir.
- **Board** (`board/lib/model.mjs` + `board/lib/render.mjs`) — candidate detayında ve triage'da authenticity rozeti (severity renkli). Yine sadece görünür sinyal; karar insanın.
- **`examples/golden-checks.md`** — yeni kontrol: derek-osei (abartı + kanıt-yok) en az bir `high`/`medium` sinyal almalı; maya-lindqvist (kanıtlı, somut) sinyal **almamalı** (ya da yalnız düşük).

**Risk/uyumluluk:** skorlama matematiği sabit (davranış değişmez). Alan opsiyonel → eski `score.md`'ler bozulmaz (board boş gösterir). `verify.mjs` alanı zorlamaz. Etik çerçeve UX research uyarısına sadık (gözetim değil, kanıt-üçgenlemesi).

## 9. Şema ve Sözleşme Değişiklikleri (özet)

| Dosya | Plan | Değişiklik |
| --- | --- | --- |
| `candidate/outreach.md` | 1 | YENİ dosya (kronolojik draft mesajlar) |
| `config/company-profile.example.yml` | 1 | `cadence:` bölümü eklenir |
| `modes/_shared.md` data contract | 1+2 | `outreach.md` (P1) + `score.md` `authenticity_signals` (P2) |
| `score.md` | 2 | `authenticity_signals[]` opsiyonel alan |
| `states.yml` | — | DEĞİŞMEZ |
| `scripts/` | 1 | `followup.mjs`, `analyze-funnel.mjs` YENİ |
| `package.json` | 1 | `followup`, `analyze-funnel` script'leri |

## 10. Test Stratejisi

- **`scripts/followup.mjs` + `analyze-funnel.mjs`** — vitest unit (fixture repo, `test/helpers.mjs` yeniden kullanılır): cadence eşikleri, urgency hesabı, funnel sayımı, override oranı, fairness disclaimer'ın çıktıda olması.
- **outreach mode** — golden-check: red mesajı reason_code ile tutarlı + gönderim yok + outreach.md'ye yazılıyor.
- **authenticity** — golden-check (derek sinyal alır, maya almaz) + board model/render testlerine authenticity alanı.
- **Regresyon:** mevcut 86 test + `npm run verify` yeşil kalmalı; Plan 1 hiçbir mevcut testi değiştirmez; Plan 2 yalnız board model/render + golden'a ekleme yapar, scoring testlerine dokunmaz.

## 11. Uyumluluk ve Etik

- **outreach:** yalnız taslak, gönderim yok → istenmeyen iletişim riski yok. Red mesajı sebep koduna sadık (tutarlı gerekçe). `candidate/outreach.md` gerçek aday verisidir → mevcut `.gitignore` `/roles/*` kuralı kapsamında, commit edilmez (PII korumalı). Rol-bazlı analytics raporu `roles/<role>/` altında olduğundan aynı koruma altında. **Cross-role rapor `data/analytics-*.md` şu an `.gitignore`'da DEĞİL → Plan 1 görevlerinden biri `.gitignore`'a `/data/analytics-*.md` eklemektir** (aday slug'ları içerebilir, sızmamalı).
- **analytics:** proxy fairness sinyalleri net disclaimer'la; korumalı-sınıf denetimi iddia edilmez (veri yok). Yanıltıcı "bias audit" pazarlaması yapılmaz.
- **authenticity:** gözetim-karşıtı tasarım; otomatik red yok; etik sınır spec + `_shared.md`'de kayıtlı. UX research'ün "surveillance-first olma, kanıt-üçgenlemesi yap" uyarısına uyumlu.
- Tümü mevcut "insan karar verir, AI önerir/taslar; git = denetim izi" çerçevesine sadık.

## 12. İki-Plan Sırası ve Başarı Kriteri

**Plan 1 (non-invasive üçlü)** önce: mevcut sistemi hiç bozmadan recruiter iş akışına üç gerçek araç ekler. **Başarı:** demo rolde `/talent-ops outreach ... reject` reason-code-tutarlı taslak üretir; `npm run followup` bekleyenleri doğru flag'ler; `npm run analyze-funnel` funnel+fairness-disclaimer raporu üretir; 86+ test + verify yeşil.

**Plan 2 (authenticity)** sonra: screen+board+golden'ı dikkatle genişletir. **Başarı:** screen derek-osei'ye authenticity sinyali yazar, maya'ya yazmaz; board rozeti gösterir; scoring davranışı (weighted_total/recommendation) Plan 1 öncesiyle bit-aynı; test+verify yeşil.

## 13. Riskler ve Varsayımlar

- **outreach ton kalitesi:** LLM çıktısı değişken → golden-check + ton config'i sıkı tutulur; insan onayı zorunlu (status: approved).
- **fairness proxy yanlış-yorum:** disclaimer kritik; rapor başlığında ve fairness bölümünde tekrarlanır.
- **authenticity yanlış-pozitif:** generic-ai-language en riskli; "tek başına olumsuz değil" notu + severity + somut basis zorunlu; otomatik etki yok zaten.
- **board şema genişlemesi:** opsiyonel alan, geriye uyumlu; eski veriyle test edilir.
