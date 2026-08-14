import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import DashboardLayout from '../Dashboard';

vi.mock('../../lib/firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn((cb) => {
      cb({ email: 'mdshuvo40@gmail.com' });
      return vi.fn();
    }),
    currentUser: { email: 'mdshuvo40@gmail.com', getIdToken: vi.fn().mockResolvedValue('token') },
    signOut: vi.fn(),
  },
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn((_ref, onNext) => {
    onNext({ exists: () => false });
    return vi.fn();
  }),
}));

vi.mock('../../lib/api', () => ({
  fetchTags: vi.fn().mockResolvedValue({ tags: ['v1.0.0'] }),
  triggerDeployment: vi.fn(),
}));

vi.mock('../../hooks/useSiteData', () => ({
  useSiteData: vi.fn().mockReturnValue({
    data: {
      generatedAt: new Date().toISOString(),
      version: '0.5.4',
      packageVersion: '0.5.4',
      syncStatus: 'synced',
      downloads: {
        total: 930,
        breakdown: {
          openVsxCanonical: 866,
          openVsxDuplicate: 622,
          vscodeMarketplace: 61,
          githubVsix: 3,
          latestReleaseVsix: 1,
        },
      },
      visitors: {
        websiteVisits: 0,
        packageClicks: { ovsx: 0, vscode: 0, github: 0, vsix: 0 },
        totalEngagement: 0,
        updatedAt: null,
      },
      ovsx: { version: '0.5.4', url: 'https://open-vsx.org', downloadCount: 866 },
      vscode: { version: '0.5.4', installCount: 61, downloadCount: 61, url: 'https://marketplace.visualstudio.com' },
      github: { releaseTag: 'v0.5.4', releaseUrl: 'https://github.com', publishedAt: null, totalReleaseDownloads: 3 },
    },
    error: null,
    loading: false,
    refresh: vi.fn(),
  }),
}));

function renderDashboard(path = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard/*" element={<DashboardLayout />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Dashboard Component', () => {
  it('renders sidebar navigation items', () => {
    renderDashboard();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Community')).toBeInTheDocument();
    expect(screen.getByText('Deployments')).toBeInTheDocument();
    expect(screen.getByText('Team Access')).toBeInTheDocument();
  });

  it('shows the user email in the sidebar', () => {
    renderDashboard();
    expect(screen.getByText('mdshuvo40@gmail.com')).toBeInTheDocument();
  });

  it('renders overview KPIs from site data', () => {
    renderDashboard('/dashboard');
    expect(screen.getByRole('heading', { name: 'Mission Control' })).toBeInTheDocument();
    expect(screen.getAllByText('Total Downloads').length).toBeGreaterThan(0);
    expect(screen.getAllByText('930').length).toBeGreaterThan(0);
  });
});
