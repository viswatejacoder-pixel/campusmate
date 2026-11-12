import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import DesignModeToggle from './DesignModeToggle.jsx';
import logo from '../assets/campusmate-logo.svg';
import { indexFromHash, pickActive } from '../utils/navActive.js';

// Dashboard sidebar (T-090). The links jump to sections of this page (the only route behind the login is /dashboard).
// `active` is the single source of truth for the highlighted item: a click, the URL hash and scrolling all set it, and both the
// aria-current styling and the glass bubble (.nav-bubble, which glides to the active link) are derived from it.
const ITEMS = [
  ['Dashboard', '#main-content', 'dashboard'],
  ['Tasks', '#tasks-heading', 'tasks'],
  ['Deadlines', '#deadlines-heading', 'deadlines'],
  ['Subjects', '#subjects-heading', 'subjects'],
];
const HREFS = ITEMS.map(([, href]) => href);

export default function Sidebar({ onLogout, loggingOut = false }) {
  const [active, setActive] = useState(() => Math.max(0, indexFromHash(typeof window === 'undefined' ? '' : window.location.hash, HREFS)));
  const linkRefs = useRef([]);
  const bubbleRef = useRef(null);
  const lock = useRef({ on: false, timer: 0 }); // after a click, scrolling must not override the clicked item

  // Put the bubble on the active link (position and size). `instant` skips the glide (first paint, resize).
  const place = useCallback((instant) => {
    const link = linkRefs.current[active];
    const bubble = bubbleRef.current;
    if (!link || !bubble) return;
    if (instant) delete bubble.dataset.ready;
    bubble.style.width = `${link.offsetWidth}px`;
    bubble.style.height = `${link.offsetHeight}px`;
    bubble.style.transform = `translate(${link.offsetLeft}px, ${link.offsetTop}px)`;
    if (instant) {
      void bubble.offsetWidth; // flush so the jump is not transitioned
      requestAnimationFrame(() => { bubble.dataset.ready = '1'; });
    }
  }, [active]);

  const placeRef = useRef(place);
  placeRef.current = place;
  const firstPlace = useRef(true);
  useLayoutEffect(() => {
    place(firstPlace.current); // glide on every change of `active`, but not on the first paint
    firstPlace.current = false;
  }, [place]);

  // Layout changes (resize, breakpoint change, web fonts) re-place the bubble without animation. Subscribed once, so a
  // change of `active` (which would otherwise re-fire the observer) never cuts a glide short.
  useEffect(() => {
    const again = () => placeRef.current(true);
    window.addEventListener('resize', again);
    const list = linkRefs.current[0] && linkRefs.current[0].closest('ul');
    let observer;
    if (list && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(again);
      observer.observe(list);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
    return () => {
      window.removeEventListener('resize', again);
      if (observer) observer.disconnect();
    };
  }, []);

  // Scrolling and the URL hash keep `active` in step with the section in view.
  useEffect(() => {
    const state = lock.current;
    const unlock = () => { state.on = false; };
    let frame = 0;
    const update = () => {
      frame = 0;
      const tops = HREFS.map((href) => {
        const el = document.getElementById(href.slice(1));
        return el ? el.getBoundingClientRect().top : null;
      });
      const root = document.documentElement;
      setActive(pickActive(tops, {
        atTop: window.scrollY <= 2,
        atBottom: window.innerHeight + window.scrollY >= root.scrollHeight - 2,
        line: window.innerHeight * 0.35,
      }));
    };
    const onScroll = () => {
      if (state.on) {
        clearTimeout(state.timer);
        state.timer = setTimeout(unlock, 150); // still scrolling from the click: unlock once it stops
        return;
      }
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onHash = () => {
      const index = indexFromHash(window.location.hash, HREFS);
      if (index >= 0) setActive(index);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('hashchange', onHash);
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(state.timer);
    };
  }, []);

  const choose = (index) => {
    setActive(index);
    const state = lock.current;
    state.on = true;
    clearTimeout(state.timer);
    state.timer = setTimeout(() => { state.on = false; }, 600); // if the click causes no scroll at all
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-logo"><img src={logo} alt="CampusMate" draggable="false" /></span>
      </div>
      <nav aria-label="Dashboard sections">
        <ul className="nav-list">
          <li className="nav-bubble" ref={bubbleRef} role="presentation" aria-hidden="true" />
          {ITEMS.map(([label, href, icon], index) => (
            <li key={href}>
              <a href={href} ref={(el) => { linkRefs.current[index] = el; }} aria-current={index === active ? 'page' : undefined} onClick={() => choose(index)}>
                <Icon name={icon} />
                <span>{label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="sidebar-foot">
      <ThemeToggle />
      <DesignModeToggle />
      <button type="button" className="button-secondary sidebar-logout" onClick={onLogout} disabled={loggingOut}>
        <Icon name="logout" />{loggingOut ? 'Logging out...' : 'Log out'}
      </button>
      </div>
    </aside>
  );
}
