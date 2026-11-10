import type { GuideFeature, ModuleGuide } from '@/lib/help/types';
import { gateMessage, viewRoleLabels } from '@/lib/help/roles';

const WHO =
  'Inventory uses the inventory permission. Owner, Admin, Member, and Operations can change stock. Viewer, Finance, and Sales can open the screens. A sales contractor cannot. The gate says “Your role (…) cannot access Inventory.” The stock API checks company membership.';

const GATE = {
  message: gateMessage('inventory'),
  fix: 'Ask an owner for a role that can view Inventory.',
};

function feat(row: GuideFeature): GuideFeature {
  return row;
}

export const INVENTORY_GUIDE: ModuleGuide = {
  id: 'inventory',
  name: 'Inventory',
  href: '/dashboard/inventory',
  purpose:
    'Inventory in SupplierAdvisor® is the catalogue, the locations, and the quantity on hand. You receive, move, and count stock for this company. A purchase order receive lands here as warehouse quantity after Finance has already posted the 1140 journal on accept.',
  roles: viewRoleLabels('inventory'),
  outcome: 'The catalogue exists, stock is received onto a location, moves between locations, and a count posts the quantity on hand.',
  flow: [
    { id: 'catalogue', label: 'Catalogue', hint: 'Products' },
    { id: 'location', label: 'Location', hint: 'Warehouse' },
    { id: 'receive', label: 'Receive', hint: 'Scan or PO' },
    { id: 'hold', label: 'On hand', hint: 'Live stock' },
    { id: 'move', label: 'Move', hint: 'Transfer' },
    { id: 'count', label: 'Count', hint: 'Adjust qty' },
  ],
  faqs: [
    {
      q: 'Stock is empty. What now?',
      a: 'No product or movement has been saved for this company. Add a product, add a location, then receive. SupplierAdvisor® does not load a sample warehouse.',
    },
  ],
  features: [
    feat({
      id: 'products',
      name: 'Catalogue and storefront',
      href: '/dashboard/inventory/products',
      summary: 'Catalog is the product list. Storefront chooses which of those products are offered publicly. Shared SKUs shows items also used by a gym, a shop, or a hire book.',
      who: WHO,
      prerequisites: ['You can open Inventory.'],
      steps: [
        'Open Catalog and add the product. This is the product screen, not a stock filter.',
        'Open Storefront and tick the items that should appear on the public store. Items you leave unticked stay in stock and are not offered there.',
        'Open Shared SKUs when the same item is used by GymAdvisor®, RetailAdvisor®, HireAdvisor®, or a clinic book.',
      ],
      behind: [
        'Adding a product does not receive quantity and does not post 1140. Quantity starts when you receive or when a purchase order is received.',
        'The storefront tick does not change on-hand quantity.',
      ],
      errors: [GATE],
      faqs: [
        {
          q: 'I added a product and on-hand is zero. Is that a failed receive?',
          a: 'No. The catalogue and the quantity are separate. Receive or Receive into stock on the purchase order adds the quantity.',
        },
      ],
    }),
    feat({
      id: 'locations',
      name: 'Locations',
      href: '/dashboard/inventory/warehouses',
      summary: 'Locations are the warehouses and other places stock can sit, including a site tied to a supplier or a customer.',
      who: WHO,
      prerequisites: ['Name the location before you save it.'],
      steps: [
        'Open the locations screen from Inventory overview.',
        'Enter the location name. Add coordinates when you have them.',
        'If the location belongs to a supplier, pick that supplier. If it belongs to a customer, pick that customer.',
      ],
      behind: ['A location with no movements has no quantity. Creating it does not post a journal.'],
      errors: [
        GATE,
        { message: 'Location name required', fix: 'Enter the name, then save.' },
        { message: 'Pick the supplier this location belongs to', fix: 'Choose the supplier when the location is theirs.' },
        { message: 'Pick the customer this location belongs to', fix: 'Choose the customer when the location is theirs.' },
      ],
      faqs: [
        {
          q: 'Can I receive stock with no location?',
          a: 'Receive asks for a location. Add the warehouse first.',
        },
      ],
    }),
    feat({
      id: 'receive',
      name: 'Receive and scan',
      href: '/dashboard/inventory/scan',
      summary: 'Receive scans a code, or you type it, and adds quantity onto a location. Purchase-order receive uses the same stock movement.',
      who: WHO,
      prerequisites: [
        'The product and the location exist.',
        'Finished goods on a purchase order need a lot number before that receive will run.',
      ],
      steps: [
        'Open Receive.',
        'Scan the code, or type it if the camera is refused. The lookup runs first, then the receive.',
        'Enter the quantity and the location. Add a lot when the goods are lotted.',
        'A successful receive confirms the quantity and the product name.',
        'On a purchase order, Receive into stock performs this movement and does not post a second 1140 journal.',
      ],
      behind: [
        'The movement type is receive. On-hand at that location increases by the quantity.',
        'A lot that already has an open or failed inspection can still be received. The response can carry a warning the screen does not show yet.',
        'Receiving the same purchase order again returns “Stock already received from this PO”.',
      ],
      errors: [
        GATE,
        { message: 'Scan failed', fix: 'Try the code again, or type it.' },
        { message: 'Camera permission denied — use manual entry', fix: 'Type the code. The browser blocked the camera.' },
        { message: 'companyId, productId, and quantity required', fix: 'Choose the product and a quantity above zero.' },
        { message: 'Finished goods need a lot number on the PO before receive', fix: 'Add the lot on the purchase-order line, then receive again.' },
        { message: 'PO has no line items', fix: 'Add a line on the purchase order before Receive into stock.' },
      ],
      faqs: [
        {
          q: 'Does a scan post the creditor?',
          a: 'No. The creditor was posted when the purchase order was marked accepted, or when the supplier bill was issued. The scan changes quantity.',
        },
      ],
    }),
    feat({
      id: 'stock',
      name: 'On-hand, lots, transfers, and counts',
      href: '/dashboard/inventory/stock',
      summary: 'Live stock shows quantity by product and location. Lots, transfers, and counts are the movements after receive.',
      who: WHO,
      prerequisites: ['A product and two different locations exist before a transfer. A count needs a product.'],
      steps: [
        'Open Stock and read the quantity by product and location.',
        'Open Lots. A lot needs a product and a lot number.',
        'Open Move. Choose the from location and the to location. They must differ. Add at least one product line and save the transfer.',
        'Open Count. Enter the counted quantity and post it back to on-hand.',
        'Open Report for on-hand, locations, and recent movement, and download the summary from that screen.',
      ],
      behind: [
        'A transfer posts a transfer issue at the source and a transfer receive at the destination. Quantity is conserved.',
        'Shipping a transfer is refused when a line has a lot with an open or failed inspection.',
        'A count posts the difference so on-hand matches what you counted. It does not create a purchase order.',
        'An issue or a sale movement reduces on-hand. Those types are receive, issue, transfer, adjustment, count, and sale.',
      ],
      errors: [
        GATE,
        { message: 'Failed to load live stock', fix: 'Reload Stock. If it persists, confirm the company is selected.' },
        { message: 'Select a product', fix: 'Choose the product on the count or the adjustment.' },
        { message: 'Select from and to locations', fix: 'Pick both locations on the transfer.' },
        { message: 'Locations must differ', fix: 'Choose a different destination.' },
        { message: 'Add at least one product line', fix: 'Add a product and a quantity on the transfer.' },
        { message: 'Product and lot number required', fix: 'Fill both fields before you save the lot.' },
      ],
      faqs: [
        {
          q: 'Will a count post a finance journal?',
          a: 'The count updates on-hand quantity. A value adjustment in the ledger is a journal on Finance if you need the books to change. The count screen itself posts the quantity.',
        },
      ],
    }),
  ],
};
