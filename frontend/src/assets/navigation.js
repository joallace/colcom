import { PiFireFill, PiClockFill, PiRankingFill, PiCompassFill } from "react-icons/pi"

// The site's sections, in the navbar's order. `inline` is the breakpoint from which the navbar has
// room for the link beside the logo; every link is also in the sidebar, which smaller screens open
export const NAV_LINKS = [
  { to: "/promoted", label: "promovidos", icon: PiFireFill, inline: "md" },
  { to: "/recent", label: "recentes", icon: PiClockFill, inline: "md" },
  { to: "/podium", label: "pódio", icon: PiRankingFill, inline: "lg" },
  { to: "/meta", label: "meta", icon: PiCompassFill, inline: "lg" }
]
