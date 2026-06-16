import { speakEnglish } from './tts'

export function SpeakerButton({ text, size = 'normal' }: { text: string; size?: 'small' | 'normal' }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); speakEnglish(text) }}
      aria-label="발음 듣기"
      title="발음 듣기"
      style={{
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: size === 'small' ? '1rem' : '1.4rem',
        padding: '0.15rem 0.3rem',
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      🔊
    </button>
  )
}
