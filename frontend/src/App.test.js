import { render, screen } from "@testing-library/react";
import App from "./App";

// minimal smoke test — adjust text to something App actually renders
test("renders Events heading", () => {
  render(<App />);
  expect(screen.getByText(/events/i)).toBeInTheDocument();
});
