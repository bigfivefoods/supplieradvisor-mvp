/** Distribution domain — local → global logistics */

export type ShipmentDirection = 'inbound' | 'outbound';
export type ShipmentMode = 'road' | 'rail' | 'ocean' | 'air' | 'multimodal' | 'last_mile';
export type ShipmentStatus =
  | 'planned'
  | 'booked'
  | 'picked_up'
  | 'in_transit'
  | 'at_hub'
  | 'customs'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'cancelled';

export const SHIPMENT_STATUS_META: Record<
  ShipmentStatus,
  { label: string; tone: string; progress: number; pulse?: boolean }
> = {
  planned: { label: 'PLANNED', tone: 'bg-slate-100 text-slate-700 border-slate-200', progress: 5 },
  booked: { label: 'BOOKED', tone: 'bg-sky-50 text-sky-800 border-sky-200', progress: 15 },
  picked_up: { label: 'PICKED UP', tone: 'bg-cyan-50 text-cyan-900 border-cyan-200', progress: 30 },
  in_transit: {
    label: 'IN TRANSIT',
    tone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    progress: 55,
    pulse: true,
  },
  at_hub: { label: 'AT HUB', tone: 'bg-violet-50 text-violet-800 border-violet-200', progress: 70 },
  customs: { label: 'CUSTOMS', tone: 'bg-amber-50 text-amber-900 border-amber-200', progress: 78 },
  out_for_delivery: {
    label: 'OUT FOR DELIVERY',
    tone: 'bg-teal-50 text-teal-800 border-teal-200',
    progress: 90,
    pulse: true,
  },
  delivered: { label: 'DELIVERED', tone: 'bg-emerald-100 text-emerald-900 border-emerald-200', progress: 100 },
  exception: { label: 'EXCEPTION', tone: 'bg-rose-50 text-rose-800 border-rose-200', progress: 50 },
  cancelled: { label: 'CANCELLED', tone: 'bg-neutral-100 text-neutral-500 border-neutral-200', progress: 0 },
};

export const MODE_META: Record<ShipmentMode, { label: string; icon: string }> = {
  road: { label: 'Road', icon: 'Truck' },
  rail: { label: 'Rail', icon: 'Train' },
  ocean: { label: 'Ocean', icon: 'Ship' },
  air: { label: 'Air', icon: 'Plane' },
  multimodal: { label: 'Multimodal', icon: 'Boxes' },
  last_mile: { label: 'Last mile', icon: 'Bike' },
};

export const INCOTERMS_2020 = [
  {
    code: 'EXW',
    name: 'Ex Works',
    group: 'Any mode',
    summary: 'Seller makes goods available at their premises. Buyer bears all cost and risk thereafter.',
    risk: 'Buyer from seller’s door',
  },
  {
    code: 'FCA',
    name: 'Free Carrier',
    group: 'Any mode',
    summary: 'Seller delivers to the carrier nominated by the buyer at a named place.',
    risk: 'Transfers on delivery to carrier',
  },
  {
    code: 'CPT',
    name: 'Carriage Paid To',
    group: 'Any mode',
    summary: 'Seller pays carriage to destination; risk transfers when handed to first carrier.',
    risk: 'Buyer after first carrier',
  },
  {
    code: 'CIP',
    name: 'Carriage and Insurance Paid To',
    group: 'Any mode',
    summary: 'Like CPT plus seller must insure for buyer’s risk.',
    risk: 'Buyer after first carrier (insured)',
  },
  {
    code: 'DAP',
    name: 'Delivered at Place',
    group: 'Any mode',
    summary: 'Seller delivers ready for unloading at named place. Buyer handles import clearance.',
    risk: 'Seller until destination place',
  },
  {
    code: 'DPU',
    name: 'Delivered at Place Unloaded',
    group: 'Any mode',
    summary: 'Seller delivers unloaded at named place. Only Incoterm requiring seller to unload.',
    risk: 'Seller until unloaded',
  },
  {
    code: 'DDP',
    name: 'Delivered Duty Paid',
    group: 'Any mode',
    summary: 'Maximum seller obligation — delivered cleared for import, duties paid.',
    risk: 'Seller until buyer ready to unload',
  },
  {
    code: 'FAS',
    name: 'Free Alongside Ship',
    group: 'Sea / inland waterway',
    summary: 'Seller places goods alongside vessel at named port of shipment.',
    risk: 'Buyer from alongside ship',
  },
  {
    code: 'FOB',
    name: 'Free on Board',
    group: 'Sea / inland waterway',
    summary: 'Seller loads goods on board vessel. Classic ocean trade term.',
    risk: 'Buyer once on board',
  },
  {
    code: 'CFR',
    name: 'Cost and Freight',
    group: 'Sea / inland waterway',
    summary: 'Seller pays freight to destination port; risk transfers on board.',
    risk: 'Buyer from on board',
  },
  {
    code: 'CIF',
    name: 'Cost, Insurance and Freight',
    group: 'Sea / inland waterway',
    summary: 'Like CFR plus minimum insurance by seller.',
    risk: 'Buyer from on board (insured)',
  },
] as const;

export function nextShipmentNumber(seq: number, direction: ShipmentDirection) {
  const y = new Date().getFullYear().toString().slice(-2);
  const prefix = direction === 'inbound' ? 'INB' : 'OUT';
  return `${prefix}-${y}-${String(seq).padStart(5, '0')}`;
}

export function progressForStatus(status: string): number {
  const s = status as ShipmentStatus;
  return SHIPMENT_STATUS_META[s]?.progress ?? 10;
}

export const EVENT_PRESETS: { code: string; label: string; status?: ShipmentStatus }[] = [
  { code: 'booked', label: 'Booking confirmed', status: 'booked' },
  { code: 'picked_up', label: 'Picked up from origin', status: 'picked_up' },
  { code: 'departed', label: 'Departed origin', status: 'in_transit' },
  { code: 'arrived_hub', label: 'Arrived at hub / port', status: 'at_hub' },
  { code: 'customs', label: 'Customs clearance', status: 'customs' },
  { code: 'out_for_delivery', label: 'Out for delivery', status: 'out_for_delivery' },
  { code: 'delivered', label: 'Delivered — POD', status: 'delivered' },
  { code: 'exception', label: 'Exception / delay', status: 'exception' },
  { code: 'note', label: 'Note / update' },
];
