// wordDiff.ts — 단어 단위 LCS 기반 diff 알고리즘 (외부 라이브러리 없이 로컬 연산)
// Diff 재작성 연습과 Cloze 빈칸 자동 생성에 사용한다.

export type DiffToken = { text: string; type: 'equal' | 'insert' | 'delete' }

function norm(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9']/g, '')
}

// 두 문장의 단어 단위 LCS diff 계산.
// insert = target에는 있지만 source에는 없는 단어 (추가돼야 할 것)
// delete = source에는 있지만 target에는 없는 단어 (제거돼야 할 것)
// equal  = 양쪽 모두 있는 단어
export function wordDiff(source: string, target: string): DiffToken[] {
  const sw = source.trim().split(/\s+/).filter(Boolean)
  const tw = target.trim().split(/\s+/).filter(Boolean)
  const n = sw.length, m = tw.length

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = norm(sw[i - 1]) === norm(tw[j - 1])
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  const result: DiffToken[] = []
  let i = n, j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && norm(sw[i - 1]) === norm(tw[j - 1])) {
      result.unshift({ text: tw[j - 1], type: 'equal' })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ text: tw[j - 1], type: 'insert' })
      j--
    } else {
      result.unshift({ text: sw[i - 1], type: 'delete' })
      i--
    }
  }
  return result
}

// original → corrected 간의 diff에서 가장 큰 삽입 그룹을 찾아 빈칸(_____) 처리.
// Cloze 연습의 핵심: 학습자가 맞혀야 하는 연어/표현이 자동으로 빈칸이 된다.
export function generateCloze(
  original: string,
  target: string,
): { clozeText: string; answer: string } | null {
  const diff = wordDiff(original, target)

  // 연속된 insert 그룹 중 가장 긴 것을 빈칸 대상으로 선정
  let bestStart = -1, bestLen = 0, cur = 0, curLen = 0
  for (let k = 0; k < diff.length; k++) {
    if (diff[k].type === 'insert') {
      if (curLen === 0) cur = k
      curLen++
      if (curLen > bestLen) { bestLen = curLen; bestStart = cur }
    } else {
      curLen = 0
    }
  }
  if (bestStart < 0 || bestLen === 0) return null

  const answer = diff.slice(bestStart, bestStart + bestLen).map(t => t.text).join(' ')

  // delete 토큰을 제외하고 target을 재구성하되, 선정된 insert 그룹만 _____로 대체
  const tokens: string[] = []
  for (let k = 0; k < diff.length; k++) {
    if (diff[k].type === 'delete') continue
    if (k === bestStart) { tokens.push('_____'); continue }
    if (k > bestStart && k < bestStart + bestLen) continue
    tokens.push(diff[k].text)
  }

  return { clozeText: tokens.join(' '), answer }
}

// 정답 비교 시 대소문자·구두점 무시
export function clozeMatch(userInput: string, answer: string): boolean {
  const n2 = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ')
  return n2(userInput) === n2(answer)
}
