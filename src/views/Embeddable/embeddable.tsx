import React, { useEffect } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import routes from '../../routes'
import { useMediaQueryUtils } from '../../constants/exportHooks'

const ChevronLeft = (): ReactElement => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M10 12L6 8l4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
)

// Small, dependency-free code block. The page is app-only (not part of the
// published library surface in lib.ts), so standard Tailwind utilities are safe
// here — no consumer purge to worry about.
const CodeBlock = ({ children }: { children: ReactNode }): ReactElement => (
    <pre
        className="bg-ink text-canvas rounded-card p-4 overflow-x-auto text-xs leading-relaxed
            shadow-card font-mono whitespace-pre"
    >
        <code>{children}</code>
    </pre>
)

const Section = ({
    title,
    children,
}: {
    title: string
    children: ReactNode
}): ReactElement => (
    <section className="mb-8 tablet-landscape:mb-10">
        <h2 className="text-base tablet-landscape:text-lg font-bold text-ink tracking-tight mb-3 font-display">
            {title}
        </h2>
        {children}
    </section>
)

const EmbeddablePage: React.FC = () => {
    const { isMobile } = useMediaQueryUtils()

    // Set the document title + meta description for this route. The app is an
    // SPA, so the static index.html title is shared across routes — updating it
    // here gives this page a unique title/snippet when crawled and when shared.
    useEffect(() => {
        const prevTitle = document.title
        document.title =
            'Embeddable Whiteboard for React Apps — Craftbase'

        const description =
            'Embed Craftbase, an open-source whiteboard canvas, into your React app with a single <Board /> component. Whiteboard data lives in the browser localStorage — no backend required to get started.'
        let meta = document.querySelector(
            'meta[name="description"]'
        ) as HTMLMetaElement | null
        const createdMeta = !meta
        if (!meta) {
            meta = document.createElement('meta')
            meta.name = 'description'
            document.head.appendChild(meta)
        }
        const prevDescription = meta.content
        meta.content = description

        return (): void => {
            document.title = prevTitle
            if (createdMeta) {
                meta?.remove()
            } else if (meta) {
                meta.content = prevDescription
            }
        }
    }, [])

    return (
        <div className="min-h-screen bg-canvas text-left">
            {/* Nav */}
            <nav className="sticky top-0 z-10 bg-sidebar border-b border-border-panel shadow-sm">
                <div className="w-full max-w-2xl laptop:max-w-full mx-auto px-4 tablet-landscape:px-6 py-3 flex items-center justify-between">
                    <span className="text-ink font-bold text-sm tablet-landscape:text-base tracking-tight font-display">
                        Craftbase
                    </span>
                    <Link
                        to={routes.index}
                        className="flex items-center gap-1 text-sm text-ink-mid no-underline font-medium
                            px-2 py-1 rounded-md hover:bg-accent/30 transition-all ease-in duration-150"
                    >
                        <ChevronLeft />
                        <span>{isMobile ? 'Back' : 'Back to board'}</span>
                    </Link>
                </div>
            </nav>

            {/* Body */}
            <main className="w-full max-w-2xl mx-auto px-4 tablet-landscape:px-6 py-8 tablet-landscape:py-12">
                {/* Header */}
                <header className="mb-8 tablet-landscape:mb-12">
                    <h1 className="text-2xl tablet-landscape:text-3xl font-bold text-ink tracking-tight mb-3 font-display">
                        Embeddable Whiteboard for React
                    </h1>
                    <p className="text-sm tablet-landscape:text-base text-ink-muted leading-relaxed">
                        Craftbase is an open-source, embeddable whiteboard canvas
                        you can drop into any React app as a single component.
                        Mount the <code className="text-accent-dark">{'<Board />'}</code>{' '}
                        and you get a full sketching surface — shapes, arrows,
                        text, freehand drawing, pan and zoom — rendered with
                        Two.js. No backend is required to get started: your
                        whiteboard data lives in the browser's{' '}
                        <strong className="text-ink">localStorage</strong>.
                    </p>
                </header>

                <Section title="Install">
                    <p className="text-xs tablet-landscape:text-sm text-ink-muted leading-relaxed mb-3">
                        Add Craftbase as a dependency. During local development
                        you can link the package directly from a sibling
                        checkout:
                    </p>
                    <CodeBlock>{`// package.json
{
  "dependencies": {
    "craftbase": "link:../craftbase"
  }
}`}</CodeBlock>
                </Section>

                <Section title="Drop it into your app">
                    <p className="text-xs tablet-landscape:text-sm text-ink-muted leading-relaxed mb-3">
                        Import the <code className="text-accent-dark">Board</code>{' '}
                        component and render it inside a sized container. That's
                        the whole integration — Craftbase owns the canvas, tools
                        and interactions.
                    </p>
                    <CodeBlock>{`import { Board } from 'craftbase'

export default function Whiteboard() {
    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <Board />
        </div>
    )
}`}</CodeBlock>
                </Section>

                <Section title="Where your whiteboard data lives">
                    <p className="text-xs tablet-landscape:text-sm text-ink-muted leading-relaxed mb-3">
                        By default Craftbase runs in <strong className="text-ink">local
                        mode</strong>. Everything a user draws is kept in React
                        state and continuously saved to the browser's{' '}
                        <strong className="text-ink">localStorage</strong> as a
                        draft. This means:
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5 text-xs tablet-landscape:text-sm text-ink-muted leading-relaxed mb-3">
                        <li>
                            No database, server or account is needed to start —
                            the canvas works fully offline.
                        </li>
                        <li>
                            The board is restored automatically on reload from
                            the saved localStorage draft.
                        </li>
                        <li>
                            Data is scoped to the user's browser and origin, so
                            it is private to that device until you choose to
                            persist or share it.
                        </li>
                    </ul>
                    <p className="text-xs tablet-landscape:text-sm text-ink-muted leading-relaxed">
                        Because the draft is just localStorage, clearing the
                        browser's site data (or opening the app in a different
                        browser/device) starts a fresh board. When you're ready
                        to sync across devices, Craftbase can be wired to a
                        backend, but that's entirely opt-in.
                    </p>
                </Section>

                <Section title="Configure your bundler">
                    <p className="text-xs tablet-landscape:text-sm text-ink-muted leading-relaxed mb-3">
                        Craftbase ships TypeScript source (
                        <code className="text-accent-dark">.ts</code>/
                        <code className="text-accent-dark">.tsx</code>). Make sure
                        your bundler compiles it and that Tailwind scans
                        Craftbase's classes so they survive purging:
                    </p>
                    <CodeBlock>{`// tailwind.config.js
export default {
    content: [
        './src/**/*.{ts,tsx}',
        './node_modules/craftbase/src/**/*.{ts,tsx}',
    ],
}

// vite.config.js — let Vite handle Craftbase's TS source
export default {
    optimizeDeps: { exclude: ['craftbase'] },
}`}</CodeBlock>
                </Section>

                {/* CTA */}
                <div
                    className="bg-card-bg border border-border-card rounded-card p-4 tablet-landscape:p-5
                        flex flex-col tablet-landscape:flex-row tablet-landscape:items-center
                        justify-between gap-3 shadow-card"
                >
                    <div className="text-xs tablet-landscape:text-sm text-ink-mid">
                        Want the full API and extension points? Browse the source
                        and docs on GitHub.
                    </div>
                    <a
                        href="https://github.com/craftbase-org/craftbase"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs tablet-landscape:text-sm font-semibold text-accent-dark no-underline
                            border-b border-accent-dark whitespace-nowrap self-start"
                    >
                        View on GitHub →
                    </a>
                </div>
            </main>
        </div>
    )
}

export default EmbeddablePage
