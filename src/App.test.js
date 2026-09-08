import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the sign-in page', () => {
  render(<App />);
  expect(screen.getByText(/custom aram lobby maker/i)).toBeInTheDocument();
});
