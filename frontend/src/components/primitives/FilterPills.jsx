import { Link } from "react-router"


// Links that narrow a list to one kind of item (the search's and the profile's types), the current one
// highlighted. `options` are `{ value, label }`, `value` undefined for everything; `pathFor(value)`
// is where each one leads.
export default function FilterPills({ options, value, pathFor, label = "mostrar" }) {
  return (
    <div className="filterPills" role="group" aria-label={label}>
      {options.map(option => (
        <Link
          key={option.label}
          to={pathFor(option.value)}
          className={option.value === value ? "active" : undefined}
          aria-current={option.value === value ? "page" : undefined}
        >
          {option.label}
        </Link>
      ))}
    </div>
  )
}
