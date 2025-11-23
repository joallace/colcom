export default ({ children, className, ...props }) => (
  <span className={`focus${className ? (" " + className) : ""}`} {...props}>
    {children}
  </span>
)