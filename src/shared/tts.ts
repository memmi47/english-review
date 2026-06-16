// tts.ts — 브라우저 SpeechSynthesis 음성 선택 헬퍼
// iOS/Safari는 "Albert", "Bahh", "Zarvox" 같은 장난(novelty) 음성을 기본 목록에
// 섞어두는데, 이런 음성은 쉰 목소리·로봇음처럼 들린다. 정상적인 음성만 골라 쓴다.

const NOVELTY_VOICE_NAMES = [
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos',
  'good news', 'jester', 'organ', 'superstar', 'trinoids', 'whisper',
  'wobble', 'zarvox', 'bruce', 'fred', 'junior', 'kathy', 'princess',
  'ralph', 'grandma', 'grandpa', 'eddy', 'flo', 'reed', 'rocko', 'sandy', 'shelley',
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

function pickEnglishVoice(): SpeechSynthesisVoice | undefined {
  const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices()
  const english = voices.filter(v => v.lang.toLowerCase().startsWith('en'))
  const normal = english.filter(v => !isNovelty(v.name))
  return (
    normal.find(v => v.name.includes('Samantha')) ||
    normal.find(v => v.default) ||
    normal[0] ||
    english[0]
  )
}

// 영어 텍스트를 정상적인(장난 음성이 아닌) 목소리로 읽어준다.
export function speakEnglish(text: string): void {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  const voice = pickEnglishVoice()
  if (voice) utter.voice = voice
  utter.lang = voice?.lang ?? 'en-US'
  utter.rate = 0.95
  utter.pitch = 1
  window.speechSynthesis.speak(utter)
}
