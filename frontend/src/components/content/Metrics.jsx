export const Author = ({ name, avatar }) => {
  return (
    <span className="startedBy">
      iniciado por <img src={`data:image/png;base64,${avatar}`} /> {name}
    </span>
  )
}
