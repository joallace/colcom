import React from "react"
import { screenSm } from "@/assets/scss/_export.module.scss"

export default () => {
  const smScreenSize = parseInt(screenSm)

  const [isDesktop, setDesktop] = React.useState(window.innerWidth > smScreenSize)

  const updateMedia = () => { setDesktop(window.innerWidth > smScreenSize) }

  React.useEffect(() => {
    window.addEventListener("resize", updateMedia);
    return () => window.removeEventListener("resize", updateMedia);
  })

  return isDesktop
}