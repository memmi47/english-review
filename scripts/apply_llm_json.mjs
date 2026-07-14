import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupPath = path.resolve(__dirname, '../data/english-review-backup-2026-06-18.json');
const llmJsonPath = path.resolve(__dirname, '../data/llm_result.json');
const outputPath = path.resolve(__dirname, '../data/english-review-backup-enriched.json');

if (!fs.existsSync(backupPath)) {
  console.error(`백업 파일을 찾을 수 없습니다: ${backupPath}`);
  process.exit(1);
}
if (!fs.existsSync(llmJsonPath)) {
  console.error(`LLM 결과 파일을 찾을 수 없습니다: ${llmJsonPath}`);
  console.error("Claude나 Gemini가 준 JSON 텍스트를 'data/llm_result.json' 파일에 저장한 후 실행해주세요.");
  process.exit(1);
}

const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const llmResult = JSON.parse(fs.readFileSync(llmJsonPath, 'utf8'));

let appliedCount = 0;

if (backup.data.corrections) {
  for (const c of backup.data.corrections) {
    if (llmResult[c.id]) {
      c.intended_meaning = llmResult[c.id];
      appliedCount++;
    }
  }
}

if (backup.data.rewrites) {
  for (const r of backup.data.rewrites) {
    if (llmResult[r.id]) {
      r.intended_meaning = llmResult[r.id];
      appliedCount++;
    }
  }
}

fs.writeFileSync(outputPath, JSON.stringify(backup, null, 2), 'utf8');

console.log(`총 ${appliedCount}개의 한국어 의도(intended_meaning)가 성공적으로 반영되었습니다!`);
console.log(`변환된 백업 파일이 저장되었습니다: ${outputPath}`);
console.log('이제 앱의 [백업 가져오기] 버튼(replace 모드)으로 이 파일을 로드하시면 됩니다.');
