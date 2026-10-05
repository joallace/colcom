export default function NoResponse({ children = "ainda não há repostas, que tal contribuir?" }) {
  return (
    <div className="noResponse">
      {children}
    </div>
  )
}