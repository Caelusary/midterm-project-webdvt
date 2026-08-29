import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'

const GAP = 6
const VIEWPORT_MARGIN = 12
const MIN_LIST_HEIGHT = 132

/**
 * Dropdown that always opens downward and always fits on screen.
 *
 * A native <select> hands its popup to the browser, which flips it upward near
 * the bottom of the viewport. Owning the listbox is the only way to guarantee
 * direction — the cost is re-implementing keyboard and ARIA behaviour, plus
 * positioning, which is what most of this file is.
 *
 * The list is position:fixed and placed from the trigger's bounding rect, so
 * it escapes any scrolling or overflow-hidden ancestor, and its max-height is
 * whatever room is actually left below. When that room is too tight to be
 * usable, the trigger is scrolled up first to make some.
 *
 * options: array of { value, label }
 */
export default function Select({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  invalid = false,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [position, setPosition] = useState(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const typeAhead = useRef({ term: '', timer: 0 })
  const generatedId = useId()
  const selectId = id || generatedId

  const selected = useMemo(
    () => options.find(option => option.value === value) || null,
    [options, value]
  )

  const close = useCallback(() => {
    setOpen(false)
    setActiveIndex(-1)
    setPosition(null)
  }, [])

  const measure = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const roomBelow = window.innerHeight - rect.bottom - GAP - VIEWPORT_MARGIN
    const maxHeight = Math.max(MIN_LIST_HEIGHT, Math.min(280, roomBelow))

    // While open, write straight to the node. Routing a scroll through
    // setState re-renders every option on every frame; this is one style
    // write against an element that is already composited on its own layer.
    const list = listRef.current
    if (list) {
      list.style.top = `${rect.bottom + GAP}px`
      list.style.left = `${rect.left}px`
      list.style.width = `${rect.width}px`
      list.style.maxHeight = `${maxHeight}px`
      return
    }

    setPosition({
      top: rect.bottom + GAP,
      left: rect.left,
      width: rect.width,
      maxHeight,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    measure()
  }, [open, measure])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event) {
      if (triggerRef.current?.contains(event.target)) return
      if (listRef.current?.contains(event.target)) return
      close()
    }

    // Reposition rather than detach when the page moves underneath. Throttled
    // to one measurement per frame, and ignoring scrolls of the option list
    // itself — the trigger hasn't moved in that case.
    let frame = 0
    function onReflow(event) {
      if (event?.type === 'scroll' && listRef.current?.contains(event.target)) return
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }

    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('scroll', onReflow, true)
    window.addEventListener('resize', onReflow)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('scroll', onReflow, true)
      window.removeEventListener('resize', onReflow)
    }
  }, [open, close, measure])

  // Keep the highlighted option visible when arrowing past the scroll edge.
  useEffect(() => {
    if (!open || activeIndex < 0) return
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  function openList() {
    if (disabled) return

    // If there is not enough room below to show a usable list, bring the
    // trigger further up the viewport before opening.
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect && window.innerHeight - rect.bottom < MIN_LIST_HEIGHT + GAP + VIEWPORT_MARGIN) {
      triggerRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }

    const startIndex = selected ? options.indexOf(selected) : 0
    setOpen(true)
    setActiveIndex(options.length ? Math.max(0, startIndex) : -1)
  }

  function commit(index) {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    close()
  }

  function handleKeyDown(event) {
    if (disabled) return

    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault()
        openList()
      }
      return
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        close()
        break
      case 'Tab':
        close()
        break
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex(current => Math.min(current + 1, options.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex(current => Math.max(current - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(options.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        commit(activeIndex)
        break
      default:
        if (event.key.length === 1) {
          const state = typeAhead.current
          window.clearTimeout(state.timer)
          state.term += event.key.toLowerCase()
          state.timer = window.setTimeout(() => {
            state.term = ''
          }, 600)

          const match = options.findIndex(option =>
            option.label.toLowerCase().startsWith(state.term)
          )
          if (match >= 0) setActiveIndex(match)
        }
    }
  }

  return (
    <div className="select">
      <button
        type="button"
        id={selectId}
        ref={triggerRef}
        className={`select-trigger${invalid ? ' is-invalid' : ''}`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${selectId}-option-${activeIndex}` : undefined
        }
      >
        <span className={selected ? '' : 'select-placeholder'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="select-chevron" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.75"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && position && (
        <ul
          className="select-list"
          role="listbox"
          ref={listRef}
          aria-labelledby={selectId}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: `${position.width}px`,
            maxHeight: `${position.maxHeight}px`,
          }}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${selectId}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={`select-option${index === activeIndex ? ' is-active' : ''}${
                option.value === value ? ' is-selected' : ''
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={event => event.preventDefault()}
              onClick={() => commit(index)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
