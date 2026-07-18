import { Line } from "react-chartjs-2";

const Sparkline = ({ data, color = "#8fb339", height = 40 }) => {
  const chartData = {
    labels: data.map((_, i) => i),
    datasets: [
      {
        data,
        borderColor: color,
        backgroundColor: (ctx) => {
          const { chart } = ctx;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return "rgba(143,179,57,0.15)";
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          const rgb = hexToRgb(color);
          g.addColorStop(0, `rgba(${rgb}, 0.30)`);
          g.addColorStop(1, `rgba(${rgb}, 0)`);
          return g;
        },
        borderWidth: 1.8,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 0,
      },
    ],
  };

  const options = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false, grid: { display: false } },
      y: { display: false, grid: { display: false } },
    },
    elements: { line: { borderJoinStyle: "round" } },
    animation: { duration: 600 },
  };

  return (
    <div style={{ height, width: "100%" }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r}, ${g}, ${b}`;
}

export default Sparkline;
