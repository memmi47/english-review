import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.resolve(__dirname, '../data/english-review-backup-2026-06-18.json');
const outputPath = path.resolve(__dirname, '../data/prompt_for_llm.txt');

if (!fs.existsSync(inputPath)) {
  console.error(`파일을 찾을 수 없습니다: ${inputPath}`);
  process.exit(1);
}

const backup = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const corrections = backup.data.corrections || [];
const rewrites = backup.data.rewrites || [];

const items = [];

for (const c of corrections) {
  items.push(`- ID: ${c.id}\n  Original: "${c.original}"\n  Target: "${c.corrected}"`);
}
for (const r of rewrites) {
  items.push(`- ID: ${r.id}\n  Original: "${r.user_expr}"\n  Target: "${r.native_version}"`);
}

const prompt = `다음은 한국인 영어 학습자가 말했던 어색한 영어 표현(Original)과 원어민의 교정/개선 표현(Target) 목록입니다.
각 항목을 보고, 학습자가 당시에 원래 표현하려고 의도했던 **"자연스러운 한국어 의미(문맥)"**를 추론해 주세요.
번역투가 아닌, 한국인이 일상/비즈니스에서 자연스럽게 쓰는 한국어 문장으로 작성해 주세요. (예: "나는 어제 학교에 갔다" 대신 "나 어제 학교 갔어")

출력 형식은 반드시 아래와 같은 순수 JSON이어야 합니다:
\`\`\`json
{
  "아이디1": "한국어 의도 1",
  "아이디2": "한국어 의도 2"
}
\`\`\`

목록 (총 ${items.length}개):
${items.join('\n\n')}
`;

fs.writeFileSync(outputPath, prompt, 'utf8');
console.log(`프롬프트가 생성되었습니다: ${outputPath}`);
console.log('이 파일의 내용을 모두 복사해서 Claude나 Gemini에 붙여넣으세요!');
