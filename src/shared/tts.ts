// tts.ts — 발음 듣기 (브라우저 기본 SpeechSynthesis)
//
// OpenRouter 경유(openai/gpt-4o-mini-tts, openai/gpt-audio 등)와 Google
// Gemini API(gemini-2.5-flash-preview-tts) 신경망 음성을 모두 시도했으나
// 계정/설정 문제로 안정적으로 재생되지 않아 포기하고, 브라우저 내장
// SpeechSynthesis만 쓰는 것으로 확정했다. 추가 API 키·캐시·비용 없이
// 항상 동작한다는 게 장점이지만, iOS Safari는 웹에 저품질 기본 음성만
// 노출하는 한계가 있음(다운로드한 Enhanced/Premium 음성은 웹에서 보이지
// 않는 알려진 제약).

const NOVELTY_VOICE_NAMES = [
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos',
  'good news', 'jester', 'organ', 'superstar', 'trinoids', 'whisper',
  'wobble', 'zarvox', 'bruce', 'fred', 'junior', 'kathy', 'princess',
  'ralph', 'grandma', 'grandpa', 'eddy', 'flo', 'reed', 'rocko', 'sandy', 'shelley',
];

const FEMALE_VOICE_NAMES = [
  'samantha', 'ava', 'allison', 'victoria', 'karen', 'moira', 'tessa',
  'fiona', 'nicky', 'susan', 'joanna', 'kimberly', 'ivy', 'salli', 'kendra',
  'ruth', 'aria', 'jenny', 'zira', 'hazel', 'linda', 'eva', 'sarah',
  'google us english', 'google uk english female',
];

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  cachedVoices = window.speechSynthesis.getVoices();
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function isNovelty(name: string): boolean {
  const n = name.toLowerCase();
  return NOVELTY_VOICE_NAMES.some(bad => n.includes(bad));
}

function isFemale(name: string): boolean {
  const n = name.toLowerCase();
  return FEMALE_VOICE_NAMES.some(f => n.includes(f));
}

function isEnhanced(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('enhanced') || n.includes('premium') || n.includes('neural');
}

function pickEnglishVoice(): SpeechSynthesisVoice | undefined {
  const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();
  const english = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
  const normal = english.filter(v => !isNovelty(v.name));

  const enhancedFemale = normal.find(v => isEnhanced(v.name) && isFemale(v.name));
  if (enhancedFemale) return enhancedFemale;
  const enhanced = normal.find(v => isEnhanced(v.name));
  if (enhanced) return enhanced;
  const female = normal.find(v => isFemale(v.name));
  if (female) return female;
  return normal.find(v => v.default) ?? normal[0] ?? english[0];
}

// 영어 텍스트를 읽어준다. 반드시 버튼 클릭 등 사용자 제스처 핸들러에서
// 동기적으로 호출할 것 — iOS Safari는 speechSynthesis.speak()를 제스처
// 콜스택 밖(비동기)에서 호출하면 에러 없이 조용히 무시한다.
export function speakEnglish(text: string): void {
  const trimmed = text.trim();
  if (!trimmed || !('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel(); // 재생 중인 이전 발화와 겹치지 않도록 정지
  const utter = new SpeechSynthesisUtterance(trimmed);
  const voice = pickEnglishVoice();
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang ?? 'en-US';
  utter.rate = 0.9;
  utter.pitch = 1.0;
  window.speechSynthesis.speak(utter);
}
