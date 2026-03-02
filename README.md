# beautiful-mermaid-view

Mermaid 다이어그램을 인터랙티브하게 탐색할 수 있는 웹 에디터.

- 좌측 에디터에서 Mermaid 코드를 작성하면 우측에 실시간으로 렌더링
- 노드에 마우스를 올리면 연결 관계 하이라이팅 및 미리보기 패널 표시
- Pan / Zoom 지원

## 실행

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

## 기술 스택

- React 19 + TypeScript + Vite
- [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid) — SVG 렌더링
- CodeMirror — 코드 에디터
- d3-zoom — Pan/Zoom
