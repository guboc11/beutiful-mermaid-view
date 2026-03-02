import { useState, useRef, useEffect } from 'react'
import { renderMermaidSVG, THEMES } from 'beautiful-mermaid'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import CodeMirror, { EditorView, oneDark, ViewPlugin, Decoration, RangeSetBuilder, type DecorationSet } from '@uiw/react-codemirror'
import { mermaid } from 'codemirror-lang-mermaid'
import defaultCode from './example.mmd?raw'
import './App.css'

const { bg } = THEMES['dracula']
const bgOverride = EditorView.theme({
  '&': { backgroundColor: bg },
  '.cm-gutters': { backgroundColor: bg },
})

type HighlightRange = { from: number; to: number; cls: string }

const classDiagramHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = this.build(view) }
    update(update: { docChanged: boolean; viewportChanged: boolean; view: EditorView }) {
      if (update.docChanged || update.viewportChanged) this.decorations = this.build(update.view)
    }
    build(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<ReturnType<typeof Decoration.mark>>()
      const text = view.state.doc.toString()
      if (!/^\s*classDiagram/i.test(text)) return builder.finish()

      const ranges: HighlightRange[] = []
      const add = (regex: RegExp, cls: string) => {
        let m: RegExpExecArray | null
        regex.lastIndex = 0
        while ((m = regex.exec(text)) !== null) {
          ranges.push({ from: m.index, to: m.index + m[0].length, cls })
        }
      }

      add(/%%[^\n]*/g, 'cm-cd-comment')
      add(/\b(classDiagram|class|interface|abstract|namespace)\b/g, 'cm-cd-keyword')
      add(/<<[^>]+>>/g, 'cm-cd-stereotype')
      add(/(--|\.\.)[>|*o]/g, 'cm-cd-relation')
      add(/(?<![a-zA-Z])[+\-#~](?=[a-zA-Z_])/g, 'cm-cd-visibility')

      ranges.sort((a, b) => a.from !== b.from ? a.from - b.from : b.to - a.to)

      let lastTo = 0
      for (const { from, to, cls } of ranges) {
        if (from >= lastTo) {
          builder.add(from, to, Decoration.mark({ class: cls }))
          lastTo = to
        }
      }
      return builder.finish()
    }
  },
  { decorations: (v) => v.decorations }
)

type EdgeInfo = { id: string; label: string }

function buildPreviewCode(nodeId: string, outgoing: EdgeInfo[], incoming: EdgeInfo[]): string {
  const arrow = (label: string) => label ? `-->|${label}|` : '-->'
  const lines = ['flowchart LR']
  if (incoming.length === 0 && outgoing.length === 0) {
    lines.push(`  ${nodeId}`)
  }
  for (const { id, label } of incoming) lines.push(`  ${id} ${arrow(label)} ${nodeId}`)
  for (const { id, label } of outgoing) lines.push(`  ${nodeId} ${arrow(label)} ${id}`)
  return lines.join('\n')
}

export default function App() {
  const [code, setCode] = useState(defaultCode)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  const viewerRef = useRef<HTMLDivElement>(null)
  const svgWrapRef = useRef<HTMLDivElement>(null)
  const previewPanelRef = useRef<HTMLDivElement>(null)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null)
  const isCenteredRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setSvg(renderMermaidSVG(code, THEMES['dracula']))
        setError('')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Parse error')
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [code])

  // d3-zoom
  useEffect(() => {
    const el = viewerRef.current
    const wrap = svgWrapRef.current
    if (!el || !wrap) return

    const zoomBehavior = zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        const { x, y, k } = event.transform
        wrap.style.transform = `translate(${x}px, ${y}px) scale(${k})`
      })

    zoomRef.current = zoomBehavior
    select(el).call(zoomBehavior)
    return () => { select(el).on('.zoom', null) }
  }, [])

  // Center SVG on first render
  useEffect(() => {
    if (!svg || isCenteredRef.current) return
    const el = viewerRef.current
    const wrap = svgWrapRef.current
    const zoomBehavior = zoomRef.current
    if (!el || !wrap || !zoomBehavior) return

    requestAnimationFrame(() => {
      const x = (el.clientWidth - wrap.offsetWidth) / 2
      const y = (el.clientHeight - wrap.offsetHeight) / 2
      select(el).call(zoomBehavior.transform, zoomIdentity.translate(x, y))
      isCenteredRef.current = true
    })
  }, [svg])

  // Hover interaction
  useEffect(() => {
    const wrap = svgWrapRef.current
    if (!wrap || !svg) return

    const esc = (s: string) => s.replace(/["\\]/g, '\\$&')

    const NODE_SEL = 'g.node, g.class-node'
    const EDGE_SEL = 'polyline.edge, polyline.class-relationship'
    const nodeQuery = (id: string) => `g.node[data-id="${esc(id)}"], g.class-node[data-id="${esc(id)}"]`
    const edgeOutQuery = (id: string) => `polyline.edge[data-from="${esc(id)}"], polyline.class-relationship[data-from="${esc(id)}"]`
    const edgeInQuery = (id: string) => `polyline.edge[data-to="${esc(id)}"], polyline.class-relationship[data-to="${esc(id)}"]`

    const panel = previewPanelRef.current
    const svgContainer = panel?.querySelector<HTMLElement>('.hover-panel-svg')

    const hidePanel = () => {
      if (previewTimerRef.current) { clearTimeout(previewTimerRef.current); previewTimerRef.current = null }
      if (panel) panel.style.display = 'none'
      if (svgContainer) svgContainer.innerHTML = ''
    }

    const clearClasses = () => {
      wrap.querySelectorAll('.dimmed').forEach(el => el.classList.remove('dimmed'))
      wrap.querySelectorAll('.edge-out').forEach(el => el.classList.remove('edge-out'))
      wrap.querySelectorAll('.edge-in').forEach(el => el.classList.remove('edge-in'))
      wrap.querySelectorAll('.node-active').forEach(el => el.classList.remove('node-active'))
      wrap.querySelectorAll('.node-out').forEach(el => el.classList.remove('node-out'))
      wrap.querySelectorAll('.node-in').forEach(el => el.classList.remove('node-in'))
    }

    const clearHighlight = () => { clearClasses(); hidePanel() }

    const handleEnter = (e: Event) => {
      const nodeEl = e.currentTarget as Element
      const nodeId = nodeEl.getAttribute('data-id')
      if (!nodeId) return

      clearClasses()
      hidePanel()

      // Dim everything
      wrap.querySelectorAll(NODE_SEL).forEach(n => n.classList.add('dimmed'))
      wrap.querySelectorAll(EDGE_SEL).forEach(edge => edge.classList.add('dimmed'))
      wrap.querySelectorAll('g.edge-label').forEach(label => label.classList.add('dimmed'))

      // Hovered node
      nodeEl.classList.remove('dimmed')
      nodeEl.classList.add('node-active')

      const outgoing: EdgeInfo[] = []
      const incoming: EdgeInfo[] = []

      // Outgoing edges → red
      wrap.querySelectorAll(edgeOutQuery(nodeId)).forEach(edge => {
        edge.classList.remove('dimmed')
        edge.classList.add('edge-out')
        const toId = edge.getAttribute('data-to')
        if (!toId) return
        wrap.querySelectorAll(nodeQuery(toId)).forEach(n => { n.classList.remove('dimmed'); n.classList.add('node-out') })
        const labelEl = wrap.querySelector(`g.edge-label[data-from="${esc(nodeId)}"][data-to="${esc(toId)}"]`)
        labelEl?.classList.remove('dimmed')
        const label = edge.getAttribute('data-label') ?? labelEl?.textContent?.trim() ?? ''
        if (!outgoing.find(e => e.id === toId)) outgoing.push({ id: toId, label })
      })

      // Incoming edges → blue
      wrap.querySelectorAll(edgeInQuery(nodeId)).forEach(edge => {
        edge.classList.remove('dimmed')
        edge.classList.add('edge-in')
        const fromId = edge.getAttribute('data-from')
        if (!fromId) return
        wrap.querySelectorAll(nodeQuery(fromId)).forEach(n => { n.classList.remove('dimmed'); n.classList.add('node-in') })
        const labelEl = wrap.querySelector(`g.edge-label[data-from="${esc(fromId)}"][data-to="${esc(nodeId)}"]`)
        labelEl?.classList.remove('dimmed')
        const label = edge.getAttribute('data-label') ?? labelEl?.textContent?.trim() ?? ''
        if (!incoming.find(e => e.id === fromId)) incoming.push({ id: fromId, label })
      })

      if (panel) panel.style.display = 'block'
      const capturedId = nodeId
      const capturedOut = [...outgoing]
      const capturedIn = [...incoming]

      previewTimerRef.current = setTimeout(() => {
        if (!svgContainer) return
        try {
          svgContainer.innerHTML = renderMermaidSVG(buildPreviewCode(capturedId, capturedOut, capturedIn), THEMES['dracula'])
          svgContainer.querySelector(`g.node[data-id="${esc(capturedId)}"]`)?.classList.add('node-active')
          for (const { id } of capturedIn) svgContainer.querySelector(`g.node[data-id="${esc(id)}"]`)?.classList.add('node-in')
          for (const { id } of capturedOut) svgContainer.querySelector(`g.node[data-id="${esc(id)}"]`)?.classList.add('node-out')
          svgContainer.querySelectorAll('polyline.edge').forEach(edge => {
            if (edge.getAttribute('data-from') === capturedId) edge.classList.add('edge-out')
            else if (edge.getAttribute('data-to') === capturedId) edge.classList.add('edge-in')
          })
        } catch (e) { console.error('[preview] error:', e); svgContainer.innerHTML = '' }
      }, 0)
    }

    const nodes = wrap.querySelectorAll(NODE_SEL)
    nodes.forEach(node => {
      node.addEventListener('mouseenter', handleEnter)
      node.addEventListener('mouseleave', clearHighlight)
    })

    return () => {
      nodes.forEach(node => {
        node.removeEventListener('mouseenter', handleEnter)
        node.removeEventListener('mouseleave', clearHighlight)
      })
    }
  }, [svg])

  return (
    <div className="app">
      <nav className="navbar">
        <span>beautiful-mermaid-view</span>
        <span className="navbar-license">Powered by <a href="https://github.com/lukilabs/beautiful-mermaid" target="_blank" rel="noreferrer">beautiful-mermaid</a> — MIT License © 2026 Craft Docs</span>
      </nav>
      <div className="main">
        <div className="editor">
          <CodeMirror
            value={code}
            onChange={setCode}
            theme={oneDark}
            extensions={[mermaid(), classDiagramHighlight, bgOverride]}
            height="100%"
            style={{ flex: 1, overflow: 'hidden' }}
          />
          {error && <div className="error">{error}</div>}
        </div>
        <div className="viewer" ref={viewerRef}>
          <div
            className="svg-wrap"
            ref={svgWrapRef}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div className="hover-panel" ref={previewPanelRef} style={{ display: 'none' }}>
            <div className="hover-panel-svg" />
          </div>
        </div>
      </div>
    </div>
  )
}
