import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusTag, { statusConfig } from '@/components/ui/StatusTag'

describe('StatusTag', () => {
  it('renders "Backlog" for status backlog', () => {
    render(<StatusTag status="backlog" />)
    expect(screen.getByText('Backlog')).toBeInTheDocument()
  })

  it('renders "In Progress" for status in_progress', () => {
    render(<StatusTag status="in_progress" />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('renders "Done" for status done', () => {
    render(<StatusTag status="done" />)
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('renders "Waiting Confirm." for waiting_for_confirmation', () => {
    render(<StatusTag status="waiting_for_confirmation" />)
    expect(screen.getByText('Waiting Confirm.')).toBeInTheDocument()
  })

  it('returns null for an unknown status', () => {
    const { container } = render(<StatusTag status="unknown_status" />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when status is undefined', () => {
    const { container } = render(<StatusTag />)
    expect(container.firstChild).toBeNull()
  })

  it('renders all 8 statuses without error', () => {
    const statuses = Object.keys(statusConfig)
    expect(statuses).toHaveLength(8)
    statuses.forEach((status) => {
      const { container } = render(<StatusTag status={status} />)
      expect(container.firstChild).not.toBeNull()
    })
  })

  it('applies extra className', () => {
    const { container } = render(<StatusTag status="done" className="extra-class" />)
    expect(container.firstChild).toHaveClass('extra-class')
  })
})
