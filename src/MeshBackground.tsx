export function MeshBackground() {
  return (
    <div
      className="mesh-background-root pointer-events-none"
      aria-hidden="true"
    >
      <div className="mesh-gradient" />
      <div className="orb bg-blue-500 w-[500px] h-[500px] -top-40 -left-40 animate-drift" />
      <div
        className="orb bg-purple-600 w-[400px] h-[400px] bottom-0 -right-20 animate-drift"
        style={{ animationDelay: "-5s" }}
      />
    </div>
  );
}
