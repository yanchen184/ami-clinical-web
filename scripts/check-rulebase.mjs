// 簡易 sanity check：對 5 位假病人跑 hermes engine，把每位的 reasoning 摘要列出。
// 不是正式測試，目的是讓使用者一眼看到規則對不同病人給出不同分支建議。

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const tsxScript = `
import { MOCK_PATIENTS } from '${path.posix.join(root.replace(/\\\\/g, '/'), 'src/rulebase/mockHis')}';
import { runHermesEngine } from '${path.posix.join(root.replace(/\\\\/g, '/'), 'src/services/hermesEngine')}';

for (const patient of MOCK_PATIENTS) {
  const r = runHermesEngine({ patient });
  console.log(\`\\n[\${patient.chrNoNew}] \${patient.patName}\`);
  console.log('  scenario  :', patient.scenario);
  console.log('  riskTier  :', r.reasoning.riskTier.tier, '(target <' + r.reasoning.riskTier.target + ')');
  console.log('  currentLDL:', r.reasoning.currentLdl, '/ baseline', r.reasoning.baselineLdl);
  console.log('  needReduce:', Math.round(r.reasoning.requiredReductionPct * 100) + '%');
  console.log('  excluded  :', r.reasoning.excludedDrugClasses.join(',') || '(none)');
  console.log('  candidates:');
  r.reasoning.candidates.forEach((c) => {
    const flag = c.isMinimumEffective ? '*MIN_EFF*' : c.meetsTarget ? '[OK]    ' : '[NO]    ';
    console.log(\`     \${flag} \${c.formula.formulaName.padEnd(34)} predict=\${c.predictedLdl}\${c.selfPay ? ' (self-pay)' : ''}\`);
  });
  console.log('  cdss      :', r.cdssAdvice.length, 'cards');
  r.cdssAdvice.forEach((a) => console.log(\`     - [\${a.type}] \${a.content.slice(0, 80)}...\`));
}
`;

// Use tsx via npx (no install needed if missing → fallback message)
const result = spawnSync('npx', ['--yes', 'tsx', '-e', tsxScript], {
  stdio: 'inherit',
  cwd: root,
});
process.exit(result.status ?? 1);
