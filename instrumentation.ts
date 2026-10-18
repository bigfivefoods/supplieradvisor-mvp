export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { installActivityAfter } = await import('@/lib/business/schedule-after');
    installActivityAfter();
  }
}
