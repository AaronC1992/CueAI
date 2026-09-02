import DashboardClient from '../../components/DashboardClient';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return <DashboardClient user={{ username: 'Sound Creator', plan: 'unlimited', freeAccess: true }} />;
}
