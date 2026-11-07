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
            'Embed Craftbase, a whiteboard canvas, into your React app with npm install craftbase and a single <Craftbase /> component. Your app owns the board data. No backend needed.'
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
                        Craftbase is an embeddable whiteboard you can drop into
                        any React app as one component. Mount 
                        <code className="text-accent-dark">{'<Craftbase />'}</code> 
                        and you get shapes, connectors, text, freehand drawing,
                        pan and zoom. No backend is needed. Your app holds the
                        board data, and the user decides whether their browser
                        keeps a copy.
                    </p>
                </header>

                <Section title="Install">
                    <CodeBlock>{`npm install craftbase`}</CodeBlock>
                    <p className="text-xs tablet-landscape:text-sm text-ink-muted leading-relaxed mt-3">
                        Needs <code className="text-accent-dark">react</code> and 
                        <code className="text-accent-dark">react-dom</code> 18.
                        The package ships compiled JavaScript, one CSS file and
                        TypeScript types, so it works with any bundler.
                    </p>
                </Section>

                <Section title="Drop it into your app">
                    <p className="text-xs tablet-landscape:text-sm text-ink-muted leading-relaxed mb-3">
                        Render it inside an element that has a size. The board
                        fills that element. Keep the data in your own state with 
                        <code className="text-accent-dark">onChange</code>.
                    </p>
                    <CodeBlock>{`import { useRef, useState } from 'react'
import { Craftbase } from 'craftbase'
import type { CraftbaseData, CraftbaseHandle } from 'craftbase'
import 'craftbase/style.css'

export default function Whiteboard() {
    const [data, setData] = useState<CraftbaseData>()
    const board = useRef<CraftbaseHandle>(null)

    return (
        <div style={{ height: 600 }}>
            <Craftbase initialData={data} onChange={setData} ref={board} />
        </div>
    )
}

// board.current?.load(data)   replace the board
// board.current?.clear()      remove every element
// board.current?.getData()    current document`}</CodeBlock>
                </Section>

                <Section title="Where your whiteboard data lives">
                    <p className="text-xs tablet-landscape:text-sm text-ink-muted leading-relaxed mb-3">
                        Your component gets the whole board through 
                        <code className="text-accent-dark">onChange</code>. Separately,
                        the <code className="text-accent-dark">storage</code> prop
                        decides whether the browser keeps a copy:
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5 text-xs tablet-landscape:text-sm text-ink-muted leading-relaxed mb-3">
                        <li>
                            <strong className="text-ink">ask</strong> (default):
                            a small prompt asks the user. If they allow it, the
                            board is saved to localStorage and survives a
                            refresh. If they say no, it lives in memory only and
                            is gone on refresh. The answer is remembered.
                        </li>
                        <li>
                            <strong className="text-ink">local</strong>: you
                            already have consent. Saves without asking.
                        </li>
                        <li>
                            <strong className="text-ink">memory</strong>: never
                            touches localStorage.
                        </li>
                    </ul>
                    <p className="text-xs tablet-landscape:text-sm text-ink-muted leading-relaxed">
                        Stored keys start with 
                        <code className="text-accent-dark">craftbase_</code>, so
                        they never clash with your app's keys. Use 
                        <code className="text-accent-dark">storageKey</code> to
                        keep separate boards apart.
                    </p>
                </Section>

                <Section title="Styling and limits">
                    <ul className="list-disc pl-5 space-y-1.5 text-xs tablet-landscape:text-sm text-ink-muted leading-relaxed">
                        <li>
                            All craftbase styles are scoped to the board. Your
                            page's styles stay as they are, and they don't reach
                            inside the board.
                        </li>
                        <li>
                            <code className="text-accent-dark">theme</code> 
                            switches between light and dark.
                        </li>
                        <li>One board per page.</li>
                        <li>
                            No image elements, and no sharing. The board stays
                            in the browser.
                        </li>
                    </ul>
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
