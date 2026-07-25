import { Fragment } from 'react'

/**
 * Shared renderer for WhatsApp template body/header text.
 *
 * Every preview in the app (create template, edit template, send template,
 * broadcast) previously did its own `String.replace()` on {{n}} placeholders.
 * That produced flat text where a substituted value looked identical to the
 * surrounding copy, and it disagreed on how to show an unfilled placeholder —
 * some rendered `{{3}}`, others `[3]`.
 *
 * This component renders the same text everywhere with two visual states:
 *   • filled   → the value, tinted so it's identifiable as a variable
 *   • unfilled → `{{n}}` in a dashed amber chip, so missing values are obvious
 *                before sending rather than after
 */

// Splits text while KEEPING the {{...}} delimiters as their own chunks.
const SPLIT_VARS = /(\{\{\w+\}\})/g
const IS_VAR     = /^\{\{(\w+)\}\}$/

// WhatsApp inline formatting. Applied to literal text only — never to a
// substituted value, so a user's data can't accidentally style the preview.
const SPLIT_MD = /(```[^`]+```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g

function renderMarkdown(text, keyPrefix) {
  if (!text) return null
  return text.split(SPLIT_MD).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-md${i}`
    if (/^```[^`]+```$/.test(part))
      return <code key={key} className="font-mono">{part.slice(3, -3)}</code>
    if (/^\*[^*\n]+\*$/.test(part))
      return <strong key={key} className="font-semibold">{part.slice(1, -1)}</strong>
    if (/^_[^_\n]+_$/.test(part))
      return <em key={key}>{part.slice(1, -1)}</em>
    if (/^~[^~\n]+~$/.test(part))
      return <s key={key}>{part.slice(1, -1)}</s>
    return <Fragment key={key}>{part}</Fragment>
  })
}

/**
 * @param text      raw template text containing {{1}} / {{name}} placeholders
 * @param variables map of placeholder key → value
 * @param markdown  render WhatsApp *bold* / _italic_ / ~strike~ / ```mono```
 * @param highlight false → plain substitution with no chips (compact list rows)
 */
export default function TemplateText({
  text = '',
  variables = {},
  markdown = true,
  highlight = true,
  className = '',
}) {
  const chunks = String(text || '').split(SPLIT_VARS)

  return (
    <span className={className}>
      {chunks.map((chunk, i) => {
        const m = IS_VAR.exec(chunk)

        if (!m) {
          return markdown
            ? <Fragment key={i}>{renderMarkdown(chunk, i)}</Fragment>
            : <Fragment key={i}>{chunk}</Fragment>
        }

        const key    = m[1]
        const raw    = variables?.[key]
        const filled = raw !== undefined && raw !== null && String(raw).trim() !== ''

        if (!highlight) return <Fragment key={i}>{filled ? String(raw) : chunk}</Fragment>

        return filled ? (
          <span
            key={i}
            title={`{{${key}}}`}
            className="rounded-[3px] bg-emerald-100/80 text-emerald-900 px-[2px] -mx-[1px]"
          >
            {String(raw)}
          </span>
        ) : (
          <span
            key={i}
            title={`Variable {{${key}}} has no value yet`}
            className="rounded-[3px] bg-amber-50 text-amber-700 border border-dashed border-amber-300 px-[3px] font-mono"
          >
            {`{{${key}}}`}
          </span>
        )
      })}
    </span>
  )
}

/** Ordered, de-duplicated placeholder keys in a template string. */
export function extractVars(text) {
  return [...new Set(
    (String(text || '').match(/\{\{(\w+)\}\}/g) || []).map(m => m.replace(/[{}]/g, ''))
  )]
}

/** True when every placeholder in `text` has a non-empty value. */
export function allVarsFilled(text, variables = {}) {
  return extractVars(text).every(
    k => variables?.[k] !== undefined && String(variables[k] ?? '').trim() !== ''
  )
}
