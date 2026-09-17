import { render, screen } from '@testing-library/react'
import App from './App.tsx'

describe('App', () => {
  it('renders the app title', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Ticket App' })).toBeTruthy()
  })
})