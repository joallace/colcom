export default function Focus({ children, className, ...props }) {
  return (
    <span className={`focus${className ? (" " + className) : ""}`} {...props}>
      {children}
    </span>
  )
}