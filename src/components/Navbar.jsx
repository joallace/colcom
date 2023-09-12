import '../assets/sass/navbar.scss'

export default function Navbar() {
  return (
    <nav className="nav">
      <a href="/" className="nav-icon">
        Col.com
      </a>
      <ul>
        <li>
          <a href="/promoted">promovido</a>
        </li>
        <li>
          <a href="/all">todos</a>
        </li>
        <li>
          <a href="/meta">meta</a>
        </li>
      </ul>
    </nav>
  )
}