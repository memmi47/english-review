// DashboardScreen.tsx — Phase 2: 분석 | 기록 세그먼트 컨트롤
import { useEffect, useState } from 'react'
import {
  tagRecurrence, phraseAdoption, dueForReview,
  sessionTrend, masteryDistribution, unadoptedPhrases, allSessions, sessionDetail,
} from '../db'
import type { TagStat, SessionTrendPoint, MasteryDist } from '../db'
import type { SessionRow, CorrectionRow, RewriteRow, PhraseRow } from '../db/schema'
import { dueStudyItems } from '../db/study'
import { styles, colors, radius } from '../shared/styles'
import { SpeakerButton } from '../shared/SpeakerButton'

type Seg = 'analytics' | 'history'

// ── 메인 ─────────────────────────────────────────────────────

export default function DashboardScreen({ onGoReview }: { onGoReview: () => void }) {
  const [seg, setSeg] = useState<Seg>('analytics')
  const [selectedSession, setSelectedSession] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* 세그먼트 컨트롤 */}
      <div style={{
        display: 'flex',
        background: colors.surfaceAlt,
        borderRadius: radius.lg,
        padding: '3px',
        border: `1px solid ${colors.border}`,
      }}>
        {(['analytics', 'history'] as Seg[]).map(s => (
          <button
            key={s}
            onClick={() => { setSeg(s); setSelectedSession(null) }}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: radius.md,
              border: 'none',
              fontFamily: 'inherit',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s, color 0.15s, box-shadow 0.2s',
              background: seg === s ? colors.surface : 'transparent',
              color: seg === s ? colors.primary : colors.textMuted,
              boxShadow: seg === s ? 'var(--shadow-card)' : 'none',
            }}
          >
            {s === 'analytics' ? '분석' : '기록'}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {seg === 'analytics' && <AnalyticsTab onGoReview={onGoReview} />}
      {seg === 'history' && (
        selectedSession
          ? <SessionDetailView sessionId={selectedSession} onBack={() => setSelectedSession(null)} />
          : <HistoryTab onSelectSession={setSelectedSession} />
      )}
    </div>
  )
}

// ── 분석 탭 ──────────────────────────────────────────────────

interface AnalyticsData {
  tags: TagStat[]
  adoption: { total: number; adopted: number; rate: number }
  review: { phrases: number; vocab: number }
  practice: { corrections: number; rewrites: number }
  trend: SessionTrendPoint[]
  mastery: MasteryDist[]
  unadopted: Awaited<ReturnType<typeof unadoptedPhrases>>
}

function AnalyticsTab({ onGoReview }: { onGoReview: () => void }) {
  const [data, setData] = useState<AnalyticsData | null>(null)

  useEffect(() => {
    ;(async () => {
      const [tags, adoption, due, studyItems, trend, mastery, una] = await Promise.all([
        tagRecurrence(), phraseAdoption(), dueForReview(),
        dueStudyItems(), sessionTrend(10), masteryDistribution(), unadoptedPhrases(),
      ])
      setData({
        tags, adoption,
        review: { phrases: due.phrases.length, vocab: due.vocab.length },
        practice: {
          corrections: studyItems.filter(i => i.kind === 'correction').length,
          rewrites: studyItems.filter(i => i.kind === 'rewrite').length,
        },
        trend, mastery, unadopted: una,
      })
    })()
  }, [])

  if (!data) return <LoadingCard />

  const totalMastery = data.mastery.reduce((s, b) => s + b.total, 0)
  const masterItems = data.mastery.filter(b => b.box >= 4).reduce((s, b) => s + b.total, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {/* 오늘 할 일 */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>오늘 할 일</h2>
        <div style={localStyles.todayRow}>
          <TodayBlock label="복습" num={data.review.phrases + data.review.vocab}
            sub={`Phrase ${data.review.phrases} · 어휘 ${data.review.vocab}`} />
          <div style={localStyles.todayDivider} />
          <TodayBlock label="연습" num={data.practice.corrections + data.practice.rewrites}
            sub={`교정 ${data.practice.corrections} · Rewrite ${data.practice.rewrites}`} />
        </div>
        <button style={styles.button} onClick={onGoReview}
          disabled={data.review.phrases + data.review.vocab === 0}>
          {data.review.phrases + data.review.vocab === 0 ? '오늘 복습 완료' : '복습 시작하기 →'}
        </button>
      </div>

      {/* 마스터리 진행도 */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>마스터리 진행도</h2>
        <p style={styles.subtitle}>
          전체 {totalMastery}개 중 <strong>{masterItems}개</strong> 마스터 (Box 4-5)
        </p>
        <MasteryChart boxes={data.mastery} total={totalMastery} />
      </div>

      {/* 교정 트렌드 */}
      {data.trend.length > 1 && (
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>교정 건수 추이</h2>
          <p style={styles.subtitle}>최근 {data.trend.length}세션 · 줄어들수록 성장 중이에요</p>
          <TrendChart points={data.trend} />
        </div>
      )}

      {/* 약점 재발 순위 */}
      {data.tags.length > 0 && (
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>약점 재발 순위</h2>
          <p style={styles.subtitle}>교정/약점 패턴에서 자주 등장한 태그예요.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {data.tags.slice(0, 5).map((t, i) => (
              <TagRankRow key={t.tag} rank={i + 1} stat={t} max={data.tags[0].count} />
            ))}
          </div>
        </div>
      )}

      {/* 능동 어휘 추적 */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Phrase 내재화 현황</h2>
        <p style={styles.subtitle}>추천받은 Phrase를 실제 대화에서 얼마나 사용했는지예요.</p>
        <AdoptionSection unadopted={data.unadopted} />
      </div>
    </div>
  )
}

// ── 기록 탭 (세션 목록) ──────────────────────────────────────

function HistoryTab({ onSelectSession }: { onSelectSession: (id: string) => void }) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)

  useEffect(() => {
    allSessions().then(setSessions)
  }, [])

  if (!sessions) return <LoadingCard />
  if (sessions.length === 0) {
    return (
      <div style={{ ...styles.card, textAlign: 'center', padding: '2rem 1.25rem' }}>
        <h2 style={{ ...styles.sectionTitle, textAlign: 'center' }}>아직 기록이 없어요</h2>
        <p style={{ ...styles.subtitle, textAlign: 'center', margin: '0.25rem 0 0' }}>
          리포트를 입력하면 여기에 세션 기록이 쌓여요.
        </p>
      </div>
    )
  }

  // 월별 그룹
  const grouped = new Map<string, SessionRow[]>()
  for (const s of sessions) {
    const month = s.date.slice(0, 7) // YYYY-MM
    if (!grouped.has(month)) grouped.set(month, [])
    grouped.get(month)!.push(s)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[...grouped.entries()].map(([month, rows]) => (
        <div key={month} style={styles.card}>
          <h2 style={{ ...styles.sectionTitle, marginBottom: '0.6rem' }}>
            {month.replace('-', '년 ')}월
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {rows.map(s => (
              <SessionRow key={s.id} session={s} onClick={() => onSelectSession(s.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SessionRow({ session, onClick }: { session: SessionRow; onClick: () => void }) {
  const day = session.date.slice(5) // MM-DD
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.625rem 0.75rem', background: colors.surfaceAlt,
        border: `1px solid ${colors.border}`, borderRadius: radius.md,
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        minWidth: '2.5rem', textAlign: 'center',
        background: colors.primaryLight, borderRadius: radius.sm, padding: '0.25rem 0.3rem',
      }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: colors.primary, margin: 0 }}>{day}</p>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.text, margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {session.topic || '(주제 없음)'}
        </p>
        {session.duration_min && (
          <p style={{ fontSize: '0.7rem', color: colors.textSubtle, margin: '1px 0 0' }}>
            {session.duration_min}분
          </p>
        )}
      </div>
      <span style={{ fontSize: '0.8rem', color: colors.textSubtle }}>›</span>
    </button>
  )
}

// ── 세션 상세 뷰어 ────────────────────────────────────────────

type DetailData = Awaited<ReturnType<typeof sessionDetail>>

function SessionDetailView({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<DetailData | null>(null)

  useEffect(() => {
    sessionDetail(sessionId).then(setDetail)
  }, [sessionId])

  if (!detail) return <LoadingCard />
  const { session, corrections, rewrites, patterns, phrases, vocab, actions } = detail
  if (!session) return <LoadingCard />

  const strengths = patterns.filter(p => p.type === 'strength')
  const weaknesses = patterns.filter(p => p.type === 'weakness')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} className="animate-fade-in">
      {/* 헤더 */}
      <div style={styles.card}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: colors.primary, cursor: 'pointer',
          fontSize: '0.82rem', fontWeight: 600, padding: 0, marginBottom: '0.75rem',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.3rem',
        }}>
          ‹ 기록 목록
        </button>
        <h2 style={{ ...styles.sectionTitle, marginBottom: '0.25rem' }}>{session.topic || '(주제 없음)'}</h2>
        <p style={{ ...styles.subtitle, margin: 0 }}>
          {session.date}{session.duration_min ? ` · ${session.duration_min}분` : ''}
        </p>
        {/* 요약 칩 */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          {corrections.length > 0 && <InfoChip label={`교정 ${corrections.length}`} color="red" />}
          {rewrites.length > 0 && <InfoChip label={`Rewrite ${rewrites.length}`} color="blue" />}
          {phrases.length > 0 && <InfoChip label={`Phrase +${phrases.length}`} color="green" />}
          {vocab.length > 0 && <InfoChip label={`어휘 +${vocab.length}`} color="purple" />}
        </div>
      </div>

      {/* 교정 */}
      {corrections.length > 0 && (
        <DetailSection title="교정 사항">
          {corrections.map(c => <CorrectionCard key={c.id} c={c} />)}
        </DetailSection>
      )}

      {/* Native Rewrites */}
      {rewrites.length > 0 && (
        <DetailSection title="Native-like Rewrites">
          {rewrites.map(r => <RewriteCard key={r.id} r={r} />)}
        </DetailSection>
      )}

      {/* 패턴 */}
      {(strengths.length > 0 || weaknesses.length > 0) && (
        <DetailSection title="반복 패턴">
          {strengths.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: colors.green, margin: '0 0 0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>강점</p>
              {strengths.map((p, i) => (
                <div key={i} style={{ fontSize: '0.82rem', color: colors.text, padding: '0.3rem 0', borderBottom: `1px solid ${colors.divider}` }}>
                  • {p.description}
                </div>
              ))}
            </div>
          )}
          {weaknesses.length > 0 && (
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: colors.red, margin: '0.5rem 0 0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>약점</p>
              {weaknesses.map((p, i) => (
                <div key={i} style={{
                  fontSize: '0.82rem', color: colors.text, padding: '0.35rem 0.5rem',
                  borderLeft: `3px solid var(--red)`, marginBottom: '0.35rem',
                  background: colors.redBg, borderRadius: `0 ${radius.sm} ${radius.sm} 0`,
                }}>
                  {p.description}
                  {p.canonical_tag && <span style={{ fontSize: '0.68rem', color: colors.textSubtle, marginLeft: '0.4rem' }}>[{p.canonical_tag}]</span>}
                </div>
              ))}
            </div>
          )}
        </DetailSection>
      )}

      {/* 추천 Phrase */}
      {phrases.length > 0 && (
        <DetailSection title="추천 Phrase">
          {phrases.map(p => <PhraseCard key={p.id} p={p} />)}
        </DetailSection>
      )}

      {/* 능동 어휘 */}
      {vocab.length > 0 && (
        <DetailSection title="능동 어휘">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {vocab.map(v => (
              <div key={v.id} style={{
                display: 'flex', alignItems: 'baseline', gap: '0.5rem',
                padding: '0.4rem 0', borderBottom: `1px solid ${colors.divider}`,
              }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: colors.primary }}>{v.word}</span>
                <span style={{ fontSize: '0.78rem', color: colors.textMuted }}>{v.meaning}</span>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Next Session */}
      {actions.length > 0 && (
        <DetailSection title="Next Session 미션">
          {actions.map(a => (
            <div key={a.id} style={{
              display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
              padding: '0.4rem 0', borderBottom: `1px solid ${colors.divider}`,
            }}>
              <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{a.completed ? '완료' : '대기'}</span>
              <p style={{ fontSize: '0.82rem', color: a.completed ? colors.textSubtle : colors.text, margin: 0,
                textDecoration: a.completed ? 'line-through' : 'none', lineHeight: 1.5 }}>
                {a.suggestion}
              </p>
            </div>
          ))}
        </DetailSection>
      )}
    </div>
  )
}

// ── SVG 차트 컴포넌트들 ──────────────────────────────────────

function MasteryChart({ boxes, total }: { boxes: MasteryDist[]; total: number }) {
  const boxColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6']
  const maxVal = Math.max(...boxes.map(b => b.total), 1)

  return (
    <div>
      <svg width="100%" viewBox="0 0 300 120" style={{ overflow: 'visible' }}>
        {boxes.map((b, i) => {
          const barH = total === 0 ? 4 : Math.max((b.total / maxVal) * 72, b.total > 0 ? 4 : 0)
          const x = 12 + i * 56
          const y = 80 - barH
          const pct = total > 0 ? Math.round((b.total / total) * 100) : 0
          return (
            <g key={b.box}>
              <rect x={x} y={y} width={40} height={barH} rx={4}
                fill={b.total === 0 ? 'var(--border)' : boxColors[i]}
                opacity={0.85}
              />
              {b.total > 0 && (
                <text x={x + 20} y={y - 4} textAnchor="middle"
                  fontSize={9} fill="var(--text-muted)" fontFamily="Inter, sans-serif">
                  {pct}%
                </text>
              )}
              <text x={x + 20} y={98} textAnchor="middle"
                fontSize={8} fill="var(--text-subtle)" fontFamily="Inter, sans-serif">
                {b.total}개
              </text>
              <text x={x + 20} y={110} textAnchor="middle"
                fontSize={7.5} fill="var(--text-subtle)" fontFamily="Inter, sans-serif">
                {['Box 1', 'Box 2', 'Box 3', 'Box 4', 'Box 5'][i]}
              </text>
            </g>
          )
        })}
        {/* 기준선 */}
        <line x1={8} y1={80} x2={292} y2={80} stroke="var(--border)" strokeWidth={1} />
      </svg>
      {/* 범례 */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
        {['처음', '학습중', '익숙', '능숙', '마스터'].map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: boxColors[i], opacity: 0.85 }} />
            <span style={{ fontSize: '0.65rem', color: colors.textSubtle }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TrendChart({ points }: { points: SessionTrendPoint[] }) {
  const W = 300, H = 80, padL = 24, padR = 8, padT = 12, padB = 20
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const maxCorr = Math.max(...points.map(p => p.correctionCount), 1)
  const n = points.length

  const cx = (i: number) => padL + (i / (n - 1)) * innerW
  const cy = (v: number) => padT + innerH - (v / maxCorr) * innerH

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(i)},${cy(p.correctionCount)}`).join(' ')
  const areaPath = `${linePath} L${cx(n - 1)},${padT + innerH} L${cx(0)},${padT + innerH} Z`

  // 트렌드 계산 (첫 절반 vs 후 절반 평균)
  const half = Math.floor(n / 2)
  const avgFirst = points.slice(0, half).reduce((s, p) => s + p.correctionCount, 0) / half
  const avgLast = points.slice(half).reduce((s, p) => s + p.correctionCount, 0) / (n - half)
  const improving = avgLast < avgFirst

  return (
    <div>
      {/* 트렌드 인사이트 */}
      {n >= 4 && (
        <div style={{
          background: improving ? colors.greenBg : colors.amberBg,
          border: `1px solid ${improving ? colors.greenBorder : colors.amberBorder}`,
          borderRadius: radius.md, padding: '0.5rem 0.75rem', marginBottom: '0.75rem',
          display: 'flex', alignItems: 'center', gap: '0.4rem',
        }}>
          <span style={{ fontSize: '0.9rem' }}>{improving ? '개선' : '유지'}</span>
          <p style={{ fontSize: '0.78rem', color: improving ? colors.green : colors.amber, margin: 0, fontWeight: 600 }}>
            {improving
              ? `최근 세션 교정이 줄어드는 추세예요! (${Math.round(avgFirst)}→${Math.round(avgLast)}건)`
              : `교정 건수가 비슷하거나 늘었어요. 계속 분석해볼게요.`}
          </p>
        </div>
      )}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {/* 그리드 라인 */}
        {[0, 0.5, 1].map(t => (
          <line key={t}
            x1={padL} y1={padT + innerH * (1 - t)}
            x2={W - padR} y2={padT + innerH * (1 - t)}
            stroke="var(--border)" strokeWidth={0.8} strokeDasharray="4,3"
          />
        ))}
        {/* Y축 라벨 */}
        {[0, Math.round(maxCorr / 2), maxCorr].map((v, i) => (
          <text key={i} x={padL - 3} y={padT + innerH - (v / maxCorr) * innerH + 3}
            textAnchor="end" fontSize={7.5} fill="var(--text-subtle)" fontFamily="Inter, sans-serif">
            {v}
          </text>
        ))}
        {/* 면적 */}
        <path d={areaPath} fill="var(--primary)" opacity={0.08} />
        {/* 라인 */}
        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* 데이터 포인트 */}
        {points.map((p, i) => (
          <g key={p.sessionId}>
            <circle cx={cx(i)} cy={cy(p.correctionCount)} r={3.5}
              fill="var(--surface)" stroke="var(--primary)" strokeWidth={2} />
            {/* X축 날짜 라벨 (첫, 중간, 마지막만) */}
            {(i === 0 || i === n - 1 || i === Math.floor(n / 2)) && (
              <text x={cx(i)} y={H - 2} textAnchor="middle"
                fontSize={7} fill="var(--text-subtle)" fontFamily="Inter, sans-serif">
                {p.date.slice(5)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p style={{ fontSize: '0.68rem', color: colors.textSubtle, marginTop: '0.25rem' }}>
        세로축: 세션당 교정 건수
      </p>
    </div>
  )
}

// ── 서브 컴포넌트들 ──────────────────────────────────────────

function AdoptionSection({ unadopted: u }: { unadopted: Awaited<ReturnType<typeof unadoptedPhrases>> }) {
  const rate = u.total > 0 ? u.adoptedCount / u.total : 0
  return (
    <div>
      <RateBar value={rate} sub={`${u.adoptedCount} / ${u.total}개 사용됨`} />

      {u.unadopted.length > 0 && (
        <div style={{ marginTop: '0.875rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.amber, margin: '0 0 0.4rem' }}>
            아직 사용하지 않은 Phrase ({u.unadoptedCount}개)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {u.unadopted.slice(0, 5).map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4rem 0.6rem', background: colors.amberBg,
                border: `1px solid ${colors.amberBorder}`, borderRadius: radius.md,
              }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: colors.text }}>{p.phrase}</span>
                  <span style={{ fontSize: '0.72rem', color: colors.textMuted, marginLeft: '0.4rem' }}>{p.meaning}</span>
                </div>
                <SpeakerButton text={p.phrase} size="small" />
              </div>
            ))}
          </div>
        </div>
      )}

      {u.topAdopted.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.green, margin: '0 0 0.4rem' }}>
            가장 많이 사용한 Phrase
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {u.topAdopted.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.35rem 0', borderBottom: `1px solid ${colors.divider}` }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: colors.text, flex: 1 }}>{p.phrase}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: colors.green,
                  background: colors.greenBg, border: `1px solid ${colors.greenBorder}`,
                  borderRadius: radius.pill, padding: '0.1rem 0.45rem' }}>
                  {p.used_later_count}회
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TagRankRow({ rank, stat, max }: { rank: number; stat: TagStat; max: number }) {
  const pct = Math.round((stat.count / max) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: colors.primary, minWidth: '1rem' }}>{rank}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: colors.text }}>[{stat.tag}]</span>
          <span style={{ fontSize: '0.72rem', color: colors.red, fontWeight: 600 }}>{stat.count}회</span>
        </div>
        <div style={{ height: '5px', background: colors.surfaceAlt, borderRadius: '3px', overflow: 'hidden',
          border: `1px solid ${colors.border}` }}>
          <div style={{ height: '100%', width: `${pct}%`, background: colors.red, opacity: 0.7,
            borderRadius: '3px', transition: 'width 0.4s ease' }} />
        </div>
      </div>
      {stat.lastSeen && (
        <span style={{ fontSize: '0.65rem', color: colors.textSubtle, minWidth: '3.5rem', textAlign: 'right' }}>
          {stat.lastSeen.slice(5)}
        </span>
      )}
    </div>
  )
}

function RateBar({ value, sub }: { value: number; sub: string }) {
  const pct = Math.round(value * 100)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.3rem' }}>
        <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: colors.surfaceAlt,
          overflow: 'hidden', border: `1px solid ${colors.border}` }}>
          <div style={{ height: '100%', width: `${pct}%`, background: colors.primary,
            borderRadius: '4px', transition: 'width 0.5s ease' }} />
        </div>
        <span style={{ fontWeight: 700, color: colors.primary, minWidth: '2.5rem', textAlign: 'right', fontSize: '0.9rem' }}>
          {pct}%
        </span>
      </div>
      <p style={{ fontSize: '0.75rem', color: colors.textSubtle, margin: 0 }}>{sub}</p>
    </div>
  )
}

function TodayBlock({ label, num, sub }: { label: string; num: number; sub: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0.875rem 0.5rem', gap: '0.15rem' }}>
      <span style={{ fontSize: '2rem', fontWeight: 800, color: colors.primary, lineHeight: 1 }}>{num}</span>
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: colors.textMuted }}>{label}</span>
      <span style={{ fontSize: '0.68rem', color: colors.textSubtle, textAlign: 'center' }}>{sub}</span>
    </div>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.card}>
      <h2 style={{ ...styles.sectionTitle, marginBottom: '0.75rem' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{children}</div>
    </div>
  )
}

function CorrectionCard({ c }: { c: CorrectionRow }) {
  return (
    <div style={{ background: colors.surfaceAlt, border: `1px solid ${colors.border}`,
      borderRadius: radius.md, padding: '0.7rem 0.875rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <p style={{ fontSize: '0.8rem', color: colors.red, margin: 0, textDecoration: 'line-through', flex: 1 }}>
          "{c.original}"
        </p>
        {c.error_tag && <InfoChip label={c.error_tag} color="red" />}
      </div>
      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.green, margin: '0 0 0.3rem' }}>→ "{c.corrected}"</p>
      {c.rule && <p style={{ fontSize: '0.75rem', color: colors.textMuted, margin: 0, lineHeight: 1.4 }}>{c.rule}</p>}
    </div>
  )
}

function RewriteCard({ r }: { r: RewriteRow }) {
  return (
    <div style={{ background: colors.surfaceAlt, border: `1px solid ${colors.border}`,
      borderRadius: radius.md, padding: '0.7rem 0.875rem' }}>
      <p style={{ fontSize: '0.78rem', color: colors.textMuted, margin: '0 0 0.25rem', fontStyle: 'italic' }}>
        "{r.user_expr}"
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <p style={{ fontSize: '0.88rem', fontWeight: 600, color: colors.primary, margin: 0, flex: 1 }}>
          → "{r.native_version}"
        </p>
        <SpeakerButton text={r.native_version} size="small" />
      </div>
      {r.nuance && <p style={{ fontSize: '0.75rem', color: colors.textSubtle, margin: '0.3rem 0 0', lineHeight: 1.4 }}>{r.nuance}</p>}
    </div>
  )
}

function PhraseCard({ p }: { p: PhraseRow }) {
  return (
    <div style={{ background: colors.primaryLight, border: `1px solid var(--primary)`,
      borderRadius: radius.md, padding: '0.7rem 0.875rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <p style={{ fontSize: '0.9rem', fontWeight: 700, color: colors.primary, margin: 0, flex: 1 }}>{p.phrase}</p>
        <SpeakerButton text={p.phrase} size="small" />
      </div>
      <p style={{ fontSize: '0.78rem', color: colors.textMuted, margin: '0.2rem 0 0' }}>{p.meaning}</p>
      {p.example && (
        <p style={{ fontSize: '0.75rem', color: colors.textSubtle, fontStyle: 'italic', margin: '0.25rem 0 0',
          lineHeight: 1.4 }}>"{p.example}"</p>
      )}
      {p.used_later_count > 0 && (
        <p style={{ fontSize: '0.68rem', color: colors.green, margin: '0.3rem 0 0', fontWeight: 600 }}>
          이후 {p.used_later_count}회 사용됨
        </p>
      )}
    </div>
  )
}

function InfoChip({ label, color }: { label: string; color: 'red' | 'blue' | 'green' | 'purple' }) {
  const map = {
    red:    { bg: colors.redBg, border: colors.redBorder, text: colors.red },
    blue:   { bg: colors.primaryLight, border: 'var(--primary)', text: colors.primary },
    green:  { bg: colors.greenBg, border: colors.greenBorder, text: colors.green },
    purple: { bg: colors.purpleBg, border: colors.purpleBorder, text: colors.purple },
  }
  const c = map[color]
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 600, background: c.bg,
      border: `1px solid ${c.border}`, color: c.text, borderRadius: radius.pill, padding: '0.15rem 0.45rem' }}>
      {label}
    </span>
  )
}

function LoadingCard() {
  return (
    <div style={{ ...styles.card, textAlign: 'center', padding: '2rem' }}>
      <p style={{ ...styles.subtitle, margin: 0 }}>불러오는 중...</p>
    </div>
  )
}

const localStyles = {
  todayRow: {
    display: 'flex', alignItems: 'stretch', margin: '0.5rem 0 0.75rem',
    background: colors.surfaceAlt, borderRadius: '0.875rem', overflow: 'hidden' as const,
    border: `1px solid ${colors.border}`,
  },
  todayDivider: { width: '1px', background: colors.divider },
} as const
