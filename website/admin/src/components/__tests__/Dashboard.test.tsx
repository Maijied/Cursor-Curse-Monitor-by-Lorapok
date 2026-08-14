import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import DashboardLayout from '../Dashboard';

// Mock Firebase and API
vi.mock('../../lib/firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn(),
    currentUser: { email: 'mdshuvo40@gmail.com' }
  },
  db: {}
}));

vi.mock('../../lib/api', () => ({
  fetchTags: vi.fn().mockResolvedValue({ tags: ['v1.0.0'] }),
  triggerDeployment: vi.fn()
}));

describe('Dashboard Component', () => {
  it('renders sidebar navigation items', () => {
    render(
      <MemoryRouter>
        <DashboardLayout />
      </MemoryRouter>
    );

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Deployments')).toBeInTheDocument();
    expect(screen.getByText('Team Access')).toBeInTheDocument();
  });

  it('shows the user email in the sidebar', () => {
    render(
      <MemoryRouter>
        <DashboardLayout />
      </MemoryRouter>
    );
    expect(screen.getByText('mdshuvo40@gmail.com')).toBeInTheDocument();
  });
});
