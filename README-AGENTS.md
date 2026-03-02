# README-AGENTS.md

> AI 에이전트용 프로젝트 컨텍스트 문서. 사람이 아닌 AI가 다음 세션에서 이 프로젝트를 이어받을 때 읽기 위한 용도.

---

## 프로젝트 개요

**beautiful-mermaid-view** — Mermaid 다이어그램을 아름답게 렌더링하고 인터랙티브하게 탐색할 수 있는 웹 에디터.

- **좌측**: CodeMirror 기반 Mermaid 코드 에디터
- **우측**: 렌더링된 SVG 다이어그램 (pan/zoom 가능)
- **호버 인터랙션**: 노드에 마우스를 올리면 연결 관계 하이라이팅 + 미리보기 패널

---

## 기술 스택

| 역할 | 라이브러리 |
|---|---|
| UI 프레임워크 | React 19 + TypeScript |
| 번들러 | Vite 7 |
| Mermaid 렌더링 | `beautiful-mermaid` ^1.1.3 |
| 에디터 | `@uiw/react-codemirror` + `codemirror-lang-mermaid` |
| Pan/Zoom | `d3-zoom`, `d3-selection` |

---

## 파일 구조

```
src/
  App.tsx          — 메인 컴포넌트 (모든 로직)
  App.css          — 모든 스타일
  index.css        — 전역 리셋 (html/body/root height: 100%)
  example.mmd      — 기본 예제: classDiagram (RDBMS 지식 그래프)
  example-flowchart.mmd — 추가 예제: flowchart TD (API Gateway 패턴)
  main.tsx         — React 진입점
```

---

## 핵심 아키텍처

### SVG 렌더링

```typescript
import { renderMermaidSVG, THEMES } from 'beautiful-mermaid'

// 300ms 디바운스로 코드 변경 시마다 렌더링
setSvg(renderMermaidSVG(code, THEMES['dracula']))
```

렌더링된 SVG 문자열은 `dangerouslySetInnerHTML`로 `.svg-wrap` div에 주입됨.

### beautiful-mermaid SVG 데이터 속성

beautiful-mermaid가 렌더링하는 SVG 요소의 data attribute:

| 요소 | 속성 |
|---|---|
| `g.node` / `g.class-node` | `data-id` (노드 ID) |
| `polyline.edge` / `polyline.class-relationship` | `data-from`, `data-to`, `data-label` |
| `g.edge-label` | `data-from`, `data-to`, `data-label` |

**중요**: `g.edge-label`은 **flowchart에서만** 존재함. `classDiagram`의 관계 레이블은 wrapper 없는 plain `<text>` 요소로 렌더링되므로 CSS class 추가 불가.

### Pan/Zoom (d3-zoom)

```typescript
const zoomBehavior = zoom<HTMLDivElement, unknown>()
  .scaleExtent([0.1, 10])
  .on('zoom', (event) => {
    wrap.style.transform = `translate(${x}px, ${y}px) scale(${k})`
  })
select(el).call(zoomBehavior)
```

`fitToScreen()` 함수: SVG 전체를 뷰어에 90% 크기로 맞춤.

---

## 호버 인터랙션 시스템

### CSS 클래스 체계

모든 hover 상태는 React state가 아닌 **DOM 직접 조작**으로 처리 (React re-render 방지 → 애니메이션 끊김 방지).

| 클래스 | 대상 | 효과 |
|---|---|---|
| `dimmed` | 모든 노드/엣지/레이블 | opacity 0.08~0.12 |
| `node-active` | 호버된 노드 | 보라색(`#6366f1`) 테두리 |
| `node-out` | 나가는 방향 연결 노드 | 붉은(`#ef4444`) 테두리 |
| `node-in` | 들어오는 방향 연결 노드 | 파란(`#3b82f6`) 테두리 |
| `edge-out` | 나가는 엣지 | 붉은 점선 + flow 애니메이션 |
| `edge-in` | 들어오는 엣지 | 파란 점선 + flow 애니메이션 |
| `node-root` | incoming 없는 루트 노드 | 황금(`#f59e0b`) 테두리 (항상 표시) |

### 루트 노드 판별 (useEffect [svg])

SVG 렌더 후 `polyline.edge[data-to]` 전부 수집 → `data-to`에 없는 노드 = root node → `node-root` 클래스 부여.

### 호버 미리보기 패널

노드 호버 시 좌상단에 미니 flowchart LR 다이어그램 표시.

```typescript
function buildPreviewCode(nodeId: string, outgoing: EdgeInfo[], incoming: EdgeInfo[]): string {
  // incoming 노드들 → 호버 노드 → outgoing 노드들 방향으로 flowchart LR 생성
  // 노드 ID에 따옴표 절대 금지 (beautiful-mermaid parser 오류 원인)
}
```

**주의**: 미리보기는 항상 `flowchart LR` + `THEMES['dracula']`로 렌더링. 원본 다이어그램 타입과 무관하게 동일.

미리보기 내 CSS:
- `.hover-panel-svg g.edge-label.label-out text { fill: #ef4444 }` — outgoing 레이블 붉은색
- `.hover-panel-svg g.edge-label.label-in text { fill: #3b82f6 }` — incoming 레이블 파란색

---

## CodeMirror 에디터

- 테마: `oneDark` + dracula bg 오버라이드 (`EditorView.theme`)
- 언어: `mermaid()` (codemirror-lang-mermaid)
- 추가: `classDiagramHighlight` ViewPlugin — classDiagram일 때 코멘트/키워드/스테레오타입/관계/접근제어자를 커스텀 CSS 클래스로 하이라이팅

classDiagram 하이라이팅 클래스:
```
.cm-cd-comment   → #6272a4 italic
.cm-cd-keyword   → #ff79c6 bold
.cm-cd-stereotype → #50fa7b
.cm-cd-relation  → #ffb86c
.cm-cd-visibility → #8be9fd
```

---

## 알려진 한계 / 주의사항

1. **classDiagram 엣지 레이블 색상 불가**: beautiful-mermaid가 classDiagram 관계 레이블을 plain `<text>`로 렌더링해 CSS class 추가 방법 없음. flowchart에서만 동작.

2. **노드 ID 따옴표 금지**: flowchart LR 생성 시 노드 ID에 `"View"` 같이 따옴표를 붙이면 beautiful-mermaid parser가 0×0 SVG를 반환함. `buildPreviewCode`에서 따옴표 없이 사용해야 함.

3. **미리보기 패널 pointer-events: none**: 패널은 인터랙션 불가. 배경 드래그/줌에 영향 안 줌.

4. **SVG width: 100% 순환 참조**: `position: absolute` 패널 내에서 `width: 100%`는 0px로 해석됨. 현재는 `max-width: 800px` 고정값 사용.

---

## 커밋 히스토리 (최신순)

```
117f988  Color preview edge labels by direction
384fdab  Highlight root nodes with amber border
0993e95  Add fit-to-screen button in navbar
8f4f785  Add hover preview panel with flowchart LR subgraph
12d847a  노드 hover 미리보기 패널 추가
194eb61  classDiagram 구문 하이라이팅 추가
c0ab999  네비게이션 바에 beautiful-mermaid MIT 저작권 고지 추가
5118bff  노드 hover 하이라이트 및 커서 기준 확대/축소 구현
f815faa  Initial commit
```

---

## 개발 명령어

```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
```
