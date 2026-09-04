import React, { type ReactNode } from 'react'

interface Props {
    children?: ReactNode
}

interface State {
    hasError: boolean
}

class ErrorBoundaryEmbeddableView extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(_error: unknown): State {
        return { hasError: true }
    }

    override componentDidCatch(
        _error: Error,
        _errorInfo: React.ErrorInfo
    ): void {}

    override render(): ReactNode {
        if (this.state.hasError) {
            return <h1>Couldn't load this page. Something went wrong</h1>
        }
        return this.props.children
    }
}

export default ErrorBoundaryEmbeddableView
