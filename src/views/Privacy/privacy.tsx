import React, { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import routes from '../../routes'
import { useMediaQueryUtils } from '../../constants/exportHooks'

const LAST_UPDATED = 'August 30, 2026'

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
                        <span>{isMobile ? 'Back' : 'Back to canvas'}</span>
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
                        Craftbase doesn't ask for your name, email or any
                        sign-up. You get an anonymous identity with a random
                        name, and it is stored in your own browser. Whatever you
                        draw stays in your browser until you choose to share a
                        canvas. Once you share it, anyone with the link can view
                        it. For analytics we use a tool that doesn't set cookies
                        and doesn't store your IP address.
                    </p>
                    <p className="text-xs tablet-landscape:text-sm text-ink-mid leading-relaxed mt-2">
                        One thing to note about maps. A canvas can use a map as
                        its backdrop. We ask your browser for your location only
                        when you tap &ldquo;Use my current location&rdquo;, never
                        automatically. And when you share a map canvas, the
                        coordinate it is pinned to becomes public along with it.
                    </p>
                </div>

                <Section title="Who you are to us">
                    <p>
                        When you first open Craftbase, we create an anonymous
                        identity for you. It is a random ID plus a randomly
                        picked nickname, for example
                        &ldquo;tropical&nbsp;owl&rdquo;. We store this ID in your
                        browser's local storage. We don't collect your name,
                        email address, phone number or anything else that
                        identifies you personally. There is no account and no
                        sign-up.
                    </p>
                    <p>
                        We keep this anonymous ID in our database along with a
                        counter of how many times Craftbase has been opened from
                        your browser. The app needs both to function. It is not
                        linked to your real identity, and we don't share or sell
                        it.
                    </p>
                    <p>
                        Since this identity lives in your browser's storage, you
                        will get a new and separate one if you switch browsers,
                        switch devices, use a private window, or clear your
                        browser data.
                    </p>
                </Section>

                <Section title="Your canvases and what you draw">
                    <p>
                        <strong>Local mode (the default).</strong> While you are
                        sketching, everything you create stays in your own
                        browser's local storage. That covers shapes, text and
                        drawings. We don't upload any of it and we can't see it.
                    </p>
                    <p>
                        <strong>Shared canvases.</strong> When you share a
                        canvas, we ask you to confirm first. After you confirm,
                        we upload that canvas and its contents to the cloud.
                        Anyone with the link can then view it. So avoid putting
                        confidential or sensitive information on a canvas you
                        plan to share. Nothing leaves your browser until you opt
                        in.
                    </p>
                </Section>

                <Section title="Maps and location">
                    <p>
                        A canvas can use a map as its backdrop instead of the
                        blank whiteboard. A map has to open somewhere, so this is
                        the only part of Craftbase that deals with location.
                        Below is everything it does.
                    </p>
                    <p>
                        <strong>Your timezone, to pick an opening view.</strong>{' '}
                        When you switch a canvas to a map for the first time, we
                        read your browser's timezone (for example{' '}
                        <em>Asia/Kolkata</em>) and open the map near a city in
                        that zone. This needs no permission, and the value stays
                        inside your browser. We never receive it. A timezone
                        covers a country-sized region, so treat it as a rough
                        guess and not as your location.
                    </p>
                    <p>
                        <strong>
                            Your device location, only when you ask for it.
                        </strong>{' '}
                        The map has a &ldquo;Use my current location&rdquo;
                        button. We ask your browser for your position only if you
                        tap it, and your browser will ask you to approve that
                        separately. We use the coordinate once, to decide where
                        the map is pinned. After that we don't read your location
                        again. You can decline and nothing breaks. You stay on
                        the timezone view and can search for any place instead.
                        There is no background tracking and no location history.
                    </p>
                    <p>
                        <strong>Where that pin is stored.</strong> The pin is a
                        longitude, latitude and zoom level. We save it in your
                        own browser's local storage next to the canvas. Like the
                        rest of local mode, it doesn't reach our servers until
                        you share.
                    </p>
                    <p>
                        <strong>Sharing a map canvas publishes its pin.</strong>{' '}
                        When you share a map canvas, two coordinates go up with
                        it and become publicly viewable. One is the pin the map
                        is anchored to. The other is the view you were looking at
                        when you shared. Both are needed so that someone opening
                        your link sees your drawing at the right place on Earth.
                        Now consider the case where that pin came from &ldquo;Use
                        my current location&rdquo;. Sharing then publishes a
                        coordinate derived from where you were. If you don't want
                        that, search for a nearby place first and share from
                        there.
                    </p>
                    <p>
                        <strong>Map services we don't run.</strong> Two outside
                        services make the map work. Your browser contacts them
                        directly, so they can see your IP address and we never
                        see the request:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>
                            <a
                                href="https://carto.com/privacy/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent-dark font-semibold no-underline border-b border-accent-dark"
                            >
                                CARTO
                            </a>{' '}
                            serves the map imagery, built on OpenStreetMap data.
                            It receives requests for the map area you are
                            currently viewing.
                        </li>
                        <li>
                            <a
                                href="https://osmfoundation.org/wiki/Privacy_Policy"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent-dark font-semibold no-underline border-b border-accent-dark"
                            >
                                Nominatim
                            </a>
                            , run by the OpenStreetMap Foundation, answers place
                            searches. Whatever you type in the place-search box
                            is sent to them to look up. We don't log or store
                            your searches.
                        </li>
                    </ul>
                    <p>
                        Neither service is contacted unless you open a map
                        canvas.
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
                        (Umami Cloud) for aggregate usage analytics. That covers
                        which pages are viewed, the referring site, approximate
                        location at country or region level, and broad device or
                        browser type.
                    </p>
                    <p>
                        Umami doesn't use cookies and doesn't store your IP
                        address. It uses your IP momentarily on the server to
                        estimate approximate location, then discards it. There is
                        no cross-site tracking and no advertising profiles. This
                        data is aggregate, and we don't join it to the anonymous
                        in-app identity described above.
                    </p>
                </Section>

                <Section title="What we never collect">
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Your name, email or phone number</li>
                        <li>
                            Background or continuous location tracking. On a map
                            canvas we ask for your location only when you tap
                            &ldquo;Use my current location&rdquo;, and only at
                            that moment. We don't follow you after that. See{' '}
                            <em>Maps and location</em> above.
                        </li>
                        <li>Device fingerprints or cross-site trackers</li>
                        <li>
                            The contents of canvases you keep in local mode and
                            never share
                        </li>
                    </ul>
                    <p>We don't sell or rent any data to anyone.</p>
                </Section>

                <Section title="Your controls">
                    <p>
                        You can reset your anonymous identity and wipe every
                        locally stored canvas at any time. Clear this site's data
                        in your browser settings and both are gone.
                    </p>
                    <p>
                        Keep in mind that a canvas stays public once you have
                        shared it. Copies that other people opened can also
                        persist on their own. If you want a shared canvas taken
                        down, email us at the address below.
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
                    We may update this policy as Craftbase evolves. Any
                    material change will show up in the &ldquo;last
                    updated&rdquo; date above.
                </p>
            </main>
        </div>
    )
}

export default PrivacyPage
