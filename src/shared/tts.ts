// tts.ts — 브라우저 SpeechSynthesis 음성 선택 헬퍼
//
// 선택 우선순위:
//   1. Enhanced / Premium 표시가 붙은 신경망(Neural) 여성 영어 음성  ← 가장 자연스러움
//   2. Enhanced / Premium 표시가 붙은 신경망 영어 음성 (성별 무관)
//   3. 알려진 여성 이름의 일반 영어 음성
//   4. Novelty(장난) 음성을 제외한 나머지 영어 음성
//
// iOS Safari는 Enhanced 음성을 "Samantha (Enhanced)", "Ava (Enhanced)" 등으로
// 표기한다. Android Chrome은 "Google US English"가 실질적으로 Neural 품질이다.

const NOVELTY_VOICE_NAMES = [
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos',
  'good news', 'jester', 'organ', 'superstar', 'trinoids', 'whisper',
  'wobble', 'zarvox', 'bruce', 'fred', 'junior', 'kathy', 'princess',
  'ralph', 'grandma', 'grandpa', 'eddy', 'flo', 'reed', 'rocko', 'sandy', 'shelley',
]

// iOS/macOS·Windows·Android에서 자주 쓰이는 자연스러운 여성 영어 음성 이름 목록
const FEMALE_VOICE_NAMES = [
  'samantha', 'ava', 'allison', 'victoria', 'karen', 'moira', 'tessa',
  'fiona', 'nicky', 'susan', 'joanna', 'kimberly', 'ivy', 'salli', 'kendra',
  'ruth', 'aria', 'jenny', 'zira', 'hazel', 'linda', 'eva', 'sarah',
  'google us english', 'google uk english female',
]

let cachedVoices: SpeechSynthesisVoice[] = []

function loadVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  cachedVoices = window.speechSynthesis.getVoices()
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices()
  window.speechSynthesis.onvoiceschanged = loadVoices
}

function isNovelty(name: string): boolean {
  const n = name.toLowerCase()
  return NOVELTY_VOICE_NAMES.some(bad => n.includes(bad))
}

function isFemale(name: string): boolean {
  const n = name.toLowerCase()
  return FEMALE_VOICE_NAMES.some(f => n.includes(f))
}

function isEnhanced(name: string): boolean {
  const n = name.toLowerCase()
  return n.includes('enhanced') || n.includes('premium') || n.includes('neural')
}

function pickEnglishVoice(): SpeechSynthesisVoice | undefined {
  const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices()
  const english = voices.filter(v => v.lang.toLowerCase().startsWith('en'))
  const normal = english.filter(v => !isNovelty(v.name))

  // 1순위: Enhanced/Premium 여성 음성
  const enhancedFemale = normal.find(v => isEnhanced(v.name) && isFemale(v.name))
  if (enhancedFemale) return enhancedFemale

  // 2순위: Enhanced/Premium 음성 (성별 무관)
  const enhanced = normal.find(v => isEnhanced(v.name))
  if (enhanced) return enhanced

  // 3순위: 알려진 여성 이름 음성
  const female = normal.find(v => isFemale(v.name))
  if (female) return female

  // 4순위: 기본값 → 나머지 정상 음성
  return normal.find(v => v.default) ?? normal[0] ?? english[0]
}

// 영어 텍스트를 자연스러운 여성 목소리로 읽어준다.
export function speakEnglish(text: string): void {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  const voice = pickEnglishVoice()
  if (voice) utter.voice = voice
  utter.lang = voice?.lang ?? 'en-US'
  utter.rate = 0.9   // 0.95보다 살짝 느리게 — 자연스러운 발화 속도
  utter.pitch = 1.0  // pitch 조작은 오히려 로봇음 유발, 그대로 유지
  window.speechSynthesis.speak(utter)
}
