export default function Home() {
  return (
    <div>
      <h1 style={{ fontSize: '64px', fontWeight: '900', marginBottom: '40px' }}>Operations Overview</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        {[
          { label: 'Active POs', value: '12', icon: '📦' },
          { label: 'Avg Rating', value: '4.98', icon: '⭐' },
          { label: 'New Connections', value: '7', icon: '🔗' },
          { label: 'Revenue This Month', value: 'R 248k', icon: '📈' },
        ].map((stat, i) => (
          <div key={i} style={{ background: '#111', padding: '40px', borderRadius: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '60px', marginBottom: '16px' }}>{stat.icon}</div>
            <div style={{ fontSize: '56px', fontWeight: '900', color: '#10b981' }}>{stat.value}</div>
            <div style={{ fontSize: '22px', color: '#888' }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}