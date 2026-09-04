import React, { type ReactNode } from 'react'
import * as Sentry from '@sentry/react'

interface Props {
    children?: ReactNode
}

interface State {
    hasError: boolean
}

class ErrorBoundaryBoardView extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(_error: unknown): State {
        return { hasError: true }
    }

    override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        Sentry.captureException(error, {
            user: { id: localStorage.getItem('userId') ?? undefined },
            contexts: {
                board: {
                    boardId:
                        localStorage.getItem(
                            'craftbase_background_board_id'
                        ) ?? undefined,
                },
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            extra: errorInfo as any,
        })
    }

    override render(): ReactNode {
        if (this.state.hasError) {
            return <h1>Couldn't load board view. Something went wrong</h1>
        }

        return this.props.children
    }
}

export default ErrorBoundaryBoardView
