'use client'

import Link from 'next/link'

export default function InventoryHub() {
  // Mock data for KPIs
  const rawMaterialsCount = 1245
  const finishedGoodsCount = 892
  const avgDailySales = 48
  const stockTurn = finishedGoodsCount > 0 ? (finishedGoodsCount / avgDailySales).toFixed(1) : '0.0'

  return (
    <div style={{ marginLeft: '25px', marginRight: '25px' }}>

      {/* BREADCRUMB */}
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard" style={{ color: '#10b981', textDecoration: 'none', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ← Back to Dashboard
        </Link>
        <div style={{ color: '#666' }}>/</div>
        <span style={{ color: '#aaa', fontSize: '18px' }}>Inventory</span>
      </div>

      <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', marginBottom: '50px' }}>
        Inventory Management
      </h3>

      {/* ====================== SECTION 1: INVENTORY KPIs ====================== */}
      <h4 style={{ fontSize: '24px', color: '#fff', marginBottom: '24px' }}>Inventory KPIs</h4>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '70px' }}>
        
        {/* STOCK TURN CARD - IDENTICAL SIZE */}
        <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '40px', borderRadius: '28px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid #10b981', height: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔄</div>
          <div style={{ fontSize: '22px', color: '#10b981', fontWeight: 'bold', marginBottom: '8px' }}>Stock Turn</div>
          <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff' }}>{stockTurn}x</div>
          <div style={{ color: '#666', fontSize: '16px' }}>(Finished Goods ÷ Avg Daily Sales)</div>
        </div>

        {/* STOCK TAKE ACCURACY CARD - IDENTICAL SIZE */}
        <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '40px', borderRadius: '28px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid #10b981', height: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📊</div>
          <div style={{ fontSize: '22px', color: '#10b981', fontWeight: 'bold', marginBottom: '8px' }}>Stock Take Accuracy</div>
          <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff' }}>98.4%</div>
          <div style={{ color: '#666', fontSize: '16px' }}>Last stock take</div>
        </div>

      </div>

      {/* ====================== SECTION 2: INVENTORY MANAGEMENT ====================== */}
      <h4 style={{ fontSize: '24px', color: '#fff', marginBottom: '24px' }}>Inventory Management</h4>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '32px' }}>
        
        {/* RAW MATERIALS */}
        <Link href="/dashboard/inventory/raw-materials" style={{ textDecoration: 'none' }}>
          <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '40px', borderRadius: '28px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid #222', height: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📦</div>
            <div style={{ fontSize: '22px', color: '#10b981', fontWeight: 'bold', marginBottom: '8px' }}>Raw Materials</div>
            <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff' }}>{rawMaterialsCount}</div>
            <div style={{ color: '#666', fontSize: '16px' }}>units in stock</div>
          </div>
        </Link>

        {/* FINISHED GOODS */}
        <Link href="/dashboard/inventory/finished-goods" style={{ textDecoration: 'none' }}>
          <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '40px', borderRadius: '28px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid #222', height: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🏭</div>
            <div style={{ fontSize: '22px', color: '#10b981', fontWeight: 'bold', marginBottom: '8px' }}>Finished Goods</div>
            <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff' }}>{finishedGoodsCount}</div>
            <div style={{ color: '#666', fontSize: '16px' }}>units ready for sale</div>
          </div>
        </Link>

        {/* TRANSFER INVENTORY */}
        <Link href="/dashboard/inventory/transfer" style={{ textDecoration: 'none' }}>
          <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '40px', borderRadius: '28px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid #222', height: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔄</div>
            <div style={{ fontSize: '22px', color: '#10b981', fontWeight: 'bold', marginBottom: '8px' }}>Transfer Inventory</div>
            <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff' }}>Instant</div>
            <div style={{ color: '#666', fontSize: '16px' }}>Move between warehouses & containers</div>
          </div>
        </Link>

        {/* STOCK TAKE */}
        <Link href="/dashboard/inventory/stock-take" style={{ textDecoration: 'none' }}>
          <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '40px', borderRadius: '28px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid #222', height: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📋</div>
            <div style={{ fontSize: '22px', color: '#10b981', fontWeight: 'bold', marginBottom: '8px' }}>Stock Take</div>
            <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff' }}>Daily</div>
            <div style={{ color: '#666', fontSize: '16px' }}>Perform counts & reconcile</div>
          </div>
        </Link>

      </div>
    </div>
  )
}