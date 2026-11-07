// Same font set the standalone app loads from index.html. Font tokens stay
// named (Geist, Fraunces, Caveat Brush) — see .claude/context/font-guide.md.
const FONTS_HREF =
    'https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&family=Geist+Mono:wght@100..900&family=Geist:wght@100..900&family=Caveat+Brush&display=swap'

const LINK_ID = 'craftbase-fonts'

/** Inject the Google Fonts stylesheet once per page. */
export function ensureFontsLoaded(): void {
    if (typeof document === 'undefined') return
    if (document.getElementById(LINK_ID)) return
    const link = document.createElement('link')
    link.id = LINK_ID
    link.rel = 'stylesheet'
    link.href = FONTS_HREF
    document.head.appendChild(link)
}
