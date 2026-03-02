import { useState, useRef, useEffect } from 'react'
import { renderMermaidSVG } from 'beautiful-mermaid'
import { select } from 'd3-selection'
import { zoom } from 'd3-zoom'
import defaultCode from './example.mmd?raw'
import './App.css'

export default function App() {
  const [code, setCode] = useState(defaultCode)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  const viewerRef = useRef<HTMLDivElement>(null)
  const svgWrapRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const el = viewerRef.current
    const wrap = svgWrapRef.current
    if (!el || !wrap) return

    const zoomBehavior = zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        const { x, y, k } = event.transform
        wrap.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${k})`
      })

    select(el).call(zoomBehavior)

    return () => {
      select(el).on('.zoom', null)
    }
  }, [])

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
