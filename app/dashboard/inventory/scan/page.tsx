'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Loader2,
  PackagePlus,
  ScanLine,
  Keyboard,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ContainerRecord } from '@/lib/containers/types';
import { CompanyRequired, InventoryHeader } from '@/components/inventory/InventoryShell';

type Wh = { id: number; name: string };

/**
 * Best-in-class scan receive: camera QR/barcode → product resolve → stock + pedigree.
 * Uses BarcodeDetector when available; falls back to manual entry.
 */
export default function InventoryScanPage() {
  return (
    <CompanyRequired>
      <ScanInner />
    </CompanyRequired>
  );
}

function ScanInner() {
  const companyId = getSelectedCompanyId()!;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [manual, setManual] = useState('');
  const [qty, setQty] = useState('1');
  const [containers, setContainers] = useState<ContainerRecord[]>([]);
  const [warehouses, setWarehouses] = useState<Wh[]>([]);
  const [containerId, setContainerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);
  const [detectorSupported, setDetectorSupported] = useState(false);
  const scanLock = useRef(false);

  useEffect(() => {
    setDetectorSupported(typeof window !== 'undefined' && 'BarcodeDetector' in window);
  }, []);

  useEffect(() => {
    void Promise.all([
      fetch(`/api/containers?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/inventory/warehouses?companyId=${companyId}`).then((r) => r.json()),
    ]).then(([c, w]) => {
      setContainers(c.containers || []);
      setWarehouses(w.warehouses || []);
    });
  }, [companyId]);

  const processRaw = useCallback(
    async (raw: string, action: 'lookup' | 'receive' = 'receive') => {
      if (!raw.trim() || scanLock.current) return;
      scanLock.current = true;
      setBusy(true);
      try {
        const res = await fetch('/api/inventory/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            raw: raw.trim(),
            action,
            quantity: Number(qty) || 1,
            containerId: containerId ? Number(containerId) : undefined,
            warehouseId: warehouseId ? Number(warehouseId) : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.hint || 'Scan failed');
        setLastResult(data);
        if (action === 'receive') {
          toast.success(
            `Received ${data.received} × ${(data.product as { name?: string })?.name || 'item'}`
          );
        } else {
          toast.success(`Found ${(data.product as { name?: string })?.name}`);
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Scan failed');
      } finally {
        setBusy(false);
        setTimeout(() => {
          scanLock.current = false;
        }, 1500);
      }
    },
    [companyId, qty, containerId, warehouseId]
  );

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreaming(true);
      }
    } catch {
      toast.error('Camera permission denied — use manual entry');
    }
  };

  const stopCamera = () => {
    const v = videoRef.current;
    const stream = v?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    setStreaming(false);
  };

  useEffect(() => {
    if (!streaming || !detectorSupported) return;
    let active = true;
    const BD = (
      window as unknown as {
        BarcodeDetector: new (opts: { formats: string[] }) => {
          detect: (s: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
        };
      }
    ).BarcodeDetector;
    const detector = new BD({
      formats: ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
    });

    const tick = async () => {
      if (!active || !videoRef.current || scanLock.current) {
        requestAnimationFrame(tick);
        return;
      }
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes?.[0]?.rawValue) {
          await processRaw(codes[0].rawValue, 'receive');
        }
      } catch {
        /* ignore frame errors */
      }
      if (active) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(id);
    };
  }, [streaming, detectorSupported, processRaw]);

  useEffect(() => () => stopCamera(), []);

  return (
    <div className="px-2 md:px-4 max-w-3xl mx-auto pb-12">
      <InventoryHeader
        title="Receive"
        description="Scan QR / GS1 barcode to put stock on hand (warehouse or container) with lot/serial pedigree."
      />

      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-xs font-medium">Quantity</label>
          <input
            type="number"
            className="input mt-1 w-full !p-3 !text-sm"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            min={1}
          />
        </div>
        <div>
          <label className="text-xs font-medium">Warehouse (optional)</label>
          <select
            className="input mt-1 w-full !p-3 !text-sm"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">Default location</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Container outlet (optional)</label>
          <select
            className="input mt-1 w-full !p-3 !text-sm"
            value={containerId}
            onChange={(e) => setContainerId(e.target.value)}
          >
            <option value="">Warehouse stock</option>
            {containers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-black rounded-3xl overflow-hidden aspect-[4/3] relative mb-4 border">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        {!streaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 bg-slate-900">
            <ScanLine className="w-12 h-12 mb-3 text-[#00b4d8]" />
            <p className="text-sm mb-4">Camera preview</p>
            <button type="button" onClick={() => void startCamera()} className="btn-primary !py-2.5 !px-5">
              <Camera className="w-4 h-4" /> Start camera
            </button>
            {!detectorSupported && (
              <p className="text-xs text-amber-200 mt-3 px-6 text-center">
                Live barcode detect needs Chrome/Edge. Use manual entry below on other browsers.
              </p>
            )}
          </div>
        )}
        {streaming && (
          <button
            type="button"
            onClick={stopCamera}
            className="absolute top-3 right-3 bg-white/90 text-sm px-3 py-1.5 rounded-full font-medium"
          >
            Stop
          </button>
        )}
        {busy && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-white" />
          </div>
        )}
      </div>

      <div className="bg-white border rounded-3xl p-5 space-y-3 mb-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Keyboard className="w-4 h-4 text-[#00b4d8]" /> Manual / paste scan
        </div>
        <input
          className="input w-full !p-3 !text-sm font-mono"
          placeholder="Paste QR URL, EAN-13, or (01)GTIN(10)LOT…"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void processRaw(manual, 'receive');
          }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void processRaw(manual, 'lookup')}
            className="btn-secondary flex-1 !py-2.5 text-sm"
          >
            Lookup only
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void processRaw(manual, 'receive')}
            className="btn-primary flex-1 !py-2.5 text-sm"
          >
            <PackagePlus className="w-4 h-4" /> Receive
          </button>
        </div>
      </div>

      {lastResult && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-5 text-sm">
          <div className="flex items-center gap-2 font-semibold text-emerald-900 mb-2">
            <CheckCircle2 className="w-4 h-4" /> Last scan
          </div>
          <div className="text-emerald-900">
            {(lastResult.product as { name?: string })?.name} · qty{' '}
            {String(lastResult.received ?? '—')}
          </div>
          {!!lastResult.lot_number && (
            <div className="text-xs text-emerald-800 mt-1">Lot {String(lastResult.lot_number)}</div>
          )}
          {!!lastResult.expiry_date && (
            <div className="text-xs text-emerald-800">Expiry {String(lastResult.expiry_date)}</div>
          )}
          {!!lastResult.onchain_hash && (
            <div className="text-[10px] font-mono mt-2 break-all text-emerald-900/70">
              {String(lastResult.onchain_hash)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
