import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

const WHO =
  'Network opens for anyone who can view Network. That is every dashboard role. A sales contractor cannot. The gate says “Your role (…) cannot access Network.” Connection, invite, discover, and pricing saves check that you are a member. They do not check a separate network write role.';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

export const NETWORK_GUIDE: ModuleGuide = {
  id: 'network',
  name: 'Network',
  href: '/dashboard/connections',
  purpose:
    'Network in SupplierAdvisor® is discovery, the connection, the marketplace inquiry, and the price agreement. A quote does not need an accepted connection. A new purchase order is refused when the accepted connection is suspended.',
  roles: ['Owner', 'Admin', 'Member', 'Viewer', 'Finance', 'Operations', 'Sales'],
  outcome: 'You can request a connection, accept one, send an inquiry, and save a price agreement only after the connection is accepted and not suspended.',
  flow: [
    { id: 'find', label: 'Discover', hint: 'In-app request' },
    { id: 'accept', label: 'Accept', hint: 'The recipient' },
    { id: 'price', label: 'Price', hint: 'Accepted only' },
    { id: 'trade', label: 'First trade', hint: 'Other modules' },
  ],
  faqs: [
    {
      q: 'The empty graph says I can quote while the request is pending. Can I raise a purchase order?',
      a: 'A quote does not need the connection to be accepted. A new purchase order is refused when an accepted connection is suspended. A book supplier with no linked company skips that check.',
    },
  ],
  features: [
    feat({
      id: 'graph',
      name: 'Graph',
      href: '/dashboard/connections',
      summary: 'Graph is every company you trade with. Request, accept, then trade. Incoming is a tab, including when the address asks for it.',
      who: WHO,
      prerequisites: ['A company is selected. You cannot connect a company to itself.'],
      steps: [
        'Open Graph. The title is Connections Command.',
        'Press Open to trade, Find companies, or Invite off-platform.',
        'Filter All, Connected, Incoming, Sent, Suppliers, Customers, or Suspended. Search by trading name, city, or industry.',
        'On Pending inbox press Accept or Decline. Open Profile when you need the other company.',
      ],
      behind: [
        'Accept writes the connection accepted and an activity row. It does not post a journal.',
        'Only the recipient can accept or decline. Only the requester can cancel a pending request. Suspend is only on an accepted connection, and it sets the suspended flag rather than a new status.',
      ],
      errors: [
        { message: 'Only the recipient can accept a connection request', fix: 'Switch to the company that received it. The sender cannot accept their own request.' },
        { message: 'Connection is not pending', fix: 'It is already accepted, declined, or cancelled.' },
        { message: 'Only accepted connections can be suspended', fix: 'Accept first. A pending request is declined or cancelled, not suspended.' },
        { message: 'Cannot connect to your own company', fix: 'Pick the other company.' },
      ],
      faqs: [{ q: 'No connections yet. Is the graph broken?', a: 'No. Find a company and send a request. Nothing in this filter means the tab is empty, not that the load failed.' }],
    }),
    feat({
      id: 'discover',
      name: 'Open trade',
      href: '/dashboard/connections/discover',
      summary: 'Open trade ranks discoverable companies and sends an in-app request. The personal note is required.',
      who: WHO,
      prerequisites: ['A company is selected. The page says Select a company first when none is open.'],
      steps: [
        'Open Open trade. The title is Open to trade. Press Refresh.',
        'On a row press Request trade. The note is required. Press Send request.',
      ],
      behind: ['This is the in-app request, not the claim-link invite. It does not post a journal. The list has no separate empty sentence when nobody is ranked.'],
      errors: [
        { message: 'Write a short personal note', fix: 'The note cannot be blank. The dialog says the personal note is required.' },
        { message: 'Select a company first.', fix: 'Choose the company that is requesting.' },
      ],
      faqs: [{ q: 'Is this the same as Invite?', a: 'No. Invite emails a claim link. This screen asks a company that is already on the product.' }],
    }),
    feat({
      id: 'market',
      name: 'Market',
      href: '/dashboard/connections/marketplace',
      summary: 'Market lists products and can send an inquiry. It does not create the purchase order.',
      who: WHO,
      prerequisites: ['Listings come from inventory that was published. An empty market says so.'],
      steps: [
        'Open Market. Search with Search products, SKU, origin…. Filter All, Connected, or Open.',
        'Press Send inquiry and describe the need. Press Sell from inventory or Hire from inventory when you are listing.',
        'The path card points at a purchase order or an invoice afterwards. Those are other screens.',
      ],
      behind: ['The inquiry is stored. Escrow and the purchase order are not created here. No journal is posted.'],
      errors: [
        { message: 'Inquiry failed', fix: 'Stay signed in and send it again. The success line is Inquiry sent — continue the trade path.' },
        { message: 'No listings yet', fix: 'Press List a product, or wait until a partner lists one. The desk does not seed listings.' },
      ],
      faqs: [{ q: 'Does Send inquiry fund escrow?', a: 'No. The path card says to issue the purchase order and collect on the money hub, or fund escrow on that order.' }],
    }),
    feat({
      id: 'price',
      name: 'Price',
      href: '/dashboard/connections/pricing',
      summary: 'Price is a wholesale list for a connected buyer. It is refused until the connection is accepted, and frozen when that connection is suspended.',
      who: WHO,
      prerequisites: ['An accepted connection that is not suspended. Connect companies first when the form says so.'],
      steps: [
        'Open Price. Press New agreement.',
        'Pick the buyer, enter the title, and add a product line with a list price. Press Save & activate.',
        'On I sell, I buy, or Import to catalogue, press Activate, Suspend, Restore, or Import SKUs.',
      ],
      behind: [
        'Activate, suspend, and restore change the agreement status. Import SKUs copies lines into the buyer catalogue.',
        'This is not a payment and not a ledger journal. It is not a public price list.',
      ],
      errors: [
        { message: 'No accepted network connection between these companies. Connect them first in Network.', fix: 'Accept the connection on Graph, then save the agreement.' },
        { message: 'Connection is suspended — pricing agreements are frozen', fix: 'Unsuspend the connection. A suspended edge will not take a new agreement.' },
        { message: 'Add at least one product line with a list price', fix: 'The title and the buyer are not enough. Add a line.' },
        { message: 'Already in your catalogue', fix: 'Import SKUs skips a line you already have.' },
      ],
      faqs: [{ q: 'Can I publish a price with no connection?', a: 'No. Seller and buyer must be different companies, and the accepted connection must exist.' }],
    }),
    feat({
      id: 'invite',
      name: 'Invite',
      href: '/dashboard/invite-business',
      summary: 'Invite emails a claim link. It is not the in-app discover request. The supplier and customer invite screens do the same kind of link.',
      who: WHO,
      prerequisites: ['Business name and contact email are required.'],
      steps: [
        'Open Invite. The title is Invite a company, or supplier or customer when the address says so.',
        'Enter Business / trading name and Contact email. Choose Partner / business, Supplier, or Customer.',
        'Press Send invitation.',
      ],
      behind: [
        'The invite creates the claim link and emails it, or returns the link if the email does not send. The connection is not accepted until they claim it.',
        'No journal is posted. The process picture points the invite step at the supplier and customer invite screens. This sidebar address is the same kind of claim link.',
      ],
      errors: [
        { message: 'Business name and contact email are required', fix: 'Fill both. The toast uses the same sentence.' },
        { message: 'Failed to create invitation. The email may already be registered.', fix: 'Use Request trade if they are already on the product. Do not send a second claim to a registered email.' },
      ],
      faqs: [{ q: 'They never join. Was the invite wasted?', a: 'The supplier copy says they may never join and the invite is still worth sending. You do not get an accepted connection until they claim it.' }],
    }),
    feat({
      id: 'messages',
      name: 'Messages',
      href: '/dashboard/messages',
      summary: 'Messages on Network is the same inbox as Home, without the home back label.',
      who: WHO,
      prerequisites: ['A connection exists before a partner thread can start.'],
      steps: ['Open Messages. Start or reply as on the Home inbox. Full inbox is the wider list when you arrived from a module.'],
      behind: ['The save rules match the Home inbox. A viewer who can open the page can post. No journal is posted.'],
      errors: [{ message: 'Connect a supplier or customer in Network first, then message them here.', fix: 'That is the empty partner picker. Accept a connection, then start the thread.' }],
      faqs: [{ q: 'Is there a second inbox for Network?', a: 'No. It is the same company inbox. Home adds a back link to the command page.' }],
    }),
  ],
};

export const GUIDE_GUIDE: ModuleGuide = {
  id: 'guide',
  name: 'Guide',
  href: '/dashboard/guide',
  purpose:
    'Guide in SupplierAdvisor® is the how-to for every module, plus the system story. Each module page shows who can open it and the process on the real screens. The pages do not write company data.',
  roles: ['Owner', 'Admin', 'Member', 'Viewer', 'Finance', 'Operations', 'Sales'],
  outcome: 'You can open a module how-to from the index or from the first item in that module’s menu. The system story stays under the index.',
  flow: [
    { id: 'start', label: 'Start', hint: 'Every module' },
    { id: 'chapter', label: 'Module', hint: 'Process flow' },
    { id: 'modules', label: 'Modules', hint: 'Show or hide' },
  ],
  faqs: [
    {
      q: 'The training path talks about a Mark done button. Where is it?',
      a: 'The live checklist on Home has no Mark done control. A step is done when the record exists. Dismissal is stored on this browser only.',
    },
  ],
  features: [
    feat({
      id: 'start',
      name: 'Start',
      href: '/dashboard/guide',
      summary: 'Start lists every module how-to, then the system story for the modules this company has switched on.',
      who: 'Guide uses the dashboard gate. A sales contractor cannot open it. The gate says “Your role (…) cannot access Dashboard.”',
      prerequisites: ['A company is selected if you want the handbook list to follow its modules. The how-to index still lists every module. Always-on handbook chapters stay: activation, company, SAM, security, and the action centre.'],
      steps: [
        'Open Guide. The title is How this works. Every module is listed.',
        'Open a module. Read the process flow, then each feature. A training handbook sits under that when the module has one.',
        'The system story under the index still has the master chain. Press Edit modules when a handbook chapter is hidden because the module is off.',
      ],
      behind: [
        'The pages render the how-to and the curriculum. They do not POST. Changing Company → Modules only changes which handbook chapters are listed.',
        'The master chain on the home of the guide is Company, Connect, Buy / Sell, Move, Vertical, Assure, Account, Trust, and Learn.',
        'An old /dashboard/help address redirects to the same module on /dashboard/guide and keeps the feature anchor.',
      ],
      errors: [
        { message: 'Module not found', fix: 'That address is not a chapter. Press Open system guide and pick a module from the list.' },
        { message: 'Module not enabled', fix: 'The handbook chapter names the module. Press Edit modules and turn it on. The how-to page still opens. The product screens stay hidden until the module is on.' },
      ],
      faqs: [{ q: 'A chapter I expected is missing. Did the guide drop it?', a: 'The banner counts hidden handbook chapters. Turn the module on under Company → Modules and the chapter comes back. The how-to index still lists every module.' }],
    }),
  ],
};
