import { useMemo, useState } from 'react';
import { MOCK_PATIENTS, type MockHisRecord } from '../rulebase/mockHis';
import { runHermesEngine, type HermesAnalysis } from '../services/hermesEngine';
import CdssAdviceCard from '../components/CdssAdviceCard';

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  );
}

function PatientButton({
  patient,
  active,
  onClick,
}: {
  patient: MockHisRecord;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg transition-colors border ${
        active
          ? 'bg-primary-50 border-primary-400 ring-2 ring-primary-200'
          : 'bg-white border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className="flex justify-between items-baseline">
        <span className="font-semibold text-gray-900">{patient.patName}</span>
        <span className="text-xs text-gray-500">{patient.chrNoNew}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{patient.scenario}</p>
    </button>
  );
}

function CandidateRow({ candidate }: { candidate: HermesAnalysis['reasoning']['candidates'][number] }) {
  const flag = candidate.isMinimumEffective
    ? { label: '最低劑量達標', cls: 'bg-emerald-100 text-emerald-700' }
    : candidate.meetsTarget
      ? { label: '可達標', cls: 'bg-blue-100 text-blue-700' }
      : { label: '未達標', cls: 'bg-gray-100 text-gray-600' };
  return (
    <tr className="border-b last:border-b-0">
      <td className="py-2 pr-3 font-medium text-gray-900">{candidate.formula.formulaName}</td>
      <td className="py-2 pr-3 text-gray-600">{candidate.formula.flag1}</td>
      <td className="py-2 pr-3 text-gray-600">{candidate.formula.ldlC}%</td>
      <td className="py-2 pr-3 font-mono text-gray-900">{candidate.predictedLdl} mg/dL</td>
      <td className="py-2 pr-3">
        <span className={`text-xs px-2 py-0.5 rounded ${flag.cls}`}>{flag.label}</span>
      </td>
      <td className="py-2 pr-3 text-gray-600">
        {candidate.selfPay ? '自費' : '健保'}
      </td>
      <td className="py-2 text-xs text-gray-400">{candidate.source}</td>
    </tr>
  );
}

export default function RulebaseDemoPage() {
  const [selectedId, setSelectedId] = useState<string>(MOCK_PATIENTS[0].chrNoNew);
  const patient = useMemo(
    () => MOCK_PATIENTS.find((p) => p.chrNoNew === selectedId)!,
    [selectedId]
  );
  const analysis = useMemo(() => runHermesEngine({ patient }), [patient]);

  const adherencePct =
    analysis.reasoning.adherenceRating.ratio !== null
      ? `${Math.round(analysis.reasoning.adherenceRating.ratio * 100)}%`
      : '—';

  const ldlGapText =
    analysis.reasoning.currentLdl !== null
      ? `${analysis.reasoning.currentLdl} → 目標 <${analysis.reasoning.riskTier.target}`
      : '無資料';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rulebase × Hermes Demo</h1>
        <p className="text-sm text-gray-500 mt-1">
          以 wetmu-legacy AMI rulebase（FORMULAS / SUG_AMI_FORMULAS / CALC_AMI_DRUG_ADHERENCE）為基礎，
          融合台灣血脂 2025 / ESC 2019 / AHA 2018 指引，產出具體用藥建議
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 左：病人選單 */}
        <aside className="col-span-12 lg:col-span-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">假病人（5 種情境）</p>
          {MOCK_PATIENTS.map((p) => (
            <PatientButton
              key={p.chrNoNew}
              patient={p}
              active={p.chrNoNew === selectedId}
              onClick={() => setSelectedId(p.chrNoNew)}
            />
          ))}
        </aside>

        {/* 右：分析結果 */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          {/* Stat row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="風險分層"
              value={analysis.reasoning.riskTier.tier}
              hint={`目標 LDL <${analysis.reasoning.riskTier.target}`}
            />
            <StatCard
              label="LDL-C 現況"
              value={ldlGapText}
              hint={
                analysis.reasoning.baselineLdl > 0
                  ? `推估基準 ${analysis.reasoning.baselineLdl}`
                  : undefined
              }
            />
            <StatCard
              label="需降幅"
              value={`${Math.round(analysis.reasoning.requiredReductionPct * 100)}%`}
            />
            <StatCard
              label="用藥順從性"
              value={`${analysis.reasoning.adherenceRating.rating} (${adherencePct})`}
            />
          </div>

          {/* SOAP */}
          <Section title="SOAP">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">S - Subjective</p>
                <p className="text-gray-700 leading-relaxed">{analysis.soap.subjective}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">O - Objective</p>
                <p className="text-gray-700 leading-relaxed">{analysis.soap.objective}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">A - Assessment</p>
                <p className="text-gray-700 leading-relaxed">{analysis.soap.assessment}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">P - Plan</p>
                <pre className="text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {analysis.soap.plan}
                </pre>
              </div>
            </div>
          </Section>

          {/* CDSS Cards */}
          <Section title="CDSS 建議卡">
            <div className="space-y-3">
              {analysis.cdssAdvice.map((advice) => (
                <CdssAdviceCard key={advice.id} advice={advice} />
              ))}
            </div>
          </Section>

          {/* Reasoning Table */}
          <Section title="配方推理表（rulebase 算給的所有可選方案）">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 uppercase border-b">
                  <tr>
                    <th className="text-left py-2 pr-3">配方</th>
                    <th className="text-left py-2 pr-3">類型</th>
                    <th className="text-left py-2 pr-3">理論降幅</th>
                    <th className="text-left py-2 pr-3">預估 LDL</th>
                    <th className="text-left py-2 pr-3">達標</th>
                    <th className="text-left py-2 pr-3">給付</th>
                    <th className="text-left py-2">來源</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.reasoning.candidates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-3 text-gray-400 text-center">
                        無候選方案（可能因 LDL 缺漏或全部配方被禁忌排除）
                      </td>
                    </tr>
                  ) : (
                    analysis.reasoning.candidates.map((c) => (
                      <CandidateRow key={c.formula.formulaId} candidate={c} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {analysis.reasoning.excludedDrugClasses.length > 0 && (
              <p className="text-xs text-orange-600 mt-3">
                ⚠️ 已排除 drugClass：{analysis.reasoning.excludedDrugClasses.join(', ')}（依 ADR 紀錄）
              </p>
            )}
          </Section>

          {/* Comorbidity */}
          {analysis.reasoning.comorbidityNotes.length > 0 && (
            <Section title="共病提示">
              <ul className="text-sm text-gray-700 space-y-1">
                {analysis.reasoning.comorbidityNotes.map((note, i) => (
                  <li key={i}>• {note}</li>
                ))}
              </ul>
            </Section>
          )}

          {/* Disclaimer */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-xs text-yellow-800">
            <span className="font-semibold">免責聲明：</span>
            {analysis.disclaimer}
          </div>
        </div>
      </div>
    </div>
  );
}
