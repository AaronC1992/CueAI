import DashboardClient from '../components/DashboardClient';

export default function Home() {
  return <DashboardClient user={{ username: 'Sound Creator', plan: 'unlimited', freeAccess: true }} />;
}
