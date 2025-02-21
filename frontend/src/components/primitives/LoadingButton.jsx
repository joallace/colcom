export default function LoadingButton({ children, className = "", disabled, isLoading, ...props }) {
  return (
    <button
      className={`loadingButton${isLoading ? " loading" : ""} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      <div className="wrapper">
        <div className="spinnerWrapper">
          <div className="button spinner" />
        </div>
        <div className="children">{children}</div>
      </div>
    </button>
  );
}