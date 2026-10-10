import { Link } from "react-router"
import { PiGithubLogoFill, PiPaletteFill } from "react-icons/pi"

export default function Footer() {
    return (
        <footer>
            <a href="https://github.com/joallace/colcom"><PiGithubLogoFill /> GitHub</a>
            {/* Also in the user's menu; here for visitors who aren't logged in */}
            <Link to="/settings"><PiPaletteFill /> aparência</Link>
        </footer>
    )
}
