# AMI 照護平台 — 測試假資料清單

> 本文件說明截圖/測試用假資料的來源、塞入方式，以及正式環境應如何產生。

---

## 帳號資訊

| 角色 | username | password | 說明 |
|------|----------|----------|------|
| 醫師 | `doctor01` | `Doctor@123456` | 負責病患列表、SOAP、趨勢等功能 |
| 個管師 | `cm01` | `Cm@123456` | 負責個案管理、行事曆、KPI |
| 管理員 | `admin` | `Admin@123456` | 負責警示規則、藥品基本檔、配方管理 |

帳號由 Flyway migration SQL 初始建立。正式環境由醫院資訊室開帳並設定角色。

---

## 假資料清單

### 1. 量測資料（measurement）

**塞入方式：** E2E spec `beforeAll` 批次 POST `/api/measurements`，另有 psql 直接 INSERT 補齊近 7 天每天資料。

**內容：**
- BLOOD_PRESSURE：`{systolic: 140~165, diastolic: 85~98}` mmHg，30 天每天 1 筆
- BLOOD_SUGAR：`{glucose: 85~135}` mg/dL，30 天每天 1 筆
- CHOLESTEROL：`{ldl: 85~135, hdl: 45~60, total: 150~210}`，30 天每天 1 筆
- HEART_RATE：`{bpm: 70~90}`，30 天每天 1 筆
- WEIGHT：`{kg: 65~80}`（精確到小數後 2 位），30 天每天 1 筆

**正常應來自：** 病患透過 Line Bot 自主回報（SELF_REPORT），或 HIS 系統定期 ETL 匯入（HIS）。

---

### 2. SOAP AI 摘要（ai_summary）

**塞入方式：** spec `beforeAll` POST `/api/internal/ai-summary`
```json
{
  "patientId": "<uuid>",
  "soap": {
    "subjective": "病患主訴近二週胸悶加重...",
    "objective": "血壓 152/94 mmHg，心率 82 bpm...",
    "assessment": "AMI 後心臟功能追蹤...",
    "plan": "1. Furosemide 劑量調整至 40 mg QD..."
  },
  "cdssAdvice": []
}
```

**正常應來自：** Hermes AI 服務定期分析病患最新量測資料後自動生成，並透過 `/api/internal/ai-summary` 寫入。

---

### 3. CDSS 建議（cdss_advice）

**塞入方式：** 包含在 SOAP 同一筆的 `cdssAdvice` 欄位，或後端 `buildMockCdssAdvice()` fallback。

**正常應來自：** 後端 AI 引擎（Hermes）根據臨床指引自動產出，存入 `ai_summary.cdss_advice`。

---

### 4. 推播通知（notification）

**塞入方式：** spec `beforeAll` POST `/api/notifications`
```json
{
  "to": [<userId>],
  "subject": "血壓異常警示",
  "body": "病患陳志明收縮壓 165 mmHg，超過紅燈閾值",
  "type": "ALERT"
}
```

**正常應來自：** 系統自動偵測警示規則觸發時推播，或個管師手動從介面發送。

---

### 5. HIS 資料（his_record）

**塞入方式：** Flyway migration V6 直接 INSERT `his_record` 表，包含：
- DRUG（用藥紀錄）：近 90 天的藥品處方
- DIAGNOSIS（診斷紀錄）：ICD-10 代碼與中文病名
- ALLERGY（過敏/不良反應）

**正常應來自：** 醫院 HIS 系統定期 ETL 同步，透過 `/api/internal/his-sync` 寫入。

---

### 6. 警示規則（alert_rule）

**塞入方式：** Flyway migration V8 初始化 8 筆預設規則（sbp, dbp, heart_rate, spo2, weight_delta, ldl, hba1c, creatinine）。

**正常應來自：** 這本身就是系統初始設定，管理員可在後台調整黃燈/紅燈閾值。

---

### 7. 藥品基本檔 / 配方（medication_master / formula）

**塞入方式：** 系統初始化或 migration 直接 INSERT。

**正常應來自：** 藥師或管理員在後台維護，也可從 HIS 藥品清單匯入。

---

## 注意事項

1. **所有量測資料的 `source` 欄位** 只接受 `SELF_REPORT` 或 `HIS`，不可用其他值（Enum 限制）。
2. **體重資料** 統一用 `{"kg": <value>}` 格式，精確到小數後 2 位。
3. **SOAP 資料** 透過 `/api/internal/ai-summary` 寫入時，body 格式為 `{patientId, soap: {subjective,...}, cdssAdvice}`（巢狀），後端再轉為平坦格式回傳給前端。
