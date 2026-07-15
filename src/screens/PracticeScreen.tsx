import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CorrectionRow, RewriteRow, Grade } from '../db'
import { dueStudyItems, reviewStudyItem } from '../db/study'
import type { StudyKind } from '../db/study'
import { dueDrills, reviewDrill, answerMatches, totalDrillCount } from '../db/drills'
import type { DrillRow } from '../db/drills'
import { styles, colors, radius, type } from '../shared/styles'
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
  clozeWordCount: number
}

type Phase =
  | { tag: 'active' }
  | { tag: 'submitted'; input: string }

// ── 유틸 ──────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function firstWordHint(text: string): string {
  return text.trim().split(/\s+/).filter(Boolean)[0] ?? ''
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
//
// 문제은행(drills)이 있으면 문제은행만 보여준다. 정제되지 않은 원본
// 교정/Rewrite(LegacyPractice)는 문제은행이 아직 하나도 없을 때만
// 임시로 노출된다 — 정제된 문제와 미정제 원본이 섞여 보이면 문제은행을
// 만든 의미가 없어지기 때문에, 수동으로 전환할 방법은 두지 않는다.

export default function PracticeScreen() {
  const [hasDrills, setHasDrills] = useState<boolean | null>(null)

  useEffect(() => {
    (async () => setHasDrills((await totalDrillCount()) > 0))()
  }, [])

  if (hasDrills === null) {
    return (
      <div style={styles.card}>
        <p style={styles.subtitle}>불러오는 중...</p>
      </div>
    )
  }

  return hasDrills ? <DrillSession /> : <LegacyPractice />
}

// ── 문장 재작성 (기존 교정/Rewrite 연습) ──────────────

function LegacyPractice() {
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
          clozeWordCount: clozeResult ? wordCount(clozeResult.answer) : 0,
        })
      }
      setItems(built)
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

  function handleReveal() {
    if (!items) return
    const item = items[index]
    setPhase({ tag: 'submitted', input: item.mode === 'cloze' ? item.clozeAnswer : item.target })
    setUserInput('')
    setShowHint(true)
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
                background: colors.amberBg, border: `1px solid ${colors.amberBorder}`,
                borderRadius: radius.md, padding: '0.5rem 0.875rem', textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: colors.amber }}>{corrDone}</div>
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
            {item.mode === 'diff' ? '재작성' : '빈칸'}
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
          onReveal={handleReveal}
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
          onReveal={handleReveal}
        />
      )}

      {/* 자기평가 버튼 (제출 후에만 표시) */}
      {isSubmitted && (
        <div style={localStyles.gradeRow}>
          <button style={localStyles.againButton} onClick={() => handleGrade('again')}>
            더 연습할게요
          </button>
          <button style={localStyles.goodButton} onClick={() => handleGrade('good')}>
            입에 붙었어요
          </button>
        </div>
      )}
    </div>
  )
}

// ── 문제은행 세션 (choice / pattern / produce) ────────

// pattern 문제의 question은 끝에 " (pass)"처럼 빈칸에 쓸 핵심 단어를 괄호로
// 덧붙여둔다(정제 시 원본 문장을 그대로 빈칸화하지 않고 새 맥락으로 만들다 보니,
// 문장만 봐서는 어떤 단어를 활용해야 할지 알 수 없기 때문). 문장에 섞여 있으면
// 놓치기 쉬우므로 분리해서 별도 배지로 눈에 띄게 보여준다.
const WORD_HINT_RE = /\s*\(([a-zA-Z][a-zA-Z /]*)\)\s*$/

function splitWordHint(question: string): { sentence: string; wordHint: string | null } {
  const m = question.match(WORD_HINT_RE)
  if (!m) return { sentence: question, wordHint: null }
  return { sentence: question.slice(0, m.index), wordHint: m[1] }
}

// '_____' 빈칸을 채운 완성 문장 (발음 듣기용) — 핵심 단어 괄호 힌트는 제외
function filledSentence(drill: DrillRow): string {
  const { sentence } = drill.type === 'pattern' ? splitWordHint(drill.question) : { sentence: drill.question }
  return sentence.includes('_____')
    ? sentence.replace('_____', drill.answer)
    : drill.answer
}

// choice/pattern 공통: 문제 문장 카드. 답하기 전엔 빈칸, 정답이면 초록 텍스트,
// 오답(직접 시도)이면 "취소선 내 답 → 초록 정답"을 문장 안에 그대로 보여준다.
function QuestionCard({ drill, answered, userAnswer, correct, revealed }: {
  drill: DrillRow
  answered: boolean
  userAnswer: string
  correct: boolean
  revealed: boolean
}) {
  const { sentence, wordHint } = drill.type === 'pattern' ? splitWordHint(drill.question) : { sentence: drill.question, wordHint: null }
  const parts = sentence.split('_____')
  return (
    <div style={drillStyles.questionCard}>
      {wordHint && (
        <p style={drillStyles.wordHintBadge}>
          🔑 이 단어를 활용해서 빈칸을 채워보세요: <strong>{wordHint}</strong>
        </p>
      )}
      <p style={drillStyles.questionText}>
        {parts[0]}
        {!answered ? (
          <span style={drillStyles.blank}>&nbsp;</span>
        ) : correct ? (
          <span style={{ color: colors.green, fontWeight: 700 }}>{drill.answer}</span>
        ) : !revealed && userAnswer ? (
          <>
            <span style={{ textDecoration: 'line-through', color: colors.textSubtle }}>{userAnswer}</span>
            {' → '}
            <span style={{ color: colors.green, fontWeight: 700 }}>{drill.answer}</span>
          </>
        ) : (
          <span style={{ color: colors.green, fontWeight: 700 }}>{drill.answer}</span>
        )}
        {parts[1]}
      </p>
    </div>
  )
}

// 정답/배울 기회 피드백 배너 (title + 해설)
function FeedbackBanner({ correct, revealed, explain }: { correct: boolean; revealed: boolean; explain: string }) {
  const tone = correct ? 'green' : 'amber'
  return (
    <div style={tone === 'green' ? drillStyles.bannerGreen : drillStyles.bannerAmber}>
      <p style={{ ...drillStyles.bannerTitle, color: tone === 'green' ? colors.green : colors.amber }}>
        {revealed ? '정답을 확인했어요' : correct ? '정확해요' : '배울 기회예요'}
      </p>
      {explain && <p style={drillStyles.bannerBody}>{explain}</p>}
    </div>
  )
}

type DrillPhase =
  | { tag: 'active' }
  | { tag: 'answered'; userAnswer: string; correct: boolean; revealed: boolean }

function DrillSession() {
  const [queue, setQueue] = useState<DrillRow[] | null>(null)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<DrillPhase>({ tag: 'active' })
  const [userInput, setUserInput] = useState('')
  const [doneCount, setDoneCount] = useState(0)
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    (async () => setQueue(await dueDrills(20)))()
  }, [])

  function answerChoice(choice: string) {
    if (!queue || phase.tag !== 'active') return
    const drill = queue[index]
    setPhase({ tag: 'answered', userAnswer: choice, correct: choice === drill.answer, revealed: false })
  }

  function answerTyped() {
    if (!queue) return
    const trimmed = userInput.trim()
    if (!trimmed) return
    const drill = queue[index]
    setPhase({ tag: 'answered', userAnswer: trimmed, correct: answerMatches(trimmed, drill), revealed: false })
  }

  function reveal() {
    if (!queue) return
    setPhase({ tag: 'answered', userAnswer: '', correct: false, revealed: true })
    setShowHint(true)
  }

  async function next() {
    if (!queue || phase.tag !== 'answered') return
    await reviewDrill(queue[index].id, phase.correct ? 'good' : 'again')
    setDoneCount(c => c + 1)
    setPhase({ tag: 'active' })
    setUserInput('')
    setShowHint(false)
    setIndex(i => i + 1)
  }

  if (!queue) {
    return (
      <div style={styles.card}>
        <p style={styles.subtitle}>불러오는 중...</p>
      </div>
    )
  }

  if (queue.length === 0 || index >= queue.length) {
    const finished = queue.length > 0
    return (
      <div style={styles.card} className="animate-pop-in">
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{finished ? '🎊' : '🎉'}</div>
          <h2 style={{ ...styles.sectionTitle, textAlign: 'center', marginBottom: '0.4rem' }}>
            {finished ? '오늘 문제은행 완료!' : '오늘 풀 문제가 없어요'}
          </h2>
          <p style={{ ...styles.subtitle, textAlign: 'center', margin: 0 }}>
            {finished
              ? `${doneCount}문제를 풀었어요. 잘했어요!`
              : '문제은행의 모든 문제가 다음 복습일을 기다리고 있어요.'}
          </p>
        </div>
      </div>
    )
  }

  const drill = queue[index]
  const answered = phase.tag === 'answered'
  const correct = answered && phase.correct
  const revealed = answered && phase.revealed
  const userAnswer = answered ? phase.userAnswer : ''

  return (
    <div style={styles.card}>
      {/* 헤더 */}
      <div style={localStyles.headerRow}>
        <p style={drillStyles.progress}>{index + 1} / {queue.length}</p>
        <div style={localStyles.badgeRow}>
          {drill.severity && (
            <span style={localStyles.modeBadge}>{drill.severity}</span>
          )}
          {drill.tag && <span style={localStyles.modeBadge}>{drill.tag}</span>}
        </div>
      </div>

      <div style={drillStyles.body}>
        {/* ── produce: 한국어 의도 제시 ── */}
        {drill.type === 'produce' ? (
          <>
            <div style={drillStyles.promptCard}>
              <p style={drillStyles.promptLabel}>이 말을 영어로 해보세요</p>
              <p style={drillStyles.promptText}>{drill.question}</p>
            </div>

            {!answered ? (
              <>
                <textarea
                  style={drillStyles.textarea}
                  placeholder="영어로 입력해보세요... (소리 내어 말한 뒤 적으면 더 좋아요)"
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  rows={3}
                />
                <div style={drillStyles.actionRow}>
                  <button
                    style={{ ...drillStyles.primaryButton, opacity: userInput.trim() ? 1 : 0.55, flex: 1 }}
                    onClick={answerTyped}
                    disabled={!userInput.trim()}
                  >
                    제출하고 비교하기
                  </button>
                  <button style={{ ...drillStyles.mutedButton, flex: 1 }} onClick={reveal}>
                    정답 보기
                  </button>
                </div>
              </>
            ) : (
              <>
                {!revealed && userAnswer && (
                  <div style={drillStyles.myAnswerBox}>
                    <p style={drillStyles.myAnswerLabel}>내 답안</p>
                    <p style={drillStyles.myAnswerText}>{userAnswer}</p>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {[drill.answer, ...drill.accept].map((ans, i) => (
                    <div key={i} style={drillStyles.bannerGreen}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <p style={{ ...drillStyles.answerLabel, color: colors.green }}>
                          모범 답안{[drill.answer, ...drill.accept].length > 1 ? ` ${i + 1}` : ''}
                        </p>
                        <SpeakerButton text={ans} size="small" />
                      </div>
                      <p style={drillStyles.answerText}>{ans}</p>
                    </div>
                  ))}
                </div>
                <FeedbackBanner correct={correct} revealed={revealed} explain={drill.explain} />
              </>
            )}
          </>
        ) : (
          <>
            {/* ── choice / pattern: 빈칸 문장 ── */}
            <p style={drillStyles.instruction}>
              {drill.type === 'choice' ? '빈칸에 맞는 표현을 골라보세요' : '빈칸에 들어갈 표현을 직접 입력해보세요'}
            </p>

            <QuestionCard drill={drill} answered={answered} userAnswer={userAnswer} correct={correct} revealed={revealed} />

            {drill.type === 'choice' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {drill.choices.map(choice => {
                  const isCorrectChoice = choice === drill.answer
                  const isSelected = answered && choice === userAnswer
                  let choiceStyle: CSSProperties = drillStyles.choiceButton
                  let className = ''
                  let suffix: string | null = null
                  if (answered) {
                    if (isCorrectChoice) {
                      choiceStyle = drillStyles.choiceCorrect
                      suffix = isSelected ? '✓' : '✓ 정답'
                      if (isSelected) className = 'fx-correct'
                    } else if (isSelected) {
                      choiceStyle = drillStyles.choiceWrong
                      className = 'fx-wrong'
                    } else {
                      choiceStyle = drillStyles.choiceDisabled
                    }
                  }
                  return (
                    <button
                      key={choice}
                      className={className}
                      style={choiceStyle}
                      onClick={() => answerChoice(choice)}
                      disabled={answered}
                    >
                      <span>{choice}</span>
                      {suffix && <span>{suffix}</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {drill.type === 'pattern' && !answered && (
              <>
                <textarea
                  style={{ ...drillStyles.textarea, minHeight: '4rem' }}
                  placeholder="빈칸에 들어갈 표현..."
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  rows={2}
                />
                <div style={drillStyles.actionRow}>
                  <button
                    style={{ ...drillStyles.softButton, opacity: userInput.trim() ? 1 : 0.55, flex: 1 }}
                    onClick={answerTyped}
                    disabled={!userInput.trim()}
                  >
                    확인
                  </button>
                  <button style={{ ...drillStyles.mutedButton, flex: 1 }} onClick={reveal}>
                    정답 보기
                  </button>
                </div>
              </>
            )}

            {/* 채점 결과 + 발음 듣기 */}
            {answered && (
              <>
                <FeedbackBanner correct={correct} revealed={revealed} explain={drill.explain} />
                <div style={drillStyles.listenRow}>
                  <SpeakerButton text={filledSentence(drill)} size="small" />
                  <p style={drillStyles.listenText}>{filledSentence(drill)}</p>
                </div>
              </>
            )}
          </>
        )}

        {/* 힌트 (답하기 전) */}
        {!answered && drill.hint && (
          <>
            <button style={drillStyles.hintToggle} onClick={() => setShowHint(!showHint)}>
              💡 {showHint ? '힌트 닫기' : '힌트 보기'}
            </button>
            {showHint && <p style={drillStyles.hintBody}>{drill.hint}</p>}
          </>
        )}
      </div>

      {/* 다음 문제 */}
      {answered && (
        <button style={{ ...drillStyles.primaryButton, marginTop: '1.25rem' }} onClick={next}>
          다음 문제 →
        </button>
      )}
    </div>
  )
}

const drillStyles = {
  progress: {
    fontSize: type.xs,
    color: colors.textSubtle,
    fontWeight: 600,
    margin: 0,
  },
  body: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.25rem',
  },
  instruction: {
    fontSize: type.sm,
    color: colors.textMuted,
    margin: 0,
    fontWeight: 500,
  },
  questionCard: {
    padding: '1.5rem 1.25rem',
    borderRadius: radius.xl,
    background: colors.surface,
    boxShadow: 'var(--shadow-card)',
  },
  questionText: {
    fontSize: type.lg,
    fontWeight: 600,
    lineHeight: 1.5,
    color: colors.text,
    margin: 0,
  },
  wordHintBadge: {
    fontSize: type.sm,
    fontWeight: 700,
    color: colors.primaryStrong,
    background: colors.primarySoft,
    borderRadius: radius.md,
    padding: '0.5rem 0.75rem',
    margin: '0 0 0.75rem',
    lineHeight: 1.5,
  },
  blank: {
    display: 'inline-block',
    minWidth: '5.5rem',
    borderBottom: `2px solid ${colors.primary}`,
  },
  promptCard: {
    padding: '1.25rem',
    borderRadius: radius.xl,
    background: colors.primarySoft,
    border: `1px solid ${colors.border}`,
  },
  promptLabel: {
    fontSize: type.sm,
    color: colors.primary,
    fontWeight: 600,
    margin: '0 0 0.5rem',
  },
  promptText: {
    fontSize: type.md,
    fontWeight: 700,
    lineHeight: 1.5,
    color: colors.text,
    margin: 0,
  },
  choiceButton: {
    width: '100%',
    minHeight: '3.5rem',
    padding: '0 1.125rem',
    background: colors.surface,
    color: colors.text,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radius.lg,
    fontSize: type.base,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  choiceCorrect: {
    width: '100%',
    minHeight: '3.5rem',
    padding: '0 1.125rem',
    background: colors.greenBg,
    color: colors.green,
    border: `1.5px solid ${colors.greenBorder}`,
    borderRadius: radius.lg,
    fontSize: type.base,
    fontWeight: 700,
    cursor: 'default',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  choiceWrong: {
    width: '100%',
    minHeight: '3.5rem',
    padding: '0 1.125rem',
    background: colors.amberBg,
    color: colors.amber,
    border: `1.5px solid ${colors.amberBorder}`,
    borderRadius: radius.lg,
    fontSize: type.base,
    fontWeight: 700,
    cursor: 'default',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  choiceDisabled: {
    width: '100%',
    minHeight: '3.5rem',
    padding: '0 1.125rem',
    background: colors.surface,
    color: colors.textSubtle,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radius.lg,
    fontSize: type.base,
    fontWeight: 600,
    cursor: 'default',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    opacity: 0.6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  textarea: {
    width: '100%',
    minHeight: '5.5rem',
    padding: '0.875rem',
    borderRadius: radius.md,
    border: `1.5px solid ${colors.primary}`,
    fontSize: type.base,
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    outline: 'none',
    color: colors.text,
    background: colors.surface,
    colorScheme: 'light' as const,
    lineHeight: 1.5,
  },
  actionRow: {
    display: 'flex',
    gap: '0.625rem',
  },
  primaryButton: {
    minHeight: '3.5rem',
    border: 'none',
    borderRadius: radius.lg,
    background: colors.primary,
    color: '#fff',
    fontSize: type.base,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
  },
  softButton: {
    minHeight: '3.25rem',
    border: 'none',
    borderRadius: radius.lg,
    background: colors.primarySoft,
    color: colors.primary,
    fontSize: type.base,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  mutedButton: {
    minHeight: '3.25rem',
    border: `1.5px solid ${colors.border}`,
    borderRadius: radius.lg,
    background: colors.surface,
    color: colors.textMuted,
    fontSize: type.base,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  myAnswerBox: {
    padding: '1rem',
    borderRadius: radius.lg,
    background: colors.surfaceSunken,
    border: `1px solid ${colors.border}`,
  },
  myAnswerLabel: {
    fontSize: type.xs,
    color: colors.textSubtle,
    fontWeight: 700,
    margin: '0 0 0.4rem',
  },
  myAnswerText: {
    fontSize: type.base,
    lineHeight: 1.6,
    color: colors.text,
    margin: 0,
  },
  answerLabel: {
    fontSize: type.xs,
    fontWeight: 700,
    margin: 0,
  },
  answerText: {
    fontSize: type.base,
    fontWeight: 600,
    lineHeight: 1.6,
    color: colors.text,
    margin: '0.4rem 0 0',
  },
  bannerGreen: {
    padding: '1rem',
    borderRadius: radius.lg,
    background: colors.greenBg,
    border: `1px solid ${colors.greenBorder}`,
  },
  bannerAmber: {
    padding: '1rem',
    borderRadius: radius.lg,
    background: colors.amberBg,
    border: `1px solid ${colors.amberBorder}`,
  },
  bannerTitle: {
    fontSize: type.md,
    fontWeight: 700,
    margin: '0 0 0.4rem',
  },
  bannerBody: {
    fontSize: type.sm,
    lineHeight: 1.6,
    color: colors.textMuted,
    margin: 0,
  },
  listenRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  listenText: {
    fontSize: type.sm,
    color: colors.textMuted,
    fontStyle: 'italic' as const,
    margin: 0,
  },
  hintToggle: {
    background: 'none',
    border: 'none',
    color: colors.primary,
    fontSize: type.sm,
    cursor: 'pointer',
    padding: '0.2rem 0',
    textAlign: 'left' as const,
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  hintBody: {
    fontSize: type.sm,
    color: colors.textMuted,
    background: colors.surfaceSunken,
    borderRadius: radius.md,
    padding: '0.75rem 0.875rem',
    margin: 0,
    lineHeight: 1.6,
  },
} as const

// ── Diff 재작성 모드 ──────────────────────────────────

function DiffMode({
  item, isSubmitted, submittedInput, userInput, setUserInput,
  showHint, setShowHint, inputRef, onSubmit, onReveal,
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
  onReveal: () => void
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
            <p key={i} style={{...localStyles.sourceTextSmall, color: colors.textSubtle, textDecoration: 'line-through'}}>{v}</p>
          ))}
        </div>
      )}

      <div style={localStyles.promptRow}>
        <p style={localStyles.instruction}>
          위 문장을 더 자연스럽게 고쳐 써보세요
        </p>
        <span style={localStyles.wordHint}>{wordCount(item.target)} words</span>
      </div>

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
          <div style={localStyles.actionRow}>
            <button
              style={{ ...styles.button, opacity: userInput.trim() ? 1 : 0.4, flex: 1 }}
              onClick={onSubmit}
              disabled={!userInput.trim()}
            >
              제출하고 비교하기
            </button>
            <button style={{ ...styles.secondaryButton, flex: 1 }} onClick={onReveal}>
              정답 보기
            </button>
          </div>
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
          {showHint ? '힌트 닫기' : '힌트 보기'}
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
  showHint, setShowHint, inputRef, onSubmit, onReveal,
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
  onReveal: () => void
}) {
  // _____를 시각적 블록으로 렌더링
  const parts = item.clozeText.split('_____')

  return (
    <div style={localStyles.body}>
      <div style={localStyles.promptRow}>
        <p style={localStyles.instruction}>
          빈칸에 들어갈 표현을 입력해보세요
        </p>
        <span style={localStyles.wordHint}>{item.clozeWordCount} words</span>
      </div>

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
        {!isSubmitted && firstWordHint(item.clozeAnswer) && (
          <p style={localStyles.clozeHelp}>
            첫 단어: {firstWordHint(item.clozeAnswer)}
          </p>
        )}
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
          <div style={localStyles.actionRow}>
            <button
              style={{ ...styles.button, opacity: userInput.trim() ? 1 : 0.4, flex: 1 }}
              onClick={onSubmit}
              disabled={!userInput.trim()}
            >
              확인
            </button>
            <button style={{ ...styles.secondaryButton, flex: 1 }} onClick={onReveal}>
              정답 보기
            </button>
          </div>
        </>
      ) : (
        <div style={clozeCorrect ? drillStyles.bannerGreen : drillStyles.bannerAmber}>
          <p style={{ ...drillStyles.bannerTitle, color: clozeCorrect ? colors.green : colors.amber }}>
            {clozeCorrect ? '정확해요' : '배울 기회예요'}
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
          {showHint ? '힌트 닫기' : '힌트 보기'}
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
  promptRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap' as const,
  },
  wordHint: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: colors.primary,
    background: colors.primaryLight,
    border: `1px solid ${colors.primary}`,
    borderRadius: radius.pill,
    padding: '0.18rem 0.55rem',
    whiteSpace: 'nowrap' as const,
  },
  actionRow: {
    display: 'flex',
    gap: '0.5rem',
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
    color: colors.textSubtle,
    textDecoration: 'line-through' as const,
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
  clozeHelp: {
    fontSize: '0.76rem',
    color: colors.textMuted,
    margin: '0.65rem 0 0',
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
    background: colors.amberBg,
    color: colors.amber,
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
    background: colors.amberBg,
    color: colors.amber,
    border: `1.5px solid ${colors.amberBorder}`,
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
