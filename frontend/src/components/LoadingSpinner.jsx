const LoadingSpinner = ({ message = "Chargement..." }) => {
  return (
    <div
      style={{
        minHeight: "320px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          background:
            "conic-gradient(from 0deg, transparent 0%, var(--brand-500) 100%)",
          mask: "radial-gradient(circle, transparent 55%, black 56%)",
          WebkitMask: "radial-gradient(circle, transparent 55%, black 56%)",
          animation: "spin 0.85s linear infinite",
        }}
      />
      <p style={{ color: "var(--text-2)", fontSize: "13.5px", fontWeight: 500, margin: 0 }}>
        {message}
      </p>

      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default LoadingSpinner;
