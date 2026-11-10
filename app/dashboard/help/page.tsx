import { permanentRedirect } from 'next/navigation';

export default function HelpIndexPage() {
  permanentRedirect('/dashboard/guide');
}
