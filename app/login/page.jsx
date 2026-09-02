import { redirect } from 'next/navigation';

export const metadata = {
  title: 'SuiteRhythm Sound App',
};

export default function LoginPage() {
  redirect('/dashboard');
}
