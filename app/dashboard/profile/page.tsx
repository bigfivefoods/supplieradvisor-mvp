export const dynamic = 'force-dynamic';

export default function MyBusinessProfile() {
  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">
            {form.legal_name}
          </h1>
          <p className="text-xl text-neutral-600">Company ID: {companyId || 'None'} • Data from Supabase</p>
        </div>
        <div className="flex gap-4">
          <button onClick={loadCompanyData} className="flex items-center gap-2 border px-8 py-4 rounded-3xl hover:bg-neutral-100">
            <RotateCw size={18} /> Refresh
          </button>
          <button className="btn-primary flex items-center gap-3 px-12 py-4">
            Save All Changes <ArrowRight />
          </button>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 mb-8">
        <h2 className="text-2xl font-bold flex items-center gap-2">✅ Supabase Loading Working</h2>
        <button className="mt-4 bg-green-600 text-white px-10 py-3 rounded-2xl text-lg font-medium">
          Get Verified - R49 with Paystack
        </button>
      </div>

      <div className="bg-white rounded-3xl p-8">
        <h3 className="font-bold mb-4">Loaded Data</h3>
        <p><strong>Legal Name:</strong> {form.legal_name}</p>
        <p><strong>Email:</strong> {form.email}</p>
        <p><strong>Registration:</strong> {form.registration_number}</p>
      </div>

      <div className="flex justify-end gap-4 mt-12">
        <button className="btn-primary">Add Certification</button>
        <button className="btn-primary">Add Product</button>
      </div>
    </div>
  );
}