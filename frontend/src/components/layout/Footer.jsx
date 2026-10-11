import { Link } from "react-router"
import { PiGithubLogoFill, PiPaletteFill, PiRankingFill } from "react-icons/pi"

import useBreakpoint from "@/hooks/useBreakpoint"

export default function Footer() {
    const isLargeScreen = useBreakpoint("lg")

    return (
        <footer>
            <a href="https://github.com/joallace/colcom"><PiGithubLogoFill /> GitHub</a>
            {/* In the navbar on large screens; smaller ones have no room for it there */}
            {!isLargeScreen && <Link to="/podium"><PiRankingFill /> pódio</Link>}
            {/* Also in the user's menu; here for visitors who aren't logged in */}
            <Link to="/settings"><PiPaletteFill /> aparência</Link>
        </footer>
    )
}
