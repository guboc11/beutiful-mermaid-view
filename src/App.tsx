import { useState, useRef, useEffect } from 'react'
import { renderMermaidSVG } from 'beautiful-mermaid'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import defaultCode from './example.mmd?raw'
import './App.css'

export default function App() {
  const [code, setCode] = useState(defaultCode)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  const viewerRef = useRef<HTMLDivElement>(null)
  const svgWrapRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null)
  const isCenteredRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setSvg(renderMermaidSVG(code))
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

    const clearHighlight = () => {
      wrap.querySelectorAll('.dimmed').forEach(el => el.classList.remove('dimmed'))
      wrap.querySelectorAll('.edge-out').forEach(el => el.classList.remove('edge-out'))
      wrap.querySelectorAll('.edge-in').forEach(el => el.classList.remove('edge-in'))
      wrap.querySelectorAll('.node-active').forEach(el => el.classList.remove('node-active'))
    }

    const handleEnter = (e: Event) => {
      const nodeEl = e.currentTarget as Element
      const nodeId = nodeEl.getAttribute('data-id')
      if (!nodeId) return

      clearHighlight()

      // Dim everything
      wrap.querySelectorAll(NODE_SEL).forEach(n => n.classList.add('dimmed'))
      wrap.querySelectorAll(EDGE_SEL).forEach(edge => edge.classList.add('dimmed'))
      wrap.querySelectorAll('g.edge-label').forEach(label => label.classList.add('dimmed'))

      // Hovered node
      nodeEl.classList.remove('dimmed')
      nodeEl.classList.add('node-active')

      // Outgoing edges → red
      wrap.querySelectorAll(edgeOutQuery(nodeId)).forEach(edge => {
        edge.classList.remove('dimmed')
        edge.classList.add('edge-out')
        const toId = edge.getAttribute('data-to')
        if (!toId) return
        wrap.querySelectorAll(nodeQuery(toId)).forEach(n => n.classList.remove('dimmed'))
        wrap.querySelector(`g.edge-label[data-from="${esc(nodeId)}"][data-to="${esc(toId)}"]`)?.classList.remove('dimmed')
      })

      // Incoming edges → blue
      wrap.querySelectorAll(edgeInQuery(nodeId)).forEach(edge => {
        edge.classList.remove('dimmed')
        edge.classList.add('edge-in')
        const fromId = edge.getAttribute('data-from')
        if (!fromId) return
        wrap.querySelectorAll(nodeQuery(fromId)).forEach(n => n.classList.remove('dimmed'))
        wrap.querySelector(`g.edge-label[data-from="${esc(fromId)}"][data-to="${esc(nodeId)}"]`)?.classList.remove('dimmed')
      })
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
      </nav>
      <div className="main">
        <div className="editor">
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            spellCheck={false}
          />
          {error && <div className="error">{error}</div>}
        </div>
        <div className="viewer" ref={viewerRef}>
          <div
            className="svg-wrap"
            ref={svgWrapRef}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </div>
    </div>
  )
}
