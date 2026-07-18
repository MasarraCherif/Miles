import { AlertCircle, X } from "lucide-react";

const ErrorBanner = ({ message, onDismiss }) => {
  return (
    <div
      style={{
        background: "var(--danger-50)",
        color: "var(--danger-600)",
        border: "1px solid #fecaca",
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        marginBottom: "20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <span
        style={{
          fontSize: "13.5px",
          fontWeight: 500,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <AlertCircle size={16} />
        {message}
      </span>

      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--danger-600)",
            cursor: "pointer",
            padding: 4,
            display: "grid",
            placeItems: "center",
            borderRadius: 6,
          }}
          aria-label="Fermer"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default ErrorBanner;
