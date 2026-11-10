import type { GuideFeature, ModuleGuide } from '@/lib/help/types';

/**
 * Physio, dental, psychiatry, medical, and vet share the clinic desks.
 * Differences are the nouns and the screens that exist on only one of them.
 * Claims submit to a sandbox or a paper pack. Live MediKredit is refused.
 * A package save does not post the ledger. Add to account on Accounts does.
 */
const WHO =
  'These desks open for anyone who can view Operations. On the default matrix that is Owner, Admin, Member, Viewer, Finance, Operations, and Sales. A sales contractor cannot. The gate says “Your role (…) cannot access Operations.” The clinic save routes check that you are an active member. They do not check a separate write role. If the company has switched the module off, the page names that module id and says to enable it under Company → Profile → Modules.';

type ClinicSpec = {
  id: string;
  name: string;
  href: string;
  purpose: string;
  command: string;
  today: string;
  recalls: string;
  demoButton: string;
  demoToast: string;
  peopleName: string;
  peopleHref: string;
  peopleScreen: string;
  peopleNoun: string;
  patientSidebar: string;
  patientHref: string;
  movements?: boolean;
  tasks?: boolean;
  roomsNoun: string;
  bookExtra: string;
  claimSidebar: string;
  accountSidebar: string;
  accountKind: string;
  commsSidebar: string;
  portalSidebar: string;
  outcomes: string;
};

function feat(row: GuideFeature): GuideFeature {
  return row;
}

function clinicFeatures(spec: ClinicSpec): GuideFeature[] {
  const features: GuideFeature[] = [
    feat({
      id: 'command',
      name: 'Command',
      href: spec.href,
      summary: spec.command,
      who: WHO,
      prerequisites: ['A company is selected.', 'The module is switched on for this company.'],
      steps: [
        `Open Command. Use Diary and Website in the header.`,
        `Read ${spec.today} and press Attended, No-show, or Cancel on a row that is already a visit. An empty slot says to open the diary.`,
        'Press Send 24h reminders or Refresh on the outcomes panel.',
        `Off production, ${spec.demoButton} is on the page. Production refuses it.`,
      ],
      behind: [
        'Attended, No-show, and Cancel call mark attendance. They do not post a finance journal by themselves.',
        `The server answer on a production sample load is “SupplierAdvisor® does not load a sample book on production.”`,
        'Send 24h reminders uses the reminder action. A failure falls back to Reminders failed.',
      ],
      errors: [
        { message: 'SupplierAdvisor® does not load a sample book on production.', fix: 'Add practitioners and patients yourself. The sample button is refused in production.' },
        { message: 'Open diary to book a patient into this slot', fix: 'That row is an empty diary slot. Open Calendar and schedule the visit.' },
        { message: 'Your role (…) cannot access Operations.', fix: 'Ask an owner for a role that can view Operations.' },
      ],
      faqs: [
        { q: 'Does the command board create an invoice?', a: 'No. Charges are raised on Accounts. The board marks attendance and can send reminders.' },
      ],
    }),
    feat({
      id: 'people',
      name: spec.peopleName,
      href: `${spec.href}${spec.peopleHref}`,
      summary: `${spec.peopleScreen} is the person register. A save also syncs the person to the People directory.`,
      who: WHO,
      prerequisites: ['Name is required. A login email is required before they can sign in to the app.'],
      steps: [
        `Open ${spec.peopleName}.`,
        `Enter the name, the login email, and a discipline or role from the list on the form. Set the rate basis: hourly, per session, per appointment, monthly, fixed, or package.`,
        'Press Save practitioner details, or the staff equivalent on the dental screen. Press Save dates & rate for the engagement.',
        'Copy the clinician diary link or the staff-today link when you want them on a phone. The toasts say the link was copied.',
      ],
      behind: [
        spec.id === 'physiograph'
          ? 'Only PhysioAdvisor® blocks a diary series when the person is on leave or away. The other four desks do not call that check.'
          : 'This desk does not block a booking when the person is on leave. That check runs on PhysioAdvisor® only.',
        'Ending an engagement keeps the history. Rehire starts a new engagement and keeps the old one.',
        'No finance journal is posted by saving the person.',
      ],
      errors: [
        { message: 'Name required', fix: 'Enter the name before you save.' },
        { message: 'Login email required — they use this to sign in and use the app', fix: 'Add the email they will use in the app.' },
        { message: 'End date cannot be before start date', fix: 'Put the end on or after the start.' },
        { message: 'Contractor share must be between 0 and 100', fix: 'Enter a share from 0 to 100, or leave the commercial fields as numbers.' },
        spec.id === 'physiograph'
          ? { message: 'Practitioner On leave …', fix: 'The series is refused with “Practitioner” plus “On leave” and the dates, or “is away” and the day. Pick another practitioner or another day.' }
          : spec.id === 'dentalgraph'
            ? { message: 'Staff not found', fix: 'Reload Staff. The schedule also says staff_id required and Clinician not found.' }
            : { message: 'Practitioner not found', fix: 'Reload the register. The row is not on this company.' },
      ],
      faqs: [
        { q: 'Where do the disciplines come from?', a: 'The form lists the disciplines stored for this desk. You can add a skill on the catalogue, and you cannot invent one by typing it into a free field that the list does not save.' },
      ],
    }),
    feat({
      id: 'patients',
      name: spec.patientSidebar,
      href: `${spec.href}${spec.patientHref}`,
      summary:
        spec.id === 'vetgraph'
          ? 'The sidebar says Clients. The screen title is still Patients. There is no animals table on this desk. Family members are people, and the client app copy is what mentions pets.'
          : 'Patients is the register, the chart, the portal link, and the invite.',
      who: WHO,
      prerequisites: ['Name is required. POPIA consent is required before the record is created.'],
      steps: [
        `Open ${spec.patientSidebar}. The screen title is Patients.`,
        'Enter Code, Name, Email, Phone, Emergency contact, and Desk notes. Press Add patient or Save profile.',
        'Press Edit on a row, then Done to lock the list fields. Open the chart for the medical record.',
        spec.id === 'vetgraph'
          ? 'Copy the client portal link. The toast says they can book open diary slots.'
          : 'Copy the patient portal link, or send the email invite when an email is on the profile.',
      ],
      behind: [
        'The chart holds demographics, medical aid, attachments, and scheme submissions. PhysioAdvisor® labels the script section Rehab programmes. The other four label it Scripts & prescriptions.',
        spec.id === 'vetgraph'
          ? 'VetAdvisor® does not store a species or a pet register on this desk. The client app copy says My animals and Pets. The desk family block is still family members.'
          : 'A portal invite needs an email. The API says a valid email is required.',
        'Saving the person does not post a journal. Book next on the treatment plan opens a diary slot. It does not raise the charge.',
      ],
      errors: [
        { message: 'Confirm POPIA consent before creating the patient record', fix: 'Tick the consent before the first save.' },
        { message: 'Name required', fix: 'Enter the name.' },
        { message: 'Add an email on the patient profile before inviting', fix: 'Save an email, then send the invite. Vet and some desks still say Patient not found when the row is missing.' },
      ],
      faqs: [
        {
          q: spec.id === 'vetgraph' ? 'Where do I add the animal?' : 'Where is the medical aid?',
          a: spec.id === 'vetgraph'
            ? 'Not on this register. There is no animals field in the vet store. The client app copy talks about pets. The desk record is the client.'
            : 'On the chart, under Medical aid. If none is stored the helper says No medical aid on file.',
        },
      ],
    }),
    feat({
      id: 'services',
      name: 'Services',
      href: `${spec.href}/services`,
      summary: 'Services is the catalogue of duration and price. The sidebar sentence and the screen sentence are not the same list of treatments.',
      who: WHO,
      prerequisites: ['Name is required.'],
      steps: [
        'Open Services. Press Add service.',
        'Enter Code, Name, Duration (min), Price ZAR, and Description. Press Save.',
      ],
      behind: ['The row is the catalogue. It does not create an invoice and it does not post a journal. The screen description is assessments, treatment sessions, and home visits, even when the sidebar names a narrower list.'],
      errors: [
        { message: 'Name required', fix: 'Enter the service name.' },
        { message: 'Service not found', fix: 'Reload. The row was not on this company.' },
      ],
      faqs: [{ q: 'Does a price here bill the patient?', a: 'No. Accounts raises the charge. The service price is what the diary and the charge can use.' }],
    }),
    feat({
      id: 'packages',
      name: 'Packages',
      href: `${spec.href}/packages`,
      summary: 'Packages stores a code, a name, a session count, and a price. Saving one does not post accounts receivable.',
      who: WHO,
      prerequisites: ['Name is required. Sessions default to 6 if you leave them.'],
      steps: ['Open Packages. Press Add package. Enter Code, Name, the sessions, Price ZAR, and Description. Press Save.'],
      behind: [
        'Package saved writes the package only.',
        'The process note that says a package posts AR, revenue, and VAT is not what this screen does. That posting runs from Add to account on Accounts.',
      ],
      errors: [{ message: 'Name required', fix: 'Enter the package name.' }],
      faqs: [{ q: 'The accent says rehab packs or care plans. Is the form different?', a: 'No. The form is the same. The accent is the only label that changes.' }],
    }),
    feat({
      id: 'rooms',
      name: 'Rooms',
      href: `${spec.href}/rooms`,
      summary: `Rooms adds a consult room, an asset, and an optional assignment to a ${spec.roomsNoun}.`,
      who: WHO,
      prerequisites: ['Close any room you are already editing before you add another.'],
      steps: [
        'Open Rooms. Press Add a room. Enter Name. Notes are optional. Assign a person or leave it empty so anyone can use it. Press Add room.',
        'Add an asset with New asset name and Add asset.',
      ],
      behind: [
        'The diary uses the room name. A second booking in the same room at the same time is refused with the room already booked message.',
        spec.id === 'vetgraph'
          ? 'The VetAdvisor® sidebar says assign vets. The rooms page still says medical advisor. That is the label on the screen.'
          : 'The assignment label uses the noun on this desk.',
      ],
      errors: [
        { message: 'Room name required', fix: 'Enter a name. Surgery 1 is only the placeholder.' },
        { message: 'A room with that name already exists', fix: 'Use a different name or edit the existing room.' },
        { message: 'Room “…” is already booked at …', fix: 'Pick another room or another time. The code is ROOM_DOUBLE_BOOK.' },
      ],
      faqs: [{ q: 'Can two people use one room at once?', a: 'Not on the diary. The clash check refuses the second booking.' }],
    }),
  ];

  if (spec.movements) {
    features.push(
      feat({
        id: 'movements',
        name: 'Movements',
        href: `${spec.href}/movements`,
        summary: 'Movements is the PhysioAdvisor® rehab library. The other clinic desks do not have this screen.',
        who: WHO,
        prerequisites: ['Name is required. A catalogue movement cannot be deleted.'],
        steps: [
          'Open Movements. Press Add a clinic movement.',
          'Enter Name. Equipment, Muscles / tissues, the client-facing overview, and coaching cues are optional. Press Add movement.',
          'Share a movement from a visit. Bookings links to Rehab on the patient chart.',
        ],
        behind: ['A clinic-added movement is stored for this practice. Catalogue rows stay. No journal is posted.'],
        errors: [
          { message: 'Catalog movements cannot be deleted', fix: 'Remove a movement you added. The shared catalogue stays.' },
          { message: 'Name required', fix: 'Enter the movement name.' },
        ],
        faqs: [{ q: 'Is this the gym exercise list?', a: 'It starts from that catalogue and adds rehab categories. Sharing sends it to the client app from a visit.' }],
      })
    );
  }

  features.push(
    feat({
      id: 'calendar',
      name: 'Calendar',
      href: `${spec.href}/calendar`,
      summary: 'Calendar is the diary. A slot is either an appointment or personal time. Personal time cannot be booked.',
      who: WHO,
      prerequisites: ['A company is selected. Working hours can be saved for the practice.'],
      steps: [
        'Open Calendar. Press + New appointment, or click an empty time.',
        'The peek is Schedule appointment or Open appointment. Tick Public slot if the public book may offer it. Tick the personal option for Block own time / leave.',
        'Press Schedule, or Schedule series when the repeat is not none. On an existing slot press Save changes or Delete appointment.',
        'Press Download practice PDF when you need the paper diary. Save working hours from the hours section.',
      ],
      behind: [
        'A clinician who is already booked in that window is refused. The code is CLINICIAN_DOUBLE_BOOK.',
        'A personal or leave slot cannot be booked by a patient.',
        spec.id === 'physiograph'
          ? 'PhysioAdvisor® also refuses the series when that practitioner is on leave or away.'
          : 'This desk does not apply the leave block. PhysioAdvisor® does.',
        'Scheduling does not post a journal.',
      ],
      errors: [
        { message: 'This clinician is already booked … Choose another time or another clinician.', fix: 'Move the time or pick another person.' },
        { message: 'This slot is personal / leave time and cannot be booked by a patient', fix: 'Use an open appointment slot, or clear the personal block.' },
        { message: 'Could not schedule any appointments (conflicts)', fix: 'The series hit a clash on every date. Change the repeat or the time.' },
      ],
      faqs: [{ q: 'Does Publish on the website make every slot public?', a: 'No. Tick Public slot on the appointment. Online booking also has its own switch.' }],
    }),
    feat({
      id: 'bookings',
      name: 'Bookings',
      href: `${spec.href}/bookings`,
      summary: `Bookings is the front desk. ${spec.bookExtra}`,
      who: WHO,
      prerequisites: ['An appointment and a patient are both required. The form title is Book patient on every desk, including VetAdvisor®.'],
      steps: [
        'Open Bookings. Read Open bookings, Waitlist queue, Slot waitlists, and Feedback pending.',
        'Choose Appointment and Patient. A family member can be Attendee: account holder or a child. Save the booking.',
        'Press Attended or No-show. Attended can copy a feedback link.',
        'On the waitlist, press Contacted, Booked, Remove, or Book in.',
      ],
      behind: [
        'Stored booking statuses are booked, waitlist, cancelled, attended, and no_show.',
        'Waitlist queue statuses are contacted, booked, cancelled, and waiting. Anything else returns Invalid status.',
        'Marking attended does not by itself post the ledger. The charge is Accounts.',
      ],
      errors: [
        { message: 'Pick appointment and patient', fix: 'Choose both. VetAdvisor® still says Patient on this form.' },
        { message: 'Could not book', fix: 'The waitlist row could not be placed. Open the diary if the slot is gone.' },
        { message: 'Invalid status', fix: 'Use Contacted, Booked, or Remove. Those are the queue actions.' },
      ],
      faqs: [{ q: 'Where is the feedback link?', a: 'After Attended, the toast copies it or tells you to share it from the table. The cell says Received once it is back.' }],
    })
  );

  if (spec.tasks) {
    features.push(
      feat({
        id: 'tasks',
        name: 'Tasks',
        href: `${spec.href}/tasks`,
        summary: 'Tasks is only on MedicalAdvisor®. It is the floor list for today, not a command tile.',
        who: WHO,
        prerequisites: ['A title is required.'],
        steps: [
          'Open Tasks. The slices are Overdue, Today, Upcoming, Waiting, and Done.',
          'Enter Task title and press Add task. Assign a clinician, link a patient, and add notes or a step.',
          'Search with Search title, notes, people… and filter All clinicians.',
        ],
        behind: ['The task is stored for this practice. It does not post a journal and it does not create a claim.'],
        errors: [
          { message: 'Type a task', fix: 'Enter a title. The API says Task title required.' },
          { message: 'Task not found', fix: 'Reload. The row is no longer on this company.' },
        ],
        faqs: [{ q: 'Why is Tasks missing on the command grid?', a: 'The sidebar has it. The command tiles do not. Open Tasks from the sidebar.' }],
      })
    );
  }

  features.push(
    feat({
      id: 'messages',
      name: 'Messages',
      href: `${spec.href}/messages`,
      summary: 'Messages is the desk thread with the team and with the person on the book.',
      who: WHO,
      prerequisites: ['A company is selected. You only write threads the desk already knows.'],
      steps: ['Open Messages. Read Open threads and Unread (desk). Reply on the thread that matches the desk and the person.'],
      behind: [
        spec.id === 'dentalgraph'
          ? 'Dental labels the staff side Clinician. The other desks label it Practitioner. The client side says Patient on every desk, including VetAdvisor®.'
          : 'The client side of the thread is labelled Patient, including on VetAdvisor®, even though the sidebar says clients.',
        'A message does not post a journal.',
      ],
      errors: [{ message: 'You are not an active member of this company', fix: 'Open a company you belong to.' }],
      faqs: [{ q: 'Is this the company inbox?', a: 'No. This is the practice desk. The company inbox is Messages under Home or Network.' }],
    }),
    feat({
      id: 'claims',
      name: 'Claims',
      href: `${spec.href}/claims`,
      summary: 'Claims drafts a pack from an attended visit. Submit uses the sandbox, a paper pack, or refuses live MediKredit. The sidebar may say a pet pack on VetAdvisor®. The screen title is Medical-aid claims.',
      who: WHO,
      prerequisites: ['Save practice numbers before an electronic submit. An attended visit that is not already claimed can draft a row.'],
      steps: [
        'Open Claims. The title is Medical-aid claims.',
        'Under Practice billing details enter Practice number, BHF number, PCNS number, VAT number, and Billing / scheme email. Choose MediKredit sandbox (MVP), Manual / paper pack only, or Live MediKredit (needs accreditation). Press Save practice numbers.',
        'On Attended visits without a claim, press Create claim.',
        'In Claims inbox set Tariff / NHRPL and ICD-10. Press Save codes / co-pay. Press Submit on a draft or ready row. Press Pack for the PDF. Press Mark paid or Rejected when you are recording the outcome yourself. Press Match ERA when you have a tracking number and an amount.',
      ],
      behind: [
        'Manual submit marks the claim submitted and does not call a scheme. The message is “Marked submitted for manual / paper pack”.',
        'Sandbox submit simulates an accept and returns a tracking number that starts with MK-. It does not send a live claim. The file header says the MediKredit XML pack is not in the product yet.',
        'Live MediKredit returns SWITCH_NOT_ACCREDITED and tells you to use the sandbox or the PDF.',
        'Pack downloads a PDF. It does not submit. Statuses are draft, ready, submitted, accepted, paid, rejected, partial, and cancelled. The filter has no cancelled chip.',
        'No finance journal is posted by Submit.',
      ],
      errors: [
        { message: 'Practice PCNS / BHF number is required before electronic submit', fix: 'Save practice numbers, including PCNS or BHF, then submit again. Manual / paper pack does not need that call.' },
        { message: 'Live MediKredit (HealthNet ST) is waiting on the official PMS integration pack and practice accreditation. Use sandbox until then, or submit the PDF pack.', fix: 'Switch to MediKredit sandbox (MVP) or Manual / paper pack only, or download Pack.' },
        { message: 'At least one ICD-10 diagnosis code is required', fix: 'Enter a real ICD-10 code. The validator rejects a code that is not in that shape.' },
        { message: 'Attended visit not found or already claimed', fix: 'Mark the visit attended first, and do not draft a second claim for the same visit.' },
        { message: 'No switch tracking number on this claim', fix: 'Refresh status needs a sandbox tracking number. A paper pack does not have one.' },
      ],
      faqs: [
        { q: 'Did Submit send the claim to the scheme?', a: 'Only the sandbox simulates an accept. Live is refused until accreditation. Manual records a paper pack. Pack is a PDF download.' },
      ],
    }),
    feat({
      id: 'accounts',
      name: 'Accounts',
      href: `${spec.href}/accounts`,
      summary: `Accounts charges the person and can post the customer invoice. The screen title is Patient accounts. The kind label is ${spec.accountKind}.`,
      who: WHO,
      prerequisites: ['Select a person before you raise a charge. The invoice email needs an address on that person if you expect the mailed invoice line.'],
      steps: [
        'Open Accounts. Read Open, Proof waiting, and Paid.',
        'On a proof row press Confirm or Reject, or open View proof.',
        'Select a person. Under Raise a charge enter Description and Amount ZAR. Press Add to account.',
        'Under Allocate a payment choose EFT or Cash, enter Bank / receipt ref, and press Allocate to account.',
        'Use Bill all on unbilled visits, or Void on a charge. Present QR / NFC when bills are ticked.',
      ],
      behind: [
        'Add to account creates a customer invoice with status sent and asks Finance to recognise it: debit accounts receivable, credit revenue, credit VAT output. A later allocation settles bank against accounts receivable when the finance twin exists.',
        'If the ledger post fails, the charge still stays. The failure is logged and not shown as a rollback.',
        'Rejecting a proof sets the charge open again. Void voids the charge.',
        spec.accountSidebar,
      ],
      errors: [
        { message: 'Load failed', fix: 'Reload Accounts. The company must be selected.' },
        { message: 'Save failed', fix: 'Check the amount and the person, then add the charge again.' },
      ],
      faqs: [
        { q: 'Does a package or a booking post this invoice?', a: 'No. Add to account and Bill all do. The package screen only stores the pack.' },
      ],
    }),
    feat({
      id: 'comms',
      name: 'Comms',
      href: `${spec.href}/comms`,
      summary: 'Comms publishes a notice, an advert, an offer, or an alert to every person on this practice portal.',
      who: WHO,
      prerequisites: ['A company is selected. Publish is a separate press from Save draft.'],
      steps: [
        'Open Comms. Press New.',
        'Choose Notice, Advert, Offer, or Alert. Set Hide after if you want an end.',
        'Press Save draft or Publish to members.',
        'On a row press Unpublish, Publish, Pin or Unpin, Archive, or Delete. Delete asks “Delete this communication?”',
      ],
      behind: ['Published notices show on the member portal for this business. Draft does not. No journal is posted.'],
      errors: [{ message: 'Announcement failed', fix: 'Save the draft again. The company must still be selected.' }],
      faqs: [{ q: 'The accent says all patients on VetAdvisor®. Who receives it?', a: 'Published notices go to members of this practice portal. The VetAdvisor® sidebar says clients. The screen accent still says patients.' }],
    }),
    feat({
      id: 'portal',
      name: 'View portal',
      href: `${spec.href}/portal`,
      summary: 'View portal previews the home-screen app and chooses which sections it shows. It does not issue the token.',
      who: WHO,
      prerequisites: ['Publish a portal token on Website first. Until then the preview says so.'],
      steps: ['Open View portal. Press Save what to show after you change the sections.', 'If there is no token, open Website and save once.'],
      behind: ['Save what to show stores the section list. The token is issued on Website. No journal is posted.'],
      errors: [{ message: 'Publish a portal token on Website first', fix: 'Open Website and press Save portal or Save settings once.' }],
      faqs: [{ q: 'Is the preview the live site?', a: 'It is the preview of the token you already issued. Guests use the public link from Website.' }],
    }),
    feat({
      id: 'website',
      name: 'Website',
      href: `${spec.href}/website`,
      summary: 'Website saves the brand, the hours, and the public token. Publish turns the profile on. Online booking is a separate switch.',
      who: WHO,
      prerequisites: ['Save once to issue the portal QR. Brand name, public bio, and a phone or email are what the checklist looks for.'],
      steps: [
        'Open Website. Fill Brand name, Brand colour, Phone, Email, City, and Public bio. Tick Publish and Allow online booking on the portal if you want those.',
        'Press Save portal. The first save issues the public token. The amber line says so.',
        'On Clinic public profile press Save settings. The checkboxes are Publish clinic website profile, Allow online booking, Show practitioners, and Show service pricing.',
        'Use Open portal, Copy link, or Rotate public token. Press Download practice PDF for the A4 sheet.',
      ],
      behind: [
        'Both Publish ticks set the profile enabled and issue the token on save.',
        'A guest can still book when the token is valid and Allow online booking is on, even if the website profile is not enabled. The public error “Online booking is disabled” is the booking switch, not the publish tick.',
        'The marketplace lists the practice only when it is listed, enabled, and has a token.',
        'No journal is posted.',
      ],
      errors: [
        { message: 'Online booking is disabled', fix: 'Tick Allow online booking and save. Publish alone does not open the book.' },
        { message: 'Not found', fix: 'The public token does not match a practice. Save again or rotate the token and share the new link.' },
        { message: 'Save once to issue a portal QR', fix: 'Press Save portal. The QR appears after the token exists.' },
      ],
      faqs: [
        { q: 'I published and the public page still will not take a booking. Why?', a: 'Tick Allow online booking and mark the diary slots public. Enabled alone does not open booking, and a draft profile can still book when that switch is on.' },
      ],
    }),
    feat({
      id: 'reports',
      name: 'Reports',
      href: `${spec.href}/management`,
      summary: 'Reports slices appointments by clinician, service, and status. The management address opens the report.',
      who: WHO,
      prerequisites: ['A company is selected. The report reads visits already on the book.'],
      steps: [
        'Open Reports. The sidebar path redirects to the report anchor.',
        'Use the slicer. Status options are Scheduled, Completed, Cancelled, and No-show. Those are appointment statuses.',
        'Read the tables under the graph. Dental adds fill rate, attended against no-show, and the waitlist.',
      ],
      behind: ['The report is computed from this company. It does not post a journal and it does not file a claim.'],
      errors: [{ message: 'Your role (…) cannot access Operations.', fix: 'Reports uses the same Operations gate.' }],
      faqs: [{ q: 'Why is there no sample clinic in the report?', a: 'The report lists this company only. Production will not load a sample book.' }],
    })
  );

  return features;
}

function clinicGuide(spec: ClinicSpec): ModuleGuide {
  return {
    id: spec.id,
    name: spec.name,
    href: spec.href,
    purpose: spec.purpose,
    roles: ['Owner', 'Admin', 'Member', 'Viewer', 'Finance', 'Operations', 'Sales'],
    outcome: spec.outcomes,
    flow: [
      { id: 'people', label: spec.peopleName, hint: 'Then the book' },
      { id: 'diary', label: 'Diary', hint: 'Public slot is optional' },
      { id: 'attend', label: 'Attended', hint: 'Front desk' },
      { id: 'claim', label: 'Claim', hint: 'Sandbox or paper' },
      { id: 'account', label: 'Account', hint: 'Invoice posts here' },
    ],
    faqs: [
      {
        q: 'Does Submit on Claims reach the scheme?',
        a: 'Sandbox simulates an accept. Live MediKredit is refused until accreditation. Manual records a paper pack. The PDF pack does not submit.',
      },
      {
        q: 'Where does the ledger move?',
        a: 'On Accounts, when you add a charge or allocate a payment, and only if the finance invoice can be posted. Packages, bookings, and claims do not post that journal.',
      },
    ],
    features: clinicFeatures(spec),
  };
}

export const PHYSIO_GUIDE = clinicGuide({
  id: 'physiograph',
  name: 'PhysioAdvisor®',
  href: '/dashboard/physiograph',
  purpose:
    'PhysioAdvisor® in SupplierAdvisor® is the allied-health desk: practitioners, patients, the diary, rehab movements, claims, and patient accounts. Leave blocks a diary series on this desk only.',
  command:
    'Command is the clinic home: today’s treatment board, outcomes, and the links into the diary and the website.',
  today: "Today's treatment board",
  recalls: 'Rehab / review recalls',
  demoButton: 'Load demo clinic',
  demoToast: 'Demo clinic loaded — practitioners, patients, diary',
  peopleName: 'Practitioners',
  peopleHref: '/practitioners',
  peopleScreen: 'Practitioners',
  peopleNoun: 'practitioner',
  patientSidebar: 'Patients',
  patientHref: '/patients',
  movements: true,
  roomsNoun: 'practitioner',
  bookExtra: 'Mark attended, then open Rehab on the patient chart for that visit.',
  claimSidebar: 'Medical-aid packs · submit',
  accountSidebar: 'The sidebar says patient fees. The screen says Patient accounts.',
  accountKind: 'Physio account',
  commsSidebar: 'Ads · notices to all patients',
  portalSidebar: 'Patient PWA',
  outcomes: 'A visit can be marked attended, a claim can be drafted, and a charge can raise the customer invoice.',
});

export const DENTAL_GUIDE = clinicGuide({
  id: 'dentalgraph',
  name: 'DentalAdvisor®',
  href: '/dashboard/dentalgraph',
  purpose:
    'DentalAdvisor® in SupplierAdvisor® is the practice desk: staff, patients, the chair diary, claims, and patient accounts. It does not apply the physio leave block.',
  command: 'Command is the practice home. The sample button says Load demo practice. Today’s board is the chair board.',
  today: "Today's chair board",
  recalls: 'Hygiene / check-up recalls',
  demoButton: 'Load demo practice',
  demoToast: 'Demo practice loaded — staff, patients, diary',
  peopleName: 'Staff',
  peopleHref: '/staff',
  peopleScreen: 'Staff',
  peopleNoun: 'clinician',
  patientSidebar: 'Patients',
  patientHref: '/patients',
  roomsNoun: 'clinician',
  bookExtra: 'There is no Rehab link. Mark attended for the feedback link.',
  claimSidebar: 'Medical-aid packs · submit',
  accountSidebar: 'The sidebar says patient fees. The screen says Patient accounts.',
  accountKind: 'Dental account',
  commsSidebar: 'Ads · notices to all patients',
  portalSidebar: 'Patient PWA',
  outcomes: 'A chair visit can be marked attended, a claim can be drafted, and a charge can raise the customer invoice.',
});

export const PSYCHIATRY_GUIDE = clinicGuide({
  id: 'psychiatrygraph',
  name: 'PsychiatryAdvisor®',
  href: '/dashboard/psychiatrygraph',
  purpose:
    'PsychiatryAdvisor® in SupplierAdvisor® is the mental-health desk: practitioners, patients, the session diary, claims, and patient accounts.',
  command: 'Command is the practice home. Today’s board is the session board.',
  today: "Today's session board",
  recalls: 'Review / follow-up recalls',
  demoButton: 'Load demo clinic',
  demoToast: 'Demo clinic loaded — practitioners, patients, diary',
  peopleName: 'Practitioners',
  peopleHref: '/practitioners',
  peopleScreen: 'Practitioners',
  peopleNoun: 'practitioner',
  patientSidebar: 'Patients',
  patientHref: '/patients',
  roomsNoun: 'clinician',
  bookExtra: 'Open Script on a visit when you need a prescription on the chart. There is no movements library.',
  claimSidebar: 'Medical-aid packs · submit',
  accountSidebar: 'The sidebar says patient fees. The screen says Patient accounts.',
  accountKind: 'Psychiatry account',
  commsSidebar: 'Ads · notices to all patients',
  portalSidebar: 'Patient PWA',
  outcomes: 'A session can be marked attended, a claim can be drafted, and a charge can raise the customer invoice.',
});

export const MEDICAL_GUIDE = clinicGuide({
  id: 'medicalgraph',
  name: 'MedicalAdvisor®',
  href: '/dashboard/medicalgraph',
  purpose:
    'MedicalAdvisor® in SupplierAdvisor® is the practice desk: practitioners, patients, tasks, the diary, claims, and patient accounts.',
  command: 'Command is the practice home. Tasks is on the sidebar and is not a command tile. Rooms can also be added from the clinic-rooms card.',
  today: "Today's treatment board",
  recalls: 'Rehab / review recalls',
  demoButton: 'Load demo clinic',
  demoToast: 'Demo clinic loaded — practitioners, patients, diary',
  peopleName: 'Practitioners',
  peopleHref: '/practitioners',
  peopleScreen: 'Practitioners',
  peopleNoun: 'practitioner',
  patientSidebar: 'Patients',
  patientHref: '/patients',
  tasks: true,
  roomsNoun: 'medical advisor',
  bookExtra: 'Patients can get a reminder before the visit and a rating email after. Mark attended to send feedback immediately.',
  claimSidebar: 'Medical-aid packs · submit',
  accountSidebar: 'The sidebar says patient fees. The screen says Patient accounts.',
  accountKind: 'Medical account',
  commsSidebar: 'Ads · notices to all patients',
  portalSidebar: 'Patient PWA',
  outcomes: 'A consult can be marked attended, a floor task can be ticked, a claim can be drafted, and a charge can raise the customer invoice.',
});

export const VET_GUIDE = clinicGuide({
  id: 'vetgraph',
  name: 'VetAdvisor®',
  href: '/dashboard/vetgraph',
  purpose:
    'VetAdvisor® in SupplierAdvisor® is the practice desk for clients. The register does not store an animal. The client app copy is what mentions pets. Claims and accounts still use the patient wording on the screen.',
  command: 'Command is the practice home. The client tile is the register. The screen under it is still titled Patients.',
  today: "Today's treatment board",
  recalls: 'Rehab / review recalls',
  demoButton: 'Load demo clinic',
  demoToast: 'Demo clinic loaded — practitioners, patients, diary',
  peopleName: 'Vets',
  peopleHref: '/practitioners',
  peopleScreen: 'Practitioners',
  peopleNoun: 'practitioner',
  patientSidebar: 'Clients',
  patientHref: '/patients',
  roomsNoun: 'medical advisor',
  bookExtra: 'The form still says Book patient. The reminder copy uses the VetAdvisor® name.',
  claimSidebar: 'The sidebar says pet medical-aid packs. The screen title is Medical-aid claims.',
  accountSidebar: 'The sidebar says client fees. The screen title is Patient accounts and the charge kind is Vet account.',
  accountKind: 'Vet account',
  commsSidebar: 'The sidebar says clients. The screen accent says all patients.',
  portalSidebar: 'The sidebar says client PWA. The screen accent says patient app.',
  outcomes: 'A client visit can be marked attended, a claim can be drafted as a medical-aid pack, and a charge can raise the customer invoice.',
});
