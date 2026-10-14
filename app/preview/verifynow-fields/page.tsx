import type { Metadata } from 'next';
import PreviewBoard from './PreviewBoard';

export const metadata: Metadata = {
  title: 'VerifyNow field preview',
  robots: { index: false, follow: false },
};

/** Review preview of the company-profile VerifyNow buttons and badges. Not linked from the product. */
export default function VerifyNowFieldPreviewPage() {
  return <PreviewBoard />;
}
