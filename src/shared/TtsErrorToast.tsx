// TtsErrorToast.tsx — 발음 재생 실패 시 화면에 잠깐 보여주는 알림
//
// 사용자 기기가 원격이라 콘솔 로그를 볼 수 없으므로, 신경망 TTS가 실패하면
// (키 오류/네트워크 오류 등) 화면에 실제 에러 메시지를 잠깐 띄워 다음 문제
// 파악에 쓸 수 있게 한다. 브라우저 음성 폴백은 이미 재생되므로 소리 자체는
// 끊기지 않고, 이건 "다음엔 신경망 음성으로 안 들릴 수 있다"는 진단 정보다.
import { useEffect, useState } from 'react'
import { onTtsError } from './tts'
import { colors, radius, type } from './styles'

export function TtsErrorToast() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    return onTtsError(msg => setMessage(msg))
  }, [])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 6000)
    return () => clearTimeout(timer)
  }, [message])

  if (!message) return null

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 2rem)',
        maxWidth: '440px',
        background: colors.redBg,
        border: `1px solid ${colors.redBorder}`,
        borderRadius: radius.lg,
        padding: '0.75rem 1rem',
        boxShadow: '0 8px 24px rgba(15,23,42,0.16)',
        zIndex: 100,
        boxSizing: 'border-box',
      }}
    >
      <p style={{ margin: 0, fontSize: type.sm, color: colors.red, lineHeight: 1.5 }}>
        🔇 {message}
      </p>
    </div>
  )
}
