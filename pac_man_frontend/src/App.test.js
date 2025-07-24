import { render, screen } from '@testing-library/react';
import App from './App';

test("renders Pac-Man title", () => {
  render(<App />);
  // Check main title
  const el = screen.getByText(/PAC-MAN.ARCADE/i);
  expect(el).toBeInTheDocument();
});
