import { Link } from "react-router"

import { tagPath } from "@/assets/tags"


// A tag, linking to its topics. Provisional tags (not yet used by enough topics) are dashed, a reserved
// one (applied by the instance only) is solid, and the viewer's own vote tints it: green when endorsed,
// red when contested. `to` overrides the link (a tag
// page's pills add or remove the tag from the set); `children` go after the name.
export default function TagPill({ slug, name, provisional = false, reserved = false, visible = true, userVote, to, title, children }) {
  const classes = [
    "tagPill",
    provisional && "provisional",
    reserved && "reserved",
    !visible && "hiddenTag",
    userVote === 1 && "endorsed",
    userVote === -1 && "contested"
  ].filter(Boolean).join(" ")

  return (
    <Link to={to ?? tagPath([slug])} className={classes} title={title ?? (provisional ? `${name} (tag nova, provisória)` : reserved ? `${name} (tag reservada)` : name)}>
      {name}
      {children}
    </Link>
  )
}
