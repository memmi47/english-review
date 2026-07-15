// tts.ts — 발음 듣기 (2단 구조)
//
//   1) OpenRouter 신경망 TTS (설정에서 API 키 입력 시)
//      - 모델: openai/gpt-4o-mini-tts — 사람 수준의 자연스러운 음성
//      - 같은 문장은 IndexedDB에 캐싱해 재생성 비용 없이 오프라인 재생
//      - iOS 오디오 정책 대응: 버튼 탭(제스처) 시점에 AudioContext를 먼저
//        resume하고, mp3는 Web Audio로 디코딩해 재생한다.
//   2) 브라우저 SpeechSynthesis 폴백 (키 없음/네트워크 오류 시)
//      - iOS Safari는 웹에 저품질 기본 음성만 노출하는 한계가 있음
//        (다운로드한 Enhanced/Premium 음성은 웹에서 보이지 않는 알려진 제약)

import Dexie, { type Table } from 'dexie';

// ── 설정 (localStorage) ───────────────────────────────

const KEY_API = 'tts_openrouter_key';
const KEY_VOICE = 'tts_voice';

export const TTS_MODEL = 'openai/gpt-4o-mini-tts';

// gpt-4o-mini-tts 지원 음성 중 학습용으로 추천할 만한 것들
export const TTS_VOICES: { id: string; label: string }[] = [
  { id: 'nova',    label: 'Nova — 밝고 또렷한 여성 (기본)' },
  { id: 'shimmer', label: 'Shimmer — 차분한 여성' },
  { id: 'coral',   label: 'Coral — 따뜻한 여성' },
  { id: 'sage',    label: 'Sage — 부드러운 여성' },
  { id: 'alloy',   label: 'Alloy — 중성적인 톤' },
  { id: 'echo',    label: 'Echo — 남성' },
  { id: 'onyx',    label: 'Onyx — 저음 남성' },
  { id: 'fable',   label: 'Fable — 영국식 억양' },
];

// 빌드 시 Vercel 환경변수로 내장된 키 (소스 코드/GitHub에는 올라가지 않음)
const BUILTIN_KEY: string =
  (import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined) ?? '';

export function hasBuiltinKey(): boolean {
  return BUILTIN_KEY.length > 0;
}

// 우선순위: 설정 화면에서 직접 입력한 키 > 빌드에 내장된 키
export function getTtsApiKey(): string {
  try { return localStorage.getItem(KEY_API) || BUILTIN_KEY } catch { return BUILTIN_KEY }
}

// 설정 화면 표시용: 직접 입력한 키만 (내장 키는 노출하지 않음)
export function getManualTtsApiKey(): string {
  try { return localStorage.getItem(KEY_API) ?? '' } catch { return '' }
}
export function setTtsApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(KEY_API, key.trim());
    else localStorage.removeItem(KEY_API);
  } catch { /* noop */ }
}
export function getTtsVoice(): string {
  try { return localStorage.getItem(KEY_VOICE) ?? 'nova' } catch { return 'nova' }
}
export function setTtsVoice(voice: string): void {
  try { localStorage.setItem(KEY_VOICE, voice) } catch { /* noop */ }
}
export function neuralTtsEnabled(): boolean {
  return getTtsApiKey().length > 0;
}

// ── 오디오 캐시 (IndexedDB) ───────────────────────────

interface TtsClip {
  key: string;        // `${model}|${voice}|${text}`
  audio: ArrayBuffer; // mp3 바이트
  bytes: number;
  created_at: string;
}

class TtsCacheDB extends Dexie {
  clips!: Table<TtsClip, string>;
  constructor() {
    super('EnglishReviewTtsCacheDB');
    this.version(1).stores({ clips: 'key' });
  }
}

const cacheDB = new TtsCacheDB();

export async function ttsCacheStats(): Promise<{ count: number; mb: number }> {
  const clips = await cacheDB.clips.toArray();
  const bytes = clips.reduce((s, c) => s + (c.bytes ?? 0), 0);
  return { count: clips.length, mb: Math.round(bytes / 1024 / 1024 * 10) / 10 };
}

export async function clearTtsCache(): Promise<void> {
  await cacheDB.clips.clear();
}

// ── Web Audio 재생 (iOS 제스처 정책 대응) ─────────────

let audioCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;

function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  // 사용자 제스처 콜스택 안에서 호출되어야 iOS에서 재생이 풀린다.
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

function stopCurrentAudio(): void {
  if (currentSource) {
    try { currentSource.stop() } catch { /* 이미 종료됨 */ }
    currentSource = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

async function playMp3(ctx: AudioContext, mp3: ArrayBuffer): Promise<void> {
  // decodeAudioData는 버퍼를 소유하므로 캐시 원본 보호를 위해 복사본 사용
  const buf = await ctx.decodeAudioData(mp3.slice(0));
  stopCurrentAudio();
  const source = ctx.createBufferSource();
  source.buffer = buf;
  source.connect(ctx.destination);
  source.start();
  currentSource = source;
  source.onended = () => { if (currentSource === source) currentSource = null };
}

// ── OpenRouter 신경망 TTS ─────────────────────────────

async function fetchNeuralAudio(text: string, voice: string, apiKey: string): Promise<ArrayBuffer> {
  const res = await fetch('https://openrouter.ai/api/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: text,
      voice,
      response_format: 'mp3',
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TTS API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.arrayBuffer();
}

async function speakNeural(text: string, ctx: AudioContext): Promise<void> {
  const voice = getTtsVoice();
  const apiKey = getTtsApiKey();
  const key = `${TTS_MODEL}|${voice}|${text}`;

  const cached = await cacheDB.clips.get(key);
  if (cached) {
    await playMp3(ctx, cached.audio);
    return;
  }

  const audio = await fetchNeuralAudio(text, voice, apiKey);
  await cacheDB.clips.put({
    key, audio, bytes: audio.byteLength, created_at: new Date().toISOString(),
  }).catch(() => { /* 캐시 실패해도 재생은 진행 */ });
  await playMp3(ctx, audio);
}

// ── 브라우저 SpeechSynthesis 폴백 ─────────────────────

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

function speakWithBrowser(text: string): void {
  if (!('speechSynthesis' in window)) return;
  stopCurrentAudio(); // 재생 중인 Web Audio 소스·기존 발화를 함께 정지 (겹침 방지)
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickEnglishVoice();
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang ?? 'en-US';
  utter.rate = 0.9;
  utter.pitch = 1.0;
  window.speechSynthesis.speak(utter);
}

// ── 공개 API ──────────────────────────────────────────

// 영어 텍스트를 읽어준다. 반드시 버튼 클릭 등 사용자 제스처 핸들러에서
// 동기적으로 호출할 것 (iOS 오디오 정책).
//
// iOS Safari는 speechSynthesis.speak()를 "제스처 콜스택 밖(비동기)"에서
// 호출하면 에러 없이 조용히 무시한다. 예전엔 "신경망 음성 시도 → 실패하면
// 비동기로 브라우저 음성 폴백" 구조였는데, 바로 이 폴백 호출이 비동기라서
// 신경망 음성이 조금이라도 실패하면(키 없음/네트워크 오류 등) 완전한
// 무음이 되는 문제가 있었다.
//
// 그래서 순서를 뒤집는다: 이미 캐시된 문장(재생 이력 있음)만 신경망 음성으로
// 재생하고 — Web Audio는 AudioContext를 한 번 unlock해두면 이후 비동기
// 재생도 안전하다 — 처음 듣는 문장은 항상 브라우저 음성을 제스처 안에서
// 즉시 재생하고, 신경망 음성은 백그라운드에서 캐시만 해둔다(다음에 같은
// 문장을 들을 때부터 신경망 음성으로 들림).
export function speakEnglish(text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  if (neuralTtsEnabled()) {
    // 제스처 콜스택 안에서 AudioContext를 먼저 확보/해제 (Web Audio unlock)
    const ctx = ensureAudioContext();
    if (ctx) {
      const voice = getTtsVoice();
      const apiKey = getTtsApiKey();
      const key = `${TTS_MODEL}|${voice}|${trimmed}`;

      cacheDB.clips.get(key).then(cached => {
        if (cached) {
          // 캐시 재생: AudioContext는 이미 unlock되어 있어 비동기여도 안전
          playMp3(ctx, cached.audio).catch(() => speakWithBrowser(trimmed));
          return;
        }
        // 최초 재생: 무음 방지를 위해 브라우저 음성을 즉시(동기적으로) 재생
        speakWithBrowser(trimmed);
        // 신경망 음성은 백그라운드에서 받아 캐시만 해둔다 (재생하지 않음)
        fetchNeuralAudio(trimmed, voice, apiKey)
          .then(audio => cacheDB.clips.put({
            key, audio, bytes: audio.byteLength, created_at: new Date().toISOString(),
          }))
          .catch(err => console.warn('신경망 TTS 백그라운드 캐시 실패:', err));
      }).catch(() => speakWithBrowser(trimmed));
      return;
    }
  }
  speakWithBrowser(trimmed);
}

// 설정 화면의 "테스트" 버튼용: 성공/실패를 알려준다.
export async function testNeuralTts(text: string): Promise<{ ok: boolean; message: string }> {
  if (!neuralTtsEnabled()) {
    return { ok: false, message: 'API 키를 먼저 입력해주세요.' };
  }
  const ctx = ensureAudioContext();
  if (!ctx) return { ok: false, message: '이 브라우저는 오디오 재생을 지원하지 않아요.' };
  try {
    await speakNeural(text.trim(), ctx);
    return { ok: true, message: '재생 성공 — 이제 모든 발음 버튼이 이 음성으로 나옵니다.' };
  } catch (e) {
    return { ok: false, message: `실패: ${e instanceof Error ? e.message : String(e)}` };
  }
}
