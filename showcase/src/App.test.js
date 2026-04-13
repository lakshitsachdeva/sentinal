import { render, screen } from "@testing-library/react"
import App from "./App"

test("renders sentinel title", () => {
  render(<App />)
  expect(screen.getByText(/sentinel/i)).toBeInTheDocument()
})
