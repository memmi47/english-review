import { useEffect, useRef, useState } from 'react'
import type { CorrectionRow, RewriteRow, Grade } from '../db'
import { dueStudyItems, reviewStudyItem } from '../db/study'
import type { StudyKind } from '../db/study'
import { styles, colors, radius } from '../shared/styles'
import { SpeakerButton } from '../shared/SpeakerButton'
import { wordDiff, generateCloze, clozeMatch } from '../shared/wordDiff'
import type { DiffToken } from '../shared/wordDiff'

// ── 타입 ──────────────────────────────────────────────

type PracticeMode = 'diff' | 'cloze'

interface PracticeItem {
  id: string
  kind: StudyKind
  row: CorrectionRow | RewriteRow
  mode: PracticeMode
  intended_meaning?: string
  source: string      // 내가 썼던 어색한 문장
  target: string      // 정답 (corrected / native_version)
  context: string     // 문법 설명 or 뉘앙스
  clozeText: string   // cloze 모드: _____ 포함 문장
  clozeAnswer: string // cloze 모드: 빈칸 정답
}

type Phase =
  | { tag: 'active' }
  | { tag: 'submitted'; input: string }

// ── 유틸 ──────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── diff 결과 렌더러 ─────────────────────────────────
// "내 입력" 위에 사용자가 쓴 것을 보여주되, 틀린 단어는 빨간 취소선.
// "정답" 위에 올바른 문장을 보여주되, 변경/추가된 단어는 초록 하이라이트.

function DiffView({ userAttempt, target }: { userAttempt: string; target: string }) {
  const diff = wordDiff(userAttempt, target)
  const userTokens = diff.filter(t => t.type !== 'insert')
  const targetTokens = diff.filter(t => t.type !== 'delete')

  return (
    <div style={localStyles.diffWrapper}>
      <div style={localStyles.diffRow}>
        <span style={localStyles.diffLabel}>내 입력</span>
        <p style={localStyles.diffLine}>
          {userTokens.map((t, i) => (
            <span key={i} style={{
              ...(t.type === 'delete' ? localStyles.diffDel : localStyles.diffEqual),
              marginRight: '0.25rem',
            }}>
              {t.text}
            </span>
          ))}
        </p>
      </div>
      <div style={localStyles.diffRow}>
        <span style={{ ...localStyles.diffLabel, color: colors.green }}>정답</span>
        <p style={localStyles.diffLine}>
          {targetTokens.map((t: DiffToken, i: number) => (
            <span key={i} style={{
              ...(t.type === 'insert' ? localStyles.diffIns : localStyles.diffEqual),
              marginRight: '0.25rem',
            }}>
              {t.text}
            </span>
          ))}
        </p>
      </div>
    </div>
  )
}

// ── 메인 화면 ─────────────────────────────────────────

export default function PracticeScreen() {
  const [items, setItems] = useState<PracticeItem[] | null>(null)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>({ tag: 'active' })
  const [userInput, setUserInput] = useState('')
  const [gradedCount, setGradedCount] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    (async () => {
      const studyItems = await dueStudyItems()
      const built: PracticeItem[] = []
      for (const si of studyItems) {
        const row = si.row as CorrectionRow & RewriteRow
        const source = si.kind === 'correction' ? row.original : row.user_expr
        const target = si.kind === 'correction' ? row.corrected : row.native_version
        const context = si.kind === 'correction' ? (row.rule ?? '') : (row.nuance ?? '')
        const intended_meaning = row.intended_meaning

        const clozeResult = generateCloze(source, target)
        // cloze 가능한 항목은 40% 확률로 cloze 모드, 나머지는 diff 재작성 모드
        const mode: PracticeMode = clozeResult && Math.random() < 0.4 ? 'cloze' : 'diff'

        built.push({
          id: row.id,
          kind: si.kind,
          row: si.row,
          mode,
          intended_meaning,
          source,
          target,
          context,
          clozeText: clozeResult?.clozeText ?? target,
          clozeAnswer: clozeResult?.answer ?? '',
        })
      }
      setItems(shuffle(built))
    })()
  }, [])

  async function handleGrade(grade: Grade) {
    if (!items) return
    await reviewStudyItem(items[index].kind, items[index].id, grade)
    setGradedCount(c => c + 1)
    setPhase({ tag: 'active' })
    setUserInput('')
    setShowHint(false)
    setIndex(i => i + 1)
  }

  function handleSubmit() {
    const trimmed = userInput.trim()
    if (!trimmed) return
    setPhase({ tag: 'submitted', input: trimmed })
  }

  // ── 로딩 ──
  if (!items) {
    return (
      <div style={styles.card}>
        <p style={styles.subtitle}>불러오는 중...</p>
      </div>
    )
  }

  // ── 오늘 연습 항목 없음 ──
  if (items.length === 0) {
    return (
      <div style={styles.card} className="animate-pop-in">
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
          <h2 style={{ ...styles.sectionTitle, textAlign: 'center', marginBottom: '0.4rem' }}>오늘 연습 완료!</h2>
          <p style={{ ...styles.subtitle, textAlign: 'center', margin: 0 }}>교정·Rewrite 카드가 아직 없거나 모두 완료되었어요.</p>
        </div>
      </div>
    )
  }

  // ── 모두 완료 ──
  if (index >= items.length) {
    const corrDone = items.filter(i => i.kind === 'correction').length
    const rewDone = items.filter(i => i.kind === 'rewrite').length
    return (
      <div style={styles.card} className="animate-pop-in">
        <div style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎊</div>
          <h2 style={{ ...styles.sectionTitle, textAlign: 'center', marginBottom: '0.5rem' }}>연습 완료!</h2>
          <p style={{ ...styles.subtitle, textAlign: 'center', margin: '0 0 1.25rem' }}>
            총 {gradedCount}개 문장을 연습했어요. 잘했어요!
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            {corrDone > 0 && (
              <div style={{
                background: colors.redBg, border: `1px solid ${colors.redBorder}`,
                borderRadius: radius.md, padding: '0.5rem 0.875rem', textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: colors.red }}>{corrDone}</div>
                <div style={{ fontSize: '0.68rem', color: colors.textMuted, marginTop: '1px' }}>교정</div>
              </div>
            )}
            {rewDone > 0 && (
              <div style={{
                background: colors.primaryLight, border: `1px solid ${colors.primary}`,
                borderRadius: radius.md, padding: '0.5rem 0.875rem', textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: colors.primary }}>{rewDone}</div>
                <div style={{ fontSize: '0.68rem', color: colors.textMuted, marginTop: '1px' }}>Rewrite</div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const item = items[index]
  const isSubmitted = phase.tag === 'submitted'
  const submittedInput = isSubmitted ? phase.input : ''

  // ── Cloze 모드에서 정답 여부 ──
  const clozeCorrect = item.mode === 'cloze' && isSubmitted
    ? clozeMatch(submittedInput, item.clozeAnswer)
    : false

  // ── 렌더 ──────────────────────────────────────────
  return (
    <div style={styles.card}>
      {/* 헤더 */}
      <div style={localStyles.headerRow}>
        <p style={styles.subtitle}>{index + 1} / {items.length}</p>
        <div style={localStyles.badgeRow}>
          <span style={localStyles.kindBadge}>{item.kind === 'correction' ? '교정' : 'Rewrite'}</span>
          <span style={localStyles.modeBadge}>
            {item.mode === 'diff' ? '✍️ 재작성' : '🔲 빈칸'}
          </span>
        </div>
      </div>

      {/* 모드별 본문 */}
      {item.mode === 'diff' ? (
        <DiffMode
          item={item}
          isSubmitted={isSubmitted}
          submittedInput={submittedInput}
          userInput={userInput}
          setUserInput={setUserInput}
          showHint={showHint}
          setShowHint={setShowHint}
          inputRef={inputRef}
          onSubmit={handleSubmit}
        />
      ) : (
        <ClozeMode
          item={item}
          isSubmitted={isSubmitted}
          submittedInput={submittedInput}
          clozeCorrect={clozeCorrect}
          userInput={userInput}
          setUserInput={setUserInput}
          showHint={showHint}
          setShowHint={setShowHint}
          inputRef={inputRef}
          onSubmit={handleSubmit}
        />
      )}

      {/* 자기평가 버튼 (제출 후에만 표시) */}
      {isSubmitted && (
        <div style={localStyles.gradeRow}>
          <button style={localStyles.againButton} onClick={() => handleGrade('again')}>
            🔁 더 연습할게요
          </button>
          <button style={localStyles.goodButton} onClick={() => handleGrade('good')}>
            😎 입에 붙었어요
          </button>
        </div>
      )}
    </div>
  )
}

// ── Diff 재작성 모드 ──────────────────────────────────

function DiffMode({
  item, isSubmitted, submittedInput, userInput, setUserInput,
  showHint, setShowHint, inputRef, onSubmit,
}: {
  item: PracticeItem
  isSubmitted: boolean
  submittedInput: string
  userInput: string
  setUserInput: (v: string) => void
  showHint: boolean
  setShowHint: (v: boolean) => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  onSubmit: () => void
}) {
  const variants = item.source.split('/').map(s => s.trim()).filter(Boolean)
  return (
    <div style={localStyles.body}>
      {/* 한국어 의도가 있으면 메인 프롬프트로 표시 */}
      <div style={localStyles.sourceBox}>
        {item.intended_meaning ? (
          <>
            <p style={localStyles.sourceLabel}>한국어 의도 (이 말을 영어로 어떻게 할까요?)</p>
            <p style={{ ...localStyles.sourceText, color: colors.primary, fontWeight: 700, fontSize: '1.05rem', fontStyle: 'normal' }}>
              {item.intended_meaning}
            </p>
          </>
        ) : (
          <>
            <p style={localStyles.sourceLabel}>내가 썼던 표현</p>
            {variants.map((v, i) => (
              <div key={i} style={localStyles.sourceRow}>
                <p style={localStyles.sourceText}>{v}</p>
                <SpeakerButton text={v} size="small" />
              </div>
            ))}
          </>
        )}
      </div>

      {item.intended_meaning && isSubmitted && (
        <div style={localStyles.sourceBoxSmall}>
          <p style={localStyles.sourceLabel}>당시 내가 말했던 틀린 표현</p>
          {variants.map((v, i) => (
            <p key={i} style={{...localStyles.sourceTextSmall, color: colors.red, textDecoration: 'line-through'}}>{v}</p>
          ))}
        </div>
      )}

      <p style={localStyles.instruction}>
        위 문장을 더 자연스럽게 고쳐 써보세요 👇
      </p>

      {!isSubmitted ? (
        <>
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            style={localStyles.textarea}
            placeholder="더 나은 표현을 직접 입력해보세요..."
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            rows={3}
          />
          <button
            style={{ ...styles.button, opacity: userInput.trim() ? 1 : 0.4 }}
            onClick={onSubmit}
            disabled={!userInput.trim()}
          >
            제출하고 비교하기
          </button>
        </>
      ) : (
        <>
          <DiffView userAttempt={submittedInput} target={item.target} />
          {/* 정답 발음 듣기 */}
          <div style={localStyles.targetRow}>
            <SpeakerButton text={item.target} />
            <p style={localStyles.targetText}>{item.target}</p>
          </div>
        </>
      )}

      {/* 힌트: 문법 설명 */}
      {item.context && (
        <button style={localStyles.hintToggle} onClick={() => setShowHint(!showHint)}>
          {showHint ? '▲ 힌트 닫기' : '💬 힌트 보기'}
        </button>
      )}
      {showHint && item.context && (
        <p style={localStyles.hint}>{item.context}</p>
      )}
    </div>
  )
}

// ── Cloze 빈칸 모드 ──────────────────────────────────

function ClozeMode({
  item, isSubmitted, submittedInput, clozeCorrect, userInput, setUserInput,
  showHint, setShowHint, inputRef, onSubmit,
}: {
  item: PracticeItem
  isSubmitted: boolean
  submittedInput: string
  clozeCorrect: boolean
  userInput: string
  setUserInput: (v: string) => void
  showHint: boolean
  setShowHint: (v: boolean) => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  onSubmit: () => void
}) {
  // _____를 시각적 블록으로 렌더링
  const parts = item.clozeText.split('_____')

  return (
    <div style={localStyles.body}>
      <p style={localStyles.instruction}>
        빈칸에 들어갈 표현을 입력해보세요 👇
      </p>

      {item.intended_meaning && (
        <div style={{...localStyles.sourceBox, background: colors.primaryLight, borderColor: colors.primary}}>
          <p style={{...localStyles.sourceLabel, color: colors.primary}}>한국어 의도</p>
          <p style={{ ...localStyles.sourceText, color: colors.primary, fontWeight: 700, fontSize: '1.05rem', fontStyle: 'normal' }}>
            {item.intended_meaning}
          </p>
        </div>
      )}

      {/* 빈칸 문장 */}
      <div style={localStyles.clozeBox}>
        <p style={localStyles.clozeText}>
          {parts[0]}
          <span style={isSubmitted
            ? (clozeCorrect ? localStyles.clozeFillCorrect : localStyles.clozeFillWrong)
            : localStyles.clozeBlank}>
            {isSubmitted ? submittedInput : '_____'}
          </span>
          {parts[1]}
        </p>
      </div>

      {!isSubmitted ? (
        <>
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            style={{ ...localStyles.textarea, minHeight: '60px' }}
            placeholder="빈칸에 들어갈 표현..."
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            rows={2}
          />
          <button
            style={{ ...styles.button, opacity: userInput.trim() ? 1 : 0.4 }}
            onClick={onSubmit}
            disabled={!userInput.trim()}
          >
            확인
          </button>
        </>
      ) : (
        <div style={clozeCorrect ? styles.resultBox : styles.errorBox}>
          <p style={clozeCorrect ? styles.resultTitle : styles.errorTitle}>
            {clozeCorrect ? '✅ 정확해요!' : '❌ 다시 확인해보세요'}
          </p>
          <div style={localStyles.answerRow}>
            <p style={localStyles.answerText}>정답: <strong>{item.clozeAnswer}</strong></p>
            <SpeakerButton text={item.target} size="small" />
          </div>
          <p style={localStyles.fullSentence}>{item.target}</p>
        </div>
      )}

      {/* 힌트 */}
      {item.context && (
        <button style={localStyles.hintToggle} onClick={() => setShowHint(!showHint)}>
          {showHint ? '▲ 힌트 닫기' : '💬 힌트 보기'}
        </button>
      )}
      {showHint && item.context && (
        <p style={localStyles.hint}>{item.context}</p>
      )}

      {/* 내가 썼던 원문 (참고용) */}
      <div style={localStyles.sourceBoxSmall}>
        <p style={localStyles.sourceLabel}>내가 썼던 표현 (참고)</p>
        {item.source.split('/').map((v, i) => (
          <p key={i} style={localStyles.sourceTextSmall}>{v.trim()}</p>
        ))}
      </div>
    </div>
  )
}

// ── 스타일 ────────────────────────────────────────────

const localStyles = {
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  badgeRow: {
    display: 'flex',
    gap: '0.4rem',
  },
  kindBadge: {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: colors.primary,
    background: colors.primaryLight,
    borderRadius: '999px',
    padding: '0.15rem 0.5rem',
  },
  modeBadge: {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: colors.textMuted,
    background: colors.surfaceAlt,
    borderRadius: '999px',
    padding: '0.15rem 0.5rem',
  },
  body: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.875rem',
  },
  sourceBox: {
    background: colors.surfaceAlt,
    borderRadius: '0.75rem',
    padding: '0.75rem 1rem',
    border: `1px dashed ${colors.borderStrong}`,
  },
  sourceLabel: {
    fontSize: '0.7rem',
    color: colors.textMuted,
    margin: '0 0 0.3rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  sourceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  sourceText: {
    fontSize: '0.95rem',
    color: colors.text,
    margin: 0,
    fontStyle: 'italic' as const,
  },
  instruction: {
    fontSize: '0.875rem',
    color: colors.textMuted,
    margin: 0,
    fontWeight: 500,
  },
  textarea: {
    width: '100%',
    minHeight: '90px',
    padding: '0.75rem',
    borderRadius: '0.75rem',
    border: `1.5px solid ${colors.primary}`,
    fontSize: '1rem',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    outline: 'none',
    color: colors.text,
    background: '#ffffff',
    colorScheme: 'light' as const,
    lineHeight: 1.5,
  },
  // diff view
  diffWrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    background: colors.surfaceAlt,
    borderRadius: '0.75rem',
    padding: '0.875rem',
    border: `1px solid ${colors.border}`,
  },
  diffRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.6rem',
  },
  diffLabel: {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: colors.textSubtle,
    minWidth: '2.8rem',
    paddingTop: '0.1rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    flexShrink: 0,
  },
  diffLine: {
    fontSize: '0.95rem',
    lineHeight: 1.7,
    margin: 0,
    wordBreak: 'break-word' as const,
  },
  diffEqual: {
    color: colors.text,
  },
  diffDel: {
    color: colors.red,
    textDecoration: 'line-through' as const,
    background: colors.redBg,
    borderRadius: '3px',
    padding: '0 2px',
  },
  diffIns: {
    color: colors.green,
    fontWeight: 700,
    background: colors.greenBg,
    borderRadius: '3px',
    padding: '0 2px',
  },
  targetRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: colors.greenBg,
    border: `1px solid ${colors.greenBorder}`,
    borderRadius: '0.75rem',
    padding: '0.75rem 1rem',
  },
  targetText: {
    fontSize: '1rem',
    fontWeight: 600,
    color: colors.green,
    margin: 0,
    wordBreak: 'break-word' as const,
  },
  // cloze
  clozeBox: {
    background: colors.surfaceAlt,
    borderRadius: '0.75rem',
    padding: '1rem',
    border: `1px solid ${colors.border}`,
  },
  clozeText: {
    fontSize: '1.05rem',
    lineHeight: 1.8,
    color: colors.text,
    margin: 0,
    wordBreak: 'break-word' as const,
  },
  clozeBlank: {
    display: 'inline-block',
    minWidth: '5rem',
    borderBottom: `2px solid ${colors.primary}`,
    margin: '0 0.25rem',
    padding: '0 0.25rem',
    color: 'transparent',
    background: colors.primaryLight,
    borderRadius: '3px',
  },
  clozeFillCorrect: {
    display: 'inline-block',
    margin: '0 0.25rem',
    padding: '0 0.35rem',
    background: colors.greenBg,
    color: colors.green,
    fontWeight: 700,
    borderRadius: '4px',
  },
  clozeFillWrong: {
    display: 'inline-block',
    margin: '0 0.25rem',
    padding: '0 0.35rem',
    background: colors.redBg,
    color: colors.red,
    textDecoration: 'line-through' as const,
    borderRadius: '4px',
  },
  answerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  answerText: {
    fontSize: '0.9rem',
    margin: 0,
    color: colors.text,
  },
  fullSentence: {
    fontSize: '0.85rem',
    color: colors.textMuted,
    fontStyle: 'italic' as const,
    margin: '0.25rem 0 0',
  },
  // hint
  hintToggle: {
    background: 'none',
    border: 'none',
    color: colors.primary,
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: '0.2rem 0',
    textAlign: 'left' as const,
    fontWeight: 600,
  },
  hint: {
    fontSize: '0.85rem',
    color: colors.amber,
    background: colors.amberBg,
    borderRadius: '0.5rem',
    padding: '0.6rem 0.75rem',
    margin: 0,
    lineHeight: 1.6,
  },
  sourceBoxSmall: {
    borderTop: `1px solid ${colors.divider}`,
    paddingTop: '0.75rem',
    marginTop: '0.25rem',
  },
  sourceTextSmall: {
    fontSize: '0.8rem',
    color: colors.textSubtle,
    fontStyle: 'italic' as const,
    margin: '0.15rem 0 0',
  },
  gradeRow: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '1rem',
  },
  againButton: {
    flex: 1,
    padding: '0.875rem',
    background: colors.redBg,
    color: colors.red,
    border: `1.5px solid ${colors.redBorder}`,
    borderRadius: '0.75rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  goodButton: {
    flex: 1,
    padding: '0.875rem',
    background: colors.greenBg,
    color: colors.green,
    border: `1.5px solid ${colors.greenBorder}`,
    borderRadius: '0.75rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
} as const
