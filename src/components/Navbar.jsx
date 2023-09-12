import '../assets/sass/navbar.scss'

export default function Navbar() {
  return (
    <nav className="nav">
      <div style={{display:'flex'}}>
        <a href="/" className="nav-icon">
          col<text style={{color: 'white'}}>.</text><text style={{color: '#BC5217'}}>com</text>
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
      </div>
      <div style={{gap: "0.75rem"}}>
        <input className="nav-searchbar" placeholder="pesquisar..."/>
        <text style={{fontWeight: "bolder", fontSize: "1.5rem"}}>+</text>
        $42
        <div className="nav-user-icon"/>
      </div>
    </nav>
  )
}