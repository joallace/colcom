export default function Spinner({ size }) {
  return <div className="spinner" style={size && { width: size, height: size }} />
}