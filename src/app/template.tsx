/** Remontado a cada navegação: aplica a transição curta entre telas. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="screen-enter">{children}</div>;
}
