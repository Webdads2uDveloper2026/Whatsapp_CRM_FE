/**
 * FlowCanvas.jsx — ReactFlow visual canvas for WhatsApp Flow Builder
 * Each WhatsApp screen is a draggable node; navigation buttons create edges.
 */
import { useCallback, useEffect, useRef, memo } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  useNodesState, useEdgesState,
  Handle, Position, MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ── Component type icons ───────────────────────────────────────────────────────
const COMP_ICONS = {
  text: '📝', input: '✏️', buttons: '🔘',
  dropdown: '📋', media: '🖼️', footer: '📄',
}

// ── Custom Screen Node ─────────────────────────────────────────────────────────
const ScreenNode = memo(function ScreenNode({ data, selected }) {
  const { screen, isFirst } = data

  const borderColor = selected
    ? '#388bfd'
    : screen.is_terminal ? '#3fb950'
    : isFirst ? '#a371f7'
    : '#30363d'

  const headerBg = screen.is_terminal
    ? 'rgba(63,185,80,.08)'
    : isFirst
    ? 'rgba(163,113,247,.08)'
    : 'rgba(56,139,253,.05)'

  const dotColor = screen.is_terminal ? '#3fb950' : isFirst ? '#a371f7' : '#388bfd'

  return (
    <div style={{
      background: '#161b22',
      border: `2px solid ${borderColor}`,
      borderRadius: 12,
      width: 230,
      boxShadow: selected
        ? '0 0 0 3px rgba(56,139,253,.18), 0 8px 24px rgba(0,0,0,.5)'
        : '0 4px 16px rgba(0,0,0,.45)',
      transition: 'border-color .15s, box-shadow .15s',
      fontFamily: "'Inter',system-ui,sans-serif",
      cursor: 'pointer',
    }}>
      {/* Target handle — left */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#388bfd', width: 11, height: 11, border: '2px solid #0d1117', left: -7 }}
      />

      {/* Header */}
      <div style={{
        padding: '9px 12px',
        borderBottom: '1px solid #21262d',
        borderRadius: '10px 10px 0 0',
        background: headerBg,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dotColor }} />
        <span style={{
          fontSize: 12, fontWeight: 700, color: '#e6edf3',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {screen.title || 'Untitled Screen'}
        </span>
        {isFirst && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: '#a371f7',
            background: 'rgba(163,113,247,.15)', padding: '1px 6px', borderRadius: 4, flexShrink: 0,
          }}>ENTRY</span>
        )}
        {screen.is_terminal && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: '#3fb950',
            background: 'rgba(63,185,80,.15)', padding: '1px 6px', borderRadius: 4, flexShrink: 0,
          }}>END</span>
        )}
      </div>

      {/* Components preview */}
      <div style={{ padding: '7px 9px', display: 'flex', flexDirection: 'column', gap: 3, minHeight: 44 }}>
        {screen.components.slice(0, 4).map(comp => (
          <div key={comp.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '2px 7px', borderRadius: 6,
            background: 'rgba(255,255,255,.025)', border: '1px solid #1c2128',
          }}>
            <span style={{ fontSize: 10 }}>{COMP_ICONS[comp.type] || '▫️'}</span>
            <span style={{ fontSize: 10, color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {comp.type === 'text'     ? (comp.text?.slice(0, 24) || 'Text')
               : comp.type === 'input'    ? (comp.label || 'Input field')
               : comp.type === 'buttons'  ? `${comp.buttons?.length || 0} button${comp.buttons?.length !== 1 ? 's' : ''}`
               : comp.type === 'dropdown' ? (comp.label || 'Dropdown')
               : comp.type === 'media'    ? (comp.media_type || 'Media')
               : comp.type === 'footer'   ? (comp.footer_text?.slice(0, 22) || 'Footer')
               : comp.type}
            </span>
          </div>
        ))}
        {screen.components.length > 4 && (
          <p style={{ fontSize: 10, color: '#484f58', textAlign: 'center', padding: '1px 0' }}>
            +{screen.components.length - 4} more
          </p>
        )}
        {screen.components.length === 0 && (
          <p style={{ fontSize: 10, color: '#484f58', textAlign: 'center', padding: '6px 0' }}>
            No components yet
          </p>
        )}
      </div>

      {/* Source handle — right */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#f0883e', width: 11, height: 11, border: '2px solid #0d1117', right: -7 }}
      />
    </div>
  )
})

const nodeTypes = { screen: ScreenNode }

// ── Auto-layout: simple horizontal tree ───────────────────────────────────────
function autoLayout(screens) {
  const GAP_X = 300, GAP_Y = 170
  const positions = {}
  const childrenOf = {}
  const hasParent = new Set()

  screens.forEach(s => { childrenOf[s.id] = [] })
  screens.forEach(s => {
    s.components.forEach(c => {
      if (c.type === 'buttons' || c.type === 'footer') {
        c.buttons?.forEach(b => {
          if (b.action === 'NAVIGATE' && b.next_screen && childrenOf[b.next_screen] !== undefined) {
            if (!childrenOf[s.id].includes(b.next_screen)) {
              childrenOf[s.id].push(b.next_screen)
              hasParent.add(b.next_screen)
            }
          }
        })
      }
    })
  })

  let col = 0
  function place(id, row) {
    if (positions[id]) return
    positions[id] = { x: col * GAP_X + 40, y: row * GAP_Y + 60 }
    col++
    childrenOf[id]?.forEach(childId => place(childId, row + 1))
  }

  screens.filter(s => !hasParent.has(s.id)).forEach(s => place(s.id, 0))
  screens.forEach((s, i) => {
    if (!positions[s.id]) { positions[s.id] = { x: col * GAP_X + 40, y: 60 }; col++ }
  })

  return positions
}

// ── Build edges from screen button links ──────────────────────────────────────
function buildEdges(screens) {
  const edges = []
  const seen = new Set()
  screens.forEach(screen => {
    screen.components.forEach(comp => {
      if (comp.type === 'buttons' || comp.type === 'footer') {
        comp.buttons?.forEach(btn => {
          if (btn.action === 'NAVIGATE' && btn.next_screen) {
            const key = `${screen.id}→${btn.next_screen}`
            if (!seen.has(key) && screens.some(s => s.id === btn.next_screen)) {
              seen.add(key)
              edges.push({
                id: `edge_${btn.id}`,
                source: screen.id,
                target: btn.next_screen,
                label: btn.label,
                animated: true,
                labelStyle: { fontSize: 10, fill: '#8b949e' },
                labelBgStyle: { fill: '#1c2128', fillOpacity: .95 },
                labelBgPadding: [4, 3],
                labelBgBorderRadius: 4,
                style: { stroke: '#388bfd', strokeWidth: 1.5 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#388bfd', width: 16, height: 16 },
              })
            }
          }
        })
      }
    })
  })
  return edges
}

// ── Main FlowCanvas component ─────────────────────────────────────────────────
export default function FlowCanvas({ flow, onUpdateFlow, selectedScreenId, onSelectScreen, onAddScreen }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const flowIdRef = useRef(null)

  // Sync flow screens → ReactFlow nodes & edges
  useEffect(() => {
    if (!flow?.screens?.length) { setNodes([]); setEdges([]); return }

    const isNewFlow = flowIdRef.current !== flow.id
    flowIdRef.current = flow.id

    const positions = isNewFlow ? autoLayout(flow.screens) : {}

    setNodes(prev =>
      flow.screens.map((screen, i) => {
        const existing = isNewFlow ? null : prev.find(n => n.id === screen.id)
        return {
          id: screen.id,
          type: 'screen',
          position: existing?.position || screen._pos || positions[screen.id] || { x: i * 300 + 40, y: 60 },
          data: { screen, isFirst: i === 0 },
        }
      })
    )
    setEdges(buildEdges(flow.screens))
  }, [flow?.screens, flow?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save node positions to flow data on drag stop
  const onNodeDragStop = useCallback((_, node) => {
    onUpdateFlow({
      screens: flow.screens.map(s => s.id === node.id ? { ...s, _pos: node.position } : s),
    })
  }, [flow, onUpdateFlow])

  // On connect: set next_screen on first available NAVIGATE button
  const onConnect = useCallback((params) => {
    const { source, target } = params
    if (source === target) return
    let connected = false
    const updatedScreens = flow.screens.map(s => {
      if (s.id !== source) return s
      const updatedComps = s.components.map(comp => {
        if (connected || (comp.type !== 'buttons' && comp.type !== 'footer')) return comp
        const updatedBtns = comp.buttons.map(btn => {
          if (connected || btn.action !== 'NAVIGATE') return btn
          if (!btn.next_screen) { connected = true; return { ...btn, next_screen: target } }
          return btn
        })
        return { ...comp, buttons: updatedBtns }
      })
      return { ...s, components: updatedComps }
    })
    if (connected) onUpdateFlow({ screens: updatedScreens })
  }, [flow, onUpdateFlow])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes.map(n => ({ ...n, selected: n.id === selectedScreenId }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, node) => onSelectScreen(node.id)}
        onPaneClick={() => onSelectScreen(null)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1c2128" gap={24} size={1} variant="dots" />
        <Controls
          showInteractive={false}
          style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}
        />
        <MiniMap
          nodeColor={n => n.data?.screen?.is_terminal ? '#3fb950' : n.data?.isFirst ? '#a371f7' : '#388bfd'}
          maskColor="rgba(13,17,23,.82)"
          style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8 }}
        />

        {/* Toolbar: Add Screen */}
        <Panel position="top-left">
          <button
            onClick={onAddScreen}
            style={{
              background: 'linear-gradient(135deg,#22c55e,#0d9488)',
              border: 'none', color: 'white', borderRadius: 8,
              padding: '7px 14px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: '0 2px 8px rgba(0,0,0,.3)', fontFamily: "'Inter',system-ui,sans-serif",
            }}
          >
            + Add Screen
          </button>
        </Panel>

        {/* Legend */}
        <Panel position="top-right">
          <div style={{
            display: 'flex', gap: 10, alignItems: 'center',
            background: 'rgba(13,17,23,.88)', padding: '5px 12px',
            borderRadius: 8, border: '1px solid #21262d',
            fontSize: 10, color: '#6e7681', fontFamily: "'Inter',system-ui,sans-serif",
          }}>
            {[['#a371f7','Entry'], ['#388bfd','Screen'], ['#3fb950','End']].map(([color, label]) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
        </Panel>

        {/* Help hint */}
        <Panel position="bottom-center">
          <p style={{
            fontSize: 10, color: '#484f58', fontFamily: "'Inter',system-ui,sans-serif",
            background: 'rgba(13,17,23,.7)', padding: '3px 10px', borderRadius: 6,
          }}>
            Click node to edit · Drag orange handle to connect screens
          </p>
        </Panel>
      </ReactFlow>
    </div>
  )
}
