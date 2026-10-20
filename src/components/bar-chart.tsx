/**
 * Hafif, bağımlılıksız çubuk grafik (SVG). Ekran okuyucular için aynı veri tablo olarak da verilir.
 */
export function BarChart({
  title,
  data,
  color = "fill-indigo-500",
}: {
  title: string;
  data: { label: string; value: number; hint?: string }[];
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = 100 / data.length;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {title}
      </figcaption>
      <svg
        viewBox="0 0 100 44"
        className="h-36 w-full"
        role="img"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        {data.map((d, i) => {
          const h = (d.value / max) * 36;
          return (
            <g key={d.label}>
              <rect
                x={i * barWidth + barWidth * 0.15}
                y={38 - h}
                width={barWidth * 0.7}
                height={Math.max(h, d.value > 0 ? 0.8 : 0)}
                rx={0.8}
                className={color}
              >
                <title>{`${d.hint ?? d.label}: ${d.value}`}</title>
              </rect>
            </g>
          );
        })}
        <line
          x1="0"
          y1="38.2"
          x2="100"
          y2="38.2"
          className="stroke-zinc-300 dark:stroke-zinc-700"
          strokeWidth="0.3"
        />
      </svg>
      <div
        className="grid text-center text-[10px] text-zinc-500 dark:text-zinc-400"
        style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {data.map((d) => (
          <span key={d.label} className="truncate">
            <span className="block font-medium text-zinc-700 dark:text-zinc-300">{d.value}</span>
            {d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.hint ?? d.label}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
