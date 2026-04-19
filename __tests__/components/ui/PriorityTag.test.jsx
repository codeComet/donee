import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PriorityTag, { priorityConfig } from '@/components/ui/PriorityTag'

describe('PriorityTag', () => {
  it('renders "Critical" for priority critical', () => {
    render(<PriorityTag priority="critical" />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('renders "High" for priority high', () => {
    render(<PriorityTag priority="high" />)
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('renders "Medium" for priority medium', () => {
    render(<PriorityTag priority="medium" />)
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('renders "Low" for priority low', () => {
    render(<PriorityTag priority="low" />)
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('renders "Lowest" for priority lowest', () => {
    render(<PriorityTag priority="lowest" />)
    expect(screen.getByText('Lowest')).toBeInTheDocument()
  })

  it('returns null for unknown priority', () => {
    const { container } = render(<PriorityTag priority="unknown" />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when priority is undefined', () => {
    const { container } = render(<PriorityTag />)
    expect(container.firstChild).toBeNull()
  })

  it('renders all 5 priorities without error', () => {
    const priorities = Object.keys(priorityConfig)
    expect(priorities).toHaveLength(5)
    priorities.forEach((priority) => {
      const { container } = render(<PriorityTag priority={priority} />)
      expect(container.firstChild).not.toBeNull()
    })
  })

  it('applies extra className', () => {
    const { container } = render(<PriorityTag priority="high" className="my-class" />)
    expect(container.firstChild).toHaveClass('my-class')
  })
})
