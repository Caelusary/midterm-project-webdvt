import { Component } from 'react'

/**
 * React unmounts the entire tree on an uncaught render error, so without this
 * any single bad row or malformed date renders a blank white page with the
 * cause visible only in the console.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // No third-party reporting here on purpose — the console is the only
    // consumer, and shipping an analytics SDK for this would be worse.
    console.error('Unhandled render error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="boot">
        <h1>Something went wrong</h1>
        <p className="page-sub">
          The page hit an error it couldn&apos;t recover from. Reloading usually fixes it.
        </p>
        <p className="hint">{this.state.error.message}</p>
        <button type="button" className="button button-primary"
          onClick={() => window.location.reload()}>
          Reload
        </button>
      </main>
    )
  }
}
