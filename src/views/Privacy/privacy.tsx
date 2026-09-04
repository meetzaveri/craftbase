import React, { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import routes from '../../routes'
import { useMediaQueryUtils } from '../../constants/exportHooks'

const LAST_UPDATED = 'May 17, 2026'

const ChevronLeft = (): ReactNode => (
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

const Section: React.FC<{ title: string; children: ReactNode }> = ({
    title,
    children,
}) => (
    <section className="mb-6 tablet-landscape:mb-8">
        <h2 className="text-base tablet-landscape:text-lg font-bold text-ink tracking-tight mb-2 font-display">
            {title}
        </h2>
        <div className="text-xs tablet-landscape:text-sm text-ink-mid leading-relaxed space-y-2">
            {children}
        </div>
    </section>
)

const PrivacyPage: React.FC = () => {
    const { isMobile } = useMediaQueryUtils()

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
                <div className="mb-6 tablet-landscape:mb-10">
                    <h1 className="text-xl tablet-landscape:text-2xl font-bold text-ink tracking-tight mb-2 font-display">
                        Privacy
                    </h1>
                    <p className="text-xs tablet-landscape:text-sm text-ink-muted leading-relaxed">
                        Last updated: {LAST_UPDATED}
                    </p>
                </div>

                {/* TL;DR */}
                <div
                    className="bg-card-bg border border-border-card rounded-card p-4 mb-6 tablet-landscape:mb-10
                    shadow-card"
                >
                    <div className="text-xs font-semibold text-ink-mid uppercase tracking-wider mb-2">
                        In short
                    </div>
                    <p className="text-xs tablet-landscape:text-sm text-ink-mid leading-relaxed">
                        Craftbase doesn't ask for your name, email, or any
                        sign-up. You're an anonymous, randomly-named identity
                        stored in your own browser. Anything you draw stays in
                        your browser until <em>you</em> explicitly choose to
                        share a board &mdash; at which point that board becomes
                        publicly viewable. We use a privacy-first analytics tool
                        that doesn't set cookies or store your IP address.
                    </p>
                </div>

                <Section title="Who you are to us">
                    <p>
                        When you first open Craftbase, we create an anonymous
                        identity for you: a random ID and a randomly-picked
                        nickname (for example, &ldquo;tropical&nbsp;owl&rdquo;).
                        This ID is stored in your browser's local storage. We do{' '}
                        <strong>not</strong> collect your name, email address,
                        phone number, or any other personally identifying
                        information &mdash; there is no account and no sign-up.
                    </p>
                    <p>
                        This anonymous ID, along with a counter of how many
                        times Craftbase has been opened from your browser, is
                        stored in our database so the app can function. It is
                        not linked to your real-world identity and is not shared
                        with or sold to anyone.
                    </p>
                    <p>
                        Because this identity lives in your browser's storage,
                        using a different browser, a different device, a private
                        / incognito window, or clearing your browser data will
                        create a new, separate anonymous identity.
                    </p>
                </Section>

                <Section title="Your boards and what you draw">
                    <p>
                        <strong>Local mode (the default).</strong> While you're
                        just sketching, everything you create &mdash; shapes,
                        text, drawings &mdash; stays only in your own browser's
                        local storage. It is not uploaded to our servers and we
                        cannot see it.
                    </p>
                    <p>
                        <strong>Shared boards.</strong> When you choose to share
                        a board, we ask you to confirm first. Once you confirm,
                        that board and its contents are uploaded to the cloud
                        and become <strong>publicly viewable</strong> by anyone
                        with the link. Please don't put confidential or
                        sensitive information on a board you intend to share.
                        Sharing is always your explicit choice &mdash; nothing
                        leaves your browser until you opt in.
                    </p>
                </Section>

                <Section title="Analytics">
                    <p>
                        We use{' '}
                        <a
                            href="https://umami.is/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent-dark font-semibold no-underline border-b border-accent-dark"
                        >
                            Umami
                        </a>{' '}
                        (Umami Cloud) for privacy-friendly, aggregate usage
                        analytics &mdash; things like which pages are viewed,
                        the referring site, approximate location at the
                        country/region level, and broad device or browser type.
                    </p>
                    <p>
                        Umami does <strong>not</strong> use cookies and does{' '}
                        <strong>not</strong> store your IP address. Your IP is
                        used momentarily and server-side to estimate approximate
                        location, then discarded. There is no cross-site
                        tracking, no advertising profiles, and this analytics
                        data is aggregate &mdash; it is not joined to the
                        anonymous in-app identity described above.
                    </p>
                </Section>

                <Section title="What we never collect">
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Your name, email, or phone number</li>
                        <li>
                            Precise geolocation (we never ask your browser for
                            location access)
                        </li>
                        <li>Device fingerprints or cross-site trackers</li>
                        <li>
                            The contents of boards you keep in local mode and
                            never share
                        </li>
                    </ul>
                    <p>We do not sell or rent any data to anyone.</p>
                </Section>

                <Section title="Your controls">
                    <p>
                        You can reset your anonymous identity and wipe all
                        locally-stored boards at any time by clearing this
                        site's data in your browser settings.
                    </p>
                    <p>
                        Note that once a board has been shared it is public, and
                        copies that other people have opened may persist
                        independently. If you'd like a shared board taken down,
                        contact us at the address below.
                    </p>
                </Section>

                <Section title="Contact">
                    <p>
                        Questions about this policy or a data request? Email{' '}
                        <a
                            href="mailto:support@craftbase.org"
                            className="text-accent-dark font-semibold no-underline border-b border-accent-dark"
                        >
                            support@craftbase.org
                        </a>
                        .
                    </p>
                </Section>

                <p className="text-xs text-ink-muted leading-relaxed mt-8 pt-6 border-t border-border-panel">
                    We may update this policy as Craftbase evolves. Material
                    changes will be reflected in the &ldquo;last updated&rdquo;
                    date above.
                </p>
            </main>
        </div>
    )
}

export default PrivacyPage
