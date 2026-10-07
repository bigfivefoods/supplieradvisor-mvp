'use client';

export default function FooterYear() {
  return <span suppressHydrationWarning>{new Date().getFullYear()}</span>;
}
