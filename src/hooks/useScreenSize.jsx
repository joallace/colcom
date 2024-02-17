import React from "react"
import { sm, md, lg, xl, xxl } from "@/assets/scss/_export.module.scss"


export default (screenSize = "sm") => {
  const sizes = Object.fromEntries(
    Object.entries({ sm, md, lg, xl, xxl })
      .map(([k, v]) => [k, parseInt(v)])
  )
  const [isDesktop, setDesktop] = React.useState(window.innerWidth > sizes[screenSize])

  const updateMedia = () => { setDesktop(window.innerWidth > sizes[screenSize]) }

  React.useEffect(() => {
    window.addEventListener("resize", updateMedia);
    return () => window.removeEventListener("resize", updateMedia);
  })

  return isDesktop
}