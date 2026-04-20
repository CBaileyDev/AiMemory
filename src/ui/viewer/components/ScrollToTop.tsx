import React, { useState, useEffect } from 'react';

interface ScrollToTopProps {
  targetRef: React.RefObject<HTMLDivElement>;
}

function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el: HTMLElement | null = node;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    if (/(auto|scroll|overlay)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  return document.scrollingElement as HTMLElement | null;
}

export function ScrollToTop({ targetRef }: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const scroller = findScrollParent(targetRef.current);
    if (!scroller) return;

    const handleScroll = () => {
      setIsVisible(scroller.scrollTop > 300);
    };

    scroller.addEventListener('scroll', handleScroll);
    return () => scroller.removeEventListener('scroll', handleScroll);
  }, []); // Empty deps - only set up listener once on mount

  const scrollToTop = () => {
    const scroller = findScrollParent(targetRef.current);
    scroller?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="scroll-to-top"
      aria-label="Scroll to top"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    </button>
  );
}
