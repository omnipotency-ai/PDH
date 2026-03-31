import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const scrollContainer = document.getElementById("landing-scroll");
    if (!scrollContainer) return;

    function onScroll() {
      setVisible((scrollContainer?.scrollTop ?? 0) > 800);
    }

    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", onScroll);
  }, []);

  function scrollToTop() {
    const scrollContainer = document.getElementById("landing-scroll");
    scrollContainer?.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!visible) return null;

  return createPortal(
    <button
      type="button"
      onClick={scrollToTop}
      className="fixed right-4 bottom-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-[#2dd4bf]/30 bg-[rgba(4,9,27,0.85)] text-[#2dd4bf] backdrop-blur-xl transition-all hover:border-[#2dd4bf] hover:bg-[#2dd4bf] hover:text-[#080c14]"
      aria-label="Back to top"
    >
      <ArrowUp className="h-5 w-5" />
    </button>,
    document.body,
  );
}
