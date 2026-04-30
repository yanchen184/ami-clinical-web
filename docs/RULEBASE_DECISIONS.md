# Rulebase 移植決策表

> 把 wetmu-legacy（Grails 5 + MSSQL）的 AMI rulebase 帶到新的 React 專案，
> 並接到 hermes engine 用以對假 HIS 資料產生具體用藥建議。
> 本文件紀錄移植過程中所有「我做了什麼決定 / 為什麼這樣決定」。

**完整絕對路徑：** `/Users/yanchen/workspace/ami/ami-clinical-web/.claude/worktrees/orktree/docs/RULEBASE_DECISIONS.md`

---

## 1. 範圍界定

| 取捨 | 決定 | 理由 |
| --- | --- | --- |
| 要不要連舊 MSSQL DB？ | **不連** | Demo 用途，避免 DB 連線、認證、VPN 等基礎設施依賴；改成 in-memory mock |
| 要不要動 backend (`ami-clinical-api`)？ | **不動** | 用戶要求「中間決策不問」+ 純前端就能展示效果，把 rulebase 寫在 web 端 |
| 規則用 JSON / 純 TS / DSL ? | **純 TS** | 直接編譯期型別檢查、IDE 跳轉、後續若要抽到 backend 也容易翻譯 |
| 假病人放哪？ | `src/rulebase/mockHis.ts` | 跟 rulebase 同一資料夾，方便閱讀「規則」與「測試例子」是配套的 |
| 移植幾個配方？ | **8 個** | 涵蓋 A/B/C/D 四大類（高/中強度 statin、複合配方、PCSK9i），足以展示分支邏輯 |
| 假病人幾位？ | **5 位** | 對應 5 種主要決策路徑：標準 / 極極高風險 / statin 不耐 / 順從性差 / 已達標 |

---

## 2. Domain → TS 對應

| 舊系統表 | 新檔案 | 取捨說明 |
| --- | --- | --- |
| `DSC_DRUGDIM`（藥品基本檔） | `rulebase/drugs.ts` `DRUGS[]` | 只保留 `medCode/atcCode/aliseDesc/medDesc` 等核心欄位；額外補 `drugClass`、`ldlReductionPct`（舊系統存 `Z1` 是動態算的，新版直接寫死 ACC/AHA 統計值） |
| `FORMULAS`（基礎配方） | `rulebase/formulas.ts` `FORMULAS[]` | 保留 `formulaName/ldlC/flag1/selfPay/status`；`dscKind` 只留 `'AMI'`（demo 不處理其他疾病） |
| `FORMULA_DRUGS`（配方-藥品連結） | 內嵌進 `Formula.drugs[]` | 簡化為 `{medCode, priority}` 內嵌，省一張表；舊系統有 `dddValue1/2` 但 demo 用不到 |
| `CALC_AMI`（計算結果） | 不持久化，改純函數 | 由 `hermesEngine.runHermesEngine()` 即時計算；`X_VALUE/Y_VALUE/Z2/T_VALUE` 都對應到 `reasoning.{currentLdl,baselineLdl,requiredReductionPct,riskTier.target}` |
| `SUG_AMI_FORMULAS`（推薦配方） | `hermesEngine.pickCandidates()` | 即時挑選；保留「最低劑量達標」原則（按 LDL-C 降幅由小到大排序，第一個達標者標 `isMinimumEffective`） |
| `CALC_AMI_DRUG_ADHERENCE` | `ldlTargets.rateAdherence()` | 完全保留 `<0.15 無 / 0.15-0.5 差 / ≥0.5 好` 的閾值 |
| `DSC_DRUGADR`（過敏 / ADR） | `contraindications.AdrFlags` | 保留 `nsaids/penicillin/cephalosporin/...` 6 個 bool；新增 `statinIntolerance` + `allergicMedCodes[]` 應對「statin myalgia 須避開高強度」的常見情境 |

---

## 3. 規則邏輯增強（舊系統沒有 / 不夠的）

| 加了什麼 | 為什麼 |
| --- | --- |
| `RiskTier = EXTREME_HIGH/VERY_HIGH/HIGH/MOD` | 舊系統 `T_VALUE` 是 SP 黑盒；新版用 ESC 2019 / 台灣血脂 2025 明確分層，目標值 40/55/70/100 mg/dL，每層帶 `source` 欄位（合規可追溯） |
| `estimateBaselineLdl` 公式 `Y = X / (1 - Z1)` | 舊系統 `sp_calc_ami` 黑盒；用文件化純函數，方便複查與單元測試 |
| `requiredReductionPct` | 把 `Z2` 公式抽出成純函數 |
| `comorbidityNotes` | 舊系統沒給；hermes SOUL 強調「每條建議要有依據」，這裡把 DM/CKD/HTN/HFrEF 共病提示分別綁 ADA / KDIGO / AHA / ESC source |
| `formulasExcludingClass` | 處理 statin 不耐受 fallback；舊系統靠 `DSC_DRUGADR` 但缺 statin 類別過敏，補上 |

---

## 4. Hermes engine 介面設計

| 取捨 | 決定 | 理由 |
| --- | --- | --- |
| 輸出格式 | `HermesAnalysis` = `{soap, cdssAdvice, reasoning, disclaimer}` | `soap` 餵 `SoapCard`、`cdssAdvice` 餵 `CdssAdviceCard`（沿用既有 component），`reasoning` 給 demo 頁顯示推理過程；不破壞既有 UI 合約 |
| Confidence 計算 | 達標 85 / 未達標 60 / 監測類 90-95 | 舊系統沒有 confidence；用「規則命中且達標 → 高信心、推估降幅未達標 → 中信心、純 LAB 缺漏建議 → 高信心（事實陳述）」 |
| Disclaimer | 全文照搬 SOUL.md 規定 | hermes 三底線之一：每次輸出必含 disclaimer |
| 多語 | 純繁中 | 對齊 SOUL.md「語言：繁體中文」原則 |

---

## 5. UI 整合

| 動作 | 說明 |
| --- | --- |
| 新增 `RulebaseDemoPage` | 路由 `/rulebase-demo`，三角色 sidebar 都可進 |
| 沿用 `CdssAdviceCard` | 因為新 `cdssAdvice` 結構符合既有 `CdssAdvice` interface，零修改 |
| sidebar 加入口 🧠 | 醫師 / 個管 / 管理員都看得到，方便不同角色對 demo 給回饋 |
| 病人切換 | 左側 5 個假病人按鈕，點選即時重算（`useMemo` over `runHermesEngine`） |

---

## 6. 5 位假病人對應的決策路徑

| # | 病人 | 風險分層 | 預期 hermes 行為 |
| --- | --- | --- | --- |
| AMI-001 | 陳大明（標準路徑） | VERY_HIGH | LDL 92 > 55，現用 ATOR40 降幅 49% 不夠 → 建議升 ATOR80 / ATOZ40 / ROSU40 |
| AMI-002 | 林秀英（極極高風險） | EXTREME_HIGH | 目標 <40，statin + ezetimibe 不夠 → 建議考慮 PCSK9i + 標 REFERRAL 卡 |
| AMI-003 | 王志強（statin 不耐） | VERY_HIGH | 高強度 statin 已被排除 → 候選池只剩 ezetimibe / bempedoic，明顯多數未達標 → 觸發「資料不足」風格的低信心建議 |
| AMI-004 | 黃美玲（順從性 13%） | VERY_HIGH | 觸發 LIFESTYLE 卡：先解決順從性、不直接加藥；DM 共病提示 |
| AMI-005 | 蔡建國（已達標） | VERY_HIGH | LDL 48 < 55，候選清單仍列出，最低劑量達標標籤 = 現用方 → 建議維持 |

---

## 7. 沒做的（明確 out-of-scope）

- 沒接 backend `/api/internal/ai-summary`（demo 用前端純算）
- 沒接 Gemini / 真 LLM；hermes 是純 rule-based engine（這也對齊 SOUL.md「規則為主、文獻為輔」）
- 沒處理兒童 / 妊娠 AMI（SOUL.md 明寫超出訓練範圍）
- 沒做 audit log 持久化（demo 不需要；正式版可補 `ai_summary` 表寫入）
- 配方資料是精選 8 個示意；正式版應從舊 DB 完整匯入或讓 admin 在 `FormulaMasterPage` 維護

---

## 8. 後續可接的工作

1. **接後端**：把 `hermesEngine.runHermesEngine()` 翻譯成 `ami-ai-service/app/services/` 的 Python 版本，由 `/api/internal/ai-summary` 呼叫
2. **完整 formulary**：寫一個 ETL 把舊 `FORMULAS` / `FORMULA_DRUGS` 表 dump 成 JSON 餵進新版
3. **真實 HIS adapter**：`ami-his-adapter` 對接後，把 `MockHisRecord` 換成真實病人 schema
4. **Hermes few-shot 例子**：對應 SOUL.md 的 `hermes_example`，把醫師回饋寫回 example_repo
5. **規則演化記錄**：`audit_log` 表記錄「為何規則 X 變成 Y、誰改、何時改」，對齊 SOUL.md 演化原則
