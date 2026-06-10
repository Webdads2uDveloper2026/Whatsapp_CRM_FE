/**
 * FlowCanvas.jsx — ReactFlow visual canvas for WhatsApp Flow Builder
 * Each WhatsApp screen is a draggable node; navigation buttons create edges.
 */
import { useCallback, useEffect, useRef, useState, memo } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  useNodesState, useEdgesState,
  Handle, Position, MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ── Small id generator for components/buttons created from the canvas ─────────
const uid = () => Math.random().toString(36).slice(2, 10)

// ── Component type icons ───────────────────────────────────────────────────────
const COMP_ICONS = {
  text: '📝', input: '✏️', buttons: '🔘',
  dropdown: '📋', media: '🖼️', footer: '📄',
}

// ── Custom Screen Node ─────────────────────────────────────────────────────────
const ScreenNode = memo(function ScreenNode({ data, selected }) {
  const { screen, isFirst, onEdit, onDelete } = data
  const [hovered, setHovered] = useState(false)

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
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
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
      {/* Hover toolbar — edit / delete */}
      {hovered && (
        <div style={{
          position: 'absolute', top: -12, right: 6, zIndex: 10,
          display: 'flex', gap: 4,
        }}>
          <button
            title="Edit screen"
            onClick={(e) => { e.stopPropagation(); onEdit?.(screen.id) }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: 24, height: 24, borderRadius: 6, border: '1px solid #30363d',
              background: '#21262d', color: '#e6edf3', fontSize: 11, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,.4)',
            }}
          >✏️</button>
          <button
            title="Delete screen"
            onClick={(e) => { e.stopPropagation(); onDelete?.(screen.id) }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: 24, height: 24, borderRadius: 6, border: '1px solid #30363d',
              background: '#21262d', color: '#f85149', fontSize: 11, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,.4)',
            }}
          >🗑</button>
        </div>
      )}

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
                style: { stroke: '#388bfd', strokeWidth: 1.5, cursor: 'pointer' },
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
export default function FlowCanvas({ flow, onUpdateFlow, selectedScreenId, onSelectScreen, onAddScreen, onDeleteScreen }) {
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
          data: { screen, isFirst: i === 0, onEdit: onSelectScreen, onDelete: onDeleteScreen },
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

  // On connect: link source → target like a flowchart editor, falling back through:
  //  1) an existing NAVIGATE button with no target yet
  //  2) the screen's last NAVIGATE button (repurpose it to point at the new target)
  //  3) a brand-new "Continue" button/footer component
  const onConnect = useCallback((params) => {
    const { source, target } = params
    if (source === target) return

    let connected = false
    const updatedScreens = flow.screens.map(s => {
      if (s.id !== source) return s

      // Tier 1: first untargeted NAVIGATE button
      let updatedComps = s.components.map(comp => {
        if (connected || (comp.type !== 'buttons' && comp.type !== 'footer')) return comp
        const updatedBtns = comp.buttons.map(btn => {
          if (connected || btn.action !== 'NAVIGATE') return btn
          if (!btn.next_screen) { connected = true; return { ...btn, next_screen: target } }
          return btn
        })
        return { ...comp, buttons: updatedBtns }
      })

      // Tier 2: repurpose the last NAVIGATE button on the screen
      if (!connected) {
        for (let i = updatedComps.length - 1; i >= 0 && !connected; i--) {
          const comp = updatedComps[i]
          if (comp.type !== 'buttons' && comp.type !== 'footer') continue
          for (let j = comp.buttons.length - 1; j >= 0; j--) {
            if (comp.buttons[j].action === 'NAVIGATE') {
              const newBtns = comp.buttons.map((btn, k) => k === j ? { ...btn, next_screen: target } : btn)
              updatedComps = updatedComps.map((c, k) => k === i ? { ...c, buttons: newBtns } : c)
              connected = true
              break
            }
          }
        }
      }

      // Tier 3: create a brand-new "Continue" buttons component
      if (!connected) {
        const newButton = { id: `b_${uid()}`, label: 'Continue', action: 'NAVIGATE', next_screen: target }
        updatedComps = [...updatedComps, { id: `c_${uid()}`, type: 'buttons', buttons: [newButton] }]
        connected = true
      }

      // A screen that navigates onward can't be terminal — WhatsApp forces terminal
      // screens to "complete" and silently drops any navigate target, breaking the chain.
      return { ...s, components: updatedComps, is_terminal: false }
    })

    if (connected) onUpdateFlow({ screens: updatedScreens })
  }, [flow, onUpdateFlow])

  // Click an edge to remove that screen-to-screen connection (clears the button's next_screen)
  const onEdgeClick = useCallback((event, edge) => {
    event.stopPropagation()
    if (!confirm(`Remove the connection to "${edge.label || 'this screen'}"?`)) return
    const btnId = edge.id.replace(/^edge_/, '')
    const updatedScreens = flow.screens.map(s => ({
      ...s,
      components: s.components.map(comp => {
        if (comp.type !== 'buttons' && comp.type !== 'footer') return comp
        return { ...comp, buttons: comp.buttons.map(btn => btn.id === btnId ? { ...btn, next_screen: '' } : btn) }
      }),
    }))
    onUpdateFlow({ screens: updatedScreens })
  }, [flow, onUpdateFlow])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes.map(n => ({ ...n, selected: n.id === selectedScreenId }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
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
            Click node to edit · Hover a node for ✏️ edit / 🗑 delete · Drag orange handle to connect screens · Click an edge to remove
          </p>
        </Panel>
      </ReactFlow>
    </div>
  )
}
