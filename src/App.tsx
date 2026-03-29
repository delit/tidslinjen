import { ChronosApp } from "./ChronosApp";
import { ChronosGameProvider } from "./ChronosGameContext";

export default function App() {
  return (
    <ChronosGameProvider>
      <ChronosApp />
    </ChronosGameProvider>
  );
}
