import {
  Children,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  TablerChevronLeftIcon,
  TablerChevronRightIcon,
} from "../icons/TablerIcons";

type Props = {
  children: ReactNode;
  trackClassName: string;
  ariaLabel: string;
};

export function BrowseRail({ children, trackClassName, ariaLabel }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const itemCount = Children.count(children);

  const refreshScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    setCanScrollBack(track.scrollLeft > 3);
    setCanScrollForward(maxScrollLeft - track.scrollLeft > 3);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const frame = window.requestAnimationFrame(refreshScrollState);
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(refreshScrollState);

    observer?.observe(track);
    window.addEventListener("resize", refreshScrollState);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", refreshScrollState);
    };
  }, [itemCount, refreshScrollState]);

  function scroll(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;

    const amount = Math.max(260, Math.floor(track.clientWidth * 0.86));
    track.scrollBy({ left: direction * amount, behavior: "smooth" });
    window.setTimeout(refreshScrollState, 360);
  }

  return (
    <div className="browse-rail-shell">
      <div
        ref={trackRef}
        className={trackClassName}
        onScroll={refreshScrollState}
        aria-label={ariaLabel}
      >
        {children}
      </div>

      {canScrollBack && (
        <button
          type="button"
          className="browse-rail-arrow browse-rail-arrow-back"
          onClick={() => scroll(-1)}
          aria-label={`Previous ${ariaLabel}`}
        >
          <TablerChevronLeftIcon size={34} />
        </button>
      )}

      {canScrollForward && (
        <button
          type="button"
          className="browse-rail-arrow browse-rail-arrow-forward"
          onClick={() => scroll(1)}
          aria-label={`Next ${ariaLabel}`}
        >
          <TablerChevronRightIcon size={34} />
        </button>
      )}
    </div>
  );
}
