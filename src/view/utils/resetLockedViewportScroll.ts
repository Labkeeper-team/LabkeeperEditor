/**
 * App chrome is locked to the visual viewport (overflow hidden + --inner-height).
 * Focus on CodeMirror / inputs can still nudge window, document, or #root scroll
 * (notably Safari 26 where focus({ preventScroll }) is broken).
 */
export function resetLockedViewportScroll(): void {
    if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
    }
    if (document.documentElement.scrollTop !== 0) {
        document.documentElement.scrollTop = 0;
    }
    if (document.body.scrollTop !== 0) {
        document.body.scrollTop = 0;
    }
    const root = document.getElementById('root');
    if (root && root.scrollTop !== 0) {
        root.scrollTop = 0;
    }
}

/** Same reset after paint — catches async focus scroll (Safari). */
export function resetLockedViewportScrollAfterFocus(): void {
    resetLockedViewportScroll();
    requestAnimationFrame(() => {
        resetLockedViewportScroll();
        requestAnimationFrame(resetLockedViewportScroll);
    });
}
