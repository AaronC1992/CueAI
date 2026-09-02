import DashboardClient from '../../components/DashboardClient';

export const metadata = {
  title: 'SuiteRhythm Sound App',
};

export default function LoginPage() {
  return <DashboardClient user={{ username: 'Sound Creator', plan: 'unlimited', freeAccess: true }} />;
}
