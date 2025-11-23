import React from 'react';

/**
 * AnimatedBookmark - Complex CSS-animated bookmark component
 * Based on CodePen design with blue accent colors
 * Handles bookmarked/unbookmarked states with smooth animations
 */
const AnimatedBookmark = ({ isBookmarked, onClick, className = '' }) => {
  return (
    <>
      <style>{`
        @property --fade-out {
          syntax: "<percentage>";
          initial-value: 100%;
          inherits: true;
        }

        @property --pulse {
          syntax: "<percentage>";
          initial-value: 0%;
          inherits: true;
        }

        @property --pulse2 {
          syntax: "<percentage>";
          initial-value: 0%;
          inherits: true;
        }

        @property --copacity {
          syntax: "<percentage>";
          initial-value: 0%;
          inherits: true;
        }

        .animated-bookmark-container {
          --w: 16px;
          --h: 22px;
          --gi: 0.6px;
          --gih: calc(var(--gi) / 2);
          --gihn: calc(var(--gi) / -2);
          position: relative;
          width: var(--w);
          height: var(--h);
          cursor: pointer;
          display: inline-block;
        }

        .bookmark-inside {
          width: calc(var(--w) - var(--gi));
          height: calc(var(--h) - var(--gi));
          background: #b5bbc8;
          position: absolute;
          right: var(--gih);
          top: var(--gih);
          border-radius: 2px 2px 0 0;
          box-shadow:
            inset -0.8px 0.8px 2.4px var(--inner-shadow, transparent),
            inset 0.4px 0 0.08px rgba(255, 255, 255, 0.3),
            inset -0.4px 0.08px 0px rgba(255, 255, 255, 0.3),
            inset 0.32px 0 0.04px rgba(0, 0, 0, 0.3),
            inset -0.32px 0 0.04px rgba(0, 0, 0, 0.3),
            inset 0px 0 0.8px rgba(0, 0, 0, 0.1);
          clip-path: polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%);
          transition: all 0.3s ease;
        }

        .bookmark {
          width: var(--w);
          height: var(--h);
          opacity: 0.9;
          background:
            conic-gradient(
              rgba(0, 0, 0, var(--c-bg-alpha, 0.2)),
              rgba(0, 0, 0, var(--c-bg-alpha, 0)),
              rgba(0, 0, 0, var(--c-bg-alpha, 0.2))
            ),
            #b4bac7;
          position: absolute;
          right: 0;
          top: 0;
          border-radius: 2px 2px 0 0;
          box-shadow:
            inset 0.16px -0.08px 0.072px rgba(255, 255, 255, 0.6),
            inset 0.72px 0 0.72px rgba(0, 0, 0, 0.3),
            inset -0.16px 0 0.24px rgba(0, 0, 0, 0.3);
          clip-path: polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%);
        }

        .bookmark-top {
          width: var(--w);
          height: var(--h);
          padding: 0.08px;
          border-top: 0.32px solid rgba(255, 255, 255, 0.5);
          background:
            radial-gradient(
              120% 16% at 50% calc(90% + var(--pulse2)),
              rgba(255 255 255 / var(--copacity, 0%)),
              transparent
            ),
            radial-gradient(
              120% 10% at 50% calc(22% + var(--fade-out) + var(--pulse)),
              rgba(255 255 255 / 80%),
              transparent
            ),
            linear-gradient(
                to bottom,
                rgba(255, 255, 255, 0.1),
                transparent 10%,
                rgba(0, 0, 0, 0.1)
              )
              padding-box,
            linear-gradient(
                #00C2A8 calc(0% + var(--fade-out) + var(--pulse)),
                #32D3FF calc(20% + var(--fade-out) + var(--pulse)),
                #0077ff calc(40% + var(--fade-out) + var(--pulse)),
                #0066dd
              )
              content-box,
            #0055cc;
          position: absolute;
          right: 0;
          top: 0;
          border-radius: 2px 2px 0 0;
          mask:
            linear-gradient(
              to bottom,
              transparent var(--fade-out),
              black calc(var(--fade-out) + 10%)
            );
          clip-path: polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%);
          transition: all 0.3s ease;
          box-shadow:
            inset 0.4px 0 0.08px rgba(0, 0, 0, 0.3),
            inset -0.24px 0 0.08px rgba(255, 255, 255, 0.8);
          opacity: 0;
        }

        .bookmark-top-inner {
          --inner-p: 3.2px;
          width: calc(var(--w) - var(--inner-p));
          height: calc(var(--h) - var(--inner-p));
          background:
            repeating-linear-gradient(
              to right,
              rgba(255, 255, 255, 0.1) 0.016px,
              rgba(255, 255, 255, 0.03) 0.016px,
              transparent 0.04px
            ),
            rgba(0, 0, 0, 0.01);
          backdrop-filter: blur(1px) brightness(1.1) contrast(1.1);
          position: absolute;
          right: calc(var(--inner-p) / 2);
          top: 0;
          border-radius: 0.8px;
          mask:
            linear-gradient(
              to bottom,
              transparent 0.8px,
              black 12%,
              transparent,
              black
            );
          clip-path: polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%);
          transition: all 0.3s ease;
          box-shadow: inset 0.08px -1.6px 1.6px rgba(255, 255, 255, 0.2);
          border: 0.32px dashed rgba(255, 255, 255, 0.25);
          opacity: 0;
        }

        .bookmark-outline {
          --inner-p: 2.4px;
          width: calc(var(--w) + var(--inner-p) * 2);
          height: calc(var(--h) + var(--inner-p) / 1.5);
          padding: 0.96px;
          background:
            linear-gradient(to right, rgba(0, 0, 0, 0.04) 0.32px, transparent 0.08px)
              content-box,
            linear-gradient(
                to bottom,
                transparent calc(10% + var(--fade-out)),
                rgba(139, 163, 232, 0.3),
                rgba(139, 163, 232, 0.3),
                transparent calc(50% + var(--fade-out))
              )
              content-box,
            linear-gradient(to bottom, transparent, transparent, transparent) content-box,
            transparent padding-box;
          position: absolute;
          right: calc(0px - var(--inner-p));
          top: var(--inner-p);
          border-radius: 2px 2px 0 0;
          clip-path: polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%);
          transform-origin: top;
          transition: all 0.3s ease;
          box-shadow: inset 0px 0 2px rgba(139, 163, 232, 0.2);
          opacity: 0;
          scale: 0.6;
        }

        .shadows,
        .shadows2,
        .shadows3,
        .shadows4 {
          opacity: 0;
          position: absolute;
          pointer-events: none;
        }

        .bookmark-top-shadow {
          opacity: 0;
          border-radius: 50%;
          position: absolute;
          right: 3.2px;
          bottom: -2px;
          background: rgba(0, 0, 0, 0.3);
          width: 17.6px;
          height: 7.2px;
          rotate: -33deg;
          filter: blur(0.96px);
        }

        .shadows2 {
          right: 4.6px;
          top: -4px;
          border-radius: 48px 48px 20.8px 0;
          rotate: 45deg;
          background: linear-gradient(181deg, rgba(0, 0, 0, 0.15), transparent 90%);
          width: calc(var(--w) * 1.7);
          height: calc(var(--h) * 1.7);
          filter: blur(1.68px);
        }

        .shadows {
          right: -7.2px;
          bottom: -6px;
          border-radius: 48px 48px 20.8px 0;
          rotate: 352deg;
          background: linear-gradient(-135deg, rgba(0, 0, 0, 0.2), transparent 50%);
          width: calc(var(--w) * 1.8);
          filter: blur(0.8px);
          height: calc(var(--h) * 0.35);
        }

        .shadows3 {
          right: 0;
          bottom: -5px;
          border-radius: 48px 48px 20.8px 0;
          rotate: 367deg;
          background: linear-gradient(-135deg, rgba(0, 0, 0, 0.2), transparent 50%);
          width: calc(var(--w) * 1.1);
          height: calc(var(--h) * 0.4);
          transform: scaleX(-1);
          filter: blur(0.8px);
        }

        .shadows4 {
          right: 0;
          bottom: 0px;
          border-radius: 48px 48px 33.6px 0;
          background: radial-gradient(circle at 50% 100%, transparent 30%, rgba(0, 0, 0, 0.3));
          width: calc(var(--w) * 1.05);
          height: calc(var(--h) * 0.7);
          transform: scaleX(-1);
          filter: blur(1.2px);
        }

        /* Animations */
        @keyframes shadows {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes shadows2 {
          from, to { scale: 1 1; }
          50% { scale: 1 1.04; }
        }

        @keyframes shadows-reverse {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        @keyframes bookmark-top {
          from { scale: 0.975; }
          40% {
            opacity: 1;
            --fade-out: 0%;
            scale: 1;
          }
          to {
            --fade-out: -10%;
            opacity: 1;
            scale: 1.05;
          }
        }

        @keyframes bookmark-top-reverse {
          to { scale: 0.975; }
          40% {
            opacity: 1;
            --fade-out: 0%;
            scale: 1;
          }
          from {
            --fade-out: -10%;
            opacity: 1;
            scale: 1.05;
          }
        }

        @keyframes bookmark-top2 {
          from, to { scale: 1.05; }
          50% { scale: 1.07; }
        }

        @keyframes bookmark-outline {
          28% { opacity: 1; }
          40%, 50% { scale: 1.06; }
          42% { --fade-out: 0%; }
          to {
            --fade-out: 0%;
            opacity: 1;
            scale: 1.04;
          }
        }

        @keyframes bookmark-outline-reverse {
          68% { opacity: 1; }
          40%, 50% { scale: 1.06; }
          42% { --fade-out: 0%; }
          from {
            --fade-out: 0%;
            opacity: 1;
            scale: 1.04;
          }
          to {
            opacity: 0;
            --fade-out: 100%;
            scale: 0.6;
          }
        }

        @keyframes bookmark-outline2 {
          from, to { scale: 1.04 1.04; }
          50% { scale: 1.04 1.02; }
        }

        @keyframes pulse {
          from, to { --pulse: 0%; }
          50% { --pulse: 4%; }
        }

        @keyframes pulse2 {
          from {
            --pulse2: -30%;
            --copacity: 0%;
          }
          50% { --copacity: 20%; }
          to {
            --pulse2: -20%;
            --copacity: 0%;
          }
        }

        /* Active State */
        .animated-bookmark-container.active {
          --inner-shadow: rgba(0, 0, 0, 0.15);
          --c-bg-alpha: 0.2;
        }

        .animated-bookmark-container.active .bookmark-inside {
          scale: 0.975;
          translate: 0 -0.08px;
        }

        .animated-bookmark-container.active .bookmark-top,
        .animated-bookmark-container.active .bookmark-top-inner {
          animation:
            bookmark-top 0.6s linear forwards,
            bookmark-top2 3s 0.95s ease-in-out infinite,
            pulse 2s ease-out 42,
            pulse2 2s ease-out 42;
        }

        .animated-bookmark-container.active .bookmark-outline,
        .animated-bookmark-container.active .bookmark-top-shadow {
          animation:
            bookmark-outline 0.8s 0.15s ease-out forwards,
            bookmark-outline2 3s 0.95s ease-in-out infinite;
        }

        .animated-bookmark-container.active .shadows,
        .animated-bookmark-container.active .shadows2,
        .animated-bookmark-container.active .shadows3,
        .animated-bookmark-container.active .shadows4 {
          animation:
            shadows 0.3s 0.3s ease-in-out forwards,
            shadows2 3s 0.95s ease-in-out infinite;
        }

        /* Inactive State */
        .animated-bookmark-container.inactive {
          --inner-shadow: rgba(0, 0, 0, 0);
          --c-bg-alpha: 0;
        }

        .animated-bookmark-container.inactive .bookmark-inside {
          scale: 1;
          translate: 0;
        }

        .animated-bookmark-container.inactive .bookmark-top,
        .animated-bookmark-container.inactive .bookmark-top-inner {
          animation: bookmark-top-reverse 1s linear forwards;
        }

        .animated-bookmark-container.inactive .bookmark-outline,
        .animated-bookmark-container.inactive .bookmark-top-shadow {
          animation: bookmark-outline-reverse 0.5s ease-in forwards;
        }

        .animated-bookmark-container.inactive .shadows,
        .animated-bookmark-container.inactive .shadows2,
        .animated-bookmark-container.inactive .shadows3,
        .animated-bookmark-container.inactive .shadows4 {
          animation: shadows-reverse 0.6s ease-in-out forwards;
        }

        /* Hover State (when not bookmarked) */
        .animated-bookmark-container.inactive:hover {
          --inner-shadow: rgba(0, 0, 0, 0.15);
          --c-bg-alpha: 0.2;
        }

        .animated-bookmark-container.inactive:hover .bookmark-inside {
          scale: 0.985;
          translate: 0 -0.8px;
        }
      `}</style>

      <div 
        className={`animated-bookmark-container ${isBookmarked ? 'active' : 'inactive'} ${className}`}
        onClick={onClick}
      >
        <div className="shadows2"></div>
        <div className="shadows3"></div>
        <div className="shadows4"></div>
        <div className="shadows"></div>
        <div className="bookmark"></div>
        <div className="bookmark-inside"></div>
        <div className="bookmark-outline"></div>
        <div className="bookmark-top-shadow"></div>
        <div className="bookmark-top"></div>
        <div className="bookmark-top-inner"></div>
      </div>
    </>
  );
};

export default AnimatedBookmark;
