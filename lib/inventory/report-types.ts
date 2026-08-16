export type InventoryReportLine = {
  id: number;
  name: string;
  sku?: string | null;
  uom?: string | null;
  product_type?: string | null;
  qty: number;
  reserved: number;
  available: number;
  reorder_level: number;
  is_low: boolean;
  cost_price: number;
  sell_price: number;
  value_cost: number;
  value_sell: number;
  locations: number;
  in_transit: number;
};

export type InventoryLocationLine = {
  warehouse_id: number | null;
  name: string;
  code?: string | null;
  owner_type?: string | null;
  city?: string | null;
  units: number;
  reserved: number;
  available: number;
  skus: number;
  low_stock: number;
  in_transit_inbound: number;
};

export type InventoryLotAlert = {
  id: number;
  lot_number: string;
  product_name: string | null;
  expiry_date: string;
  qty_on_hand: number;
  days: number;
  expired: boolean;
};

export type InventoryMovementPulse = {
  receive: number;
  issue: number;
  transfer: number;
  adjustment: number;
  count: number;
  other: number;
  total: number;
};

export type InventoryReportPack = {
  companyName: string;
  currency: string;
  asOf: string;
  summary: {
    products: number;
    productsActive: number;
    rawMaterials: number;
    finishedGoods: number;
    warehouses: number;
    locationsWithStock: number;
    stockLines: number;
    skusWithStock: number;
    unitsOnHand: number;
    unitsReserved: number;
    unitsAvailable: number;
    unitsInTransit: number;
    inTransitLines: number;
    containerUnits: number;
    networkUnits: number;
    valueAtCost: number;
    valueAtSell: number;
    lowStockSkus: number;
    outOfStockSkus: number;
    coverDays: number | null;
    issues30d: number;
    lots: number;
    lotsExpiring30: number;
    lotsExpired: number;
    serials: number;
    onchainReady: number;
    openTransfers: number;
  };
  typeMix: { key: string; label: string; units: number; value_cost: number }[];
  ownerMix: { key: string; label: string; units: number }[];
  locations: InventoryLocationLine[];
  topSkus: InventoryReportLine[];
  lowStock: InventoryReportLine[];
  expiringLots: InventoryLotAlert[];
  movements30d: InventoryMovementPulse;
};
