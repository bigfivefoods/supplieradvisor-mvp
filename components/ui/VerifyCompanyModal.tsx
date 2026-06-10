'use client';

import { useState } from 'react';
import { ShieldCheck, X, ExternalLink, CheckCircle2, CircleDot, Upload, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { mintVerificationSBT } from '@/lib/onchain';
import {
  getVerificationAuthority,
  verifyCompanyRegistration,
  type VerificationAuthority,
} from '@/lib/verification';
import toast from 'react-hot-toast';

interface VerifyCompanyModalProps {
  profileId: string;
  legalName: string;
  tradingName: string;
  country: string;
  registrationNumber: string;
  businessType: string;
  isVerified: boolean;
  verifiedAt: string | null;
  onVerified: (result: { on_chain_hash: string; sbt_token_id: string | null; verified_at: string }) => void;
  onClose: () => void;
}

type Step = 'info' | 'submit' | 'done';

export default function VerifyCompanyModal({
  profileId,
  legalName,
  tradingName,
  country,
  registrationNumber,
  businessType,
  isVerified,
  verifiedAt,
  onVerified,
  onClose,
}: VerifyCompanyModalProps) {
  const authority: VerificationAuthority = getVerificationAuthority(country || '');

  const [step, setStep] = useState<Step>(isVerified ? 'done' : 'info');
  const [regNumber, setRegNumber] = useState(registrationNumber || '');
  const [docUrl, setDocUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profileId) return toast.error('Please select a file');
    setUploading(true);
    try {
      const fileName = `${profileId}-verification-${Date.now()}.${file.name.split('.').pop()}`;
      const { error } = await supabase.storage.from('certificates').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('certificates').getPublicUrl(fileName);
      setDocUrl(publicUrl);
      toast.success('✅ Document uploaded');
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setValidationError('');

    const result = verifyCompanyRegistration(regNumber, country || '');
    if (!result.success) {
      setValidationError(result.message);
      return;
    }

    if (!docUrl) {
      setValidationError('Please upload your registration certificate before submitting.');
      return;
    }

    setVerifying(true);
    try {
      // Save the (possibly updated) registration number back to the profile
      if (regNumber && regNumber !== registrationNumber) {
        await supabase
          .from('profiles')
          .update({ registration_number: regNumber, registration_document_url: docUrl })
          .eq('user_id', profileId);
      } else if (docUrl) {
        await supabase
          .from('profiles')
          .update({ registration_document_url: docUrl })
          .eq('user_id', profileId);
      }

      // Mint the on-chain SBT
      const metadata = {
        profileId,
        legal_name: legalName,
        trading_name: tradingName,
        registration_number: regNumber,
        country,
        business_type: businessType,
        authority: authority.name,
        timestamp: new Date().toISOString(),
      };
      const chainResult = await mintVerificationSBT(profileId, metadata);
      onVerified(chainResult);
      setStep('done');
      toast.success('🎉 Company verified! Your Verified Badge has been issued on Polygon.');
    } catch {
      toast.error('Verification failed. Please try again or contact support.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="bg-[#00b4d8]/10 p-3 rounded-2xl">
              <ShieldCheck size={28} className="text-[#00b4d8]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-neutral-900">
                {isVerified ? 'Verification Status' : 'Get Verified'}
              </h2>
              <p className="text-sm text-neutral-500">
                {authority.name} · {authority.fullName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-xl transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Already verified */}
          {step === 'done' && (
            <div className="text-center space-y-6 py-4">
              <div className="flex justify-center">
                <div className="bg-emerald-50 p-6 rounded-full">
                  <CheckCircle2 size={56} className="text-emerald-500" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-emerald-700 mb-2">Company Verified ✓</h3>
                <p className="text-neutral-600">
                  <span className="font-semibold">{tradingName || legalName}</span> has been verified via{' '}
                  <span className="font-semibold">{authority.name}</span> and issued an on-chain Verified Badge
                  (Soul-Bound Token) on Polygon.
                </p>
                {verifiedAt && (
                  <p className="text-sm text-neutral-400 mt-2">
                    Verified on {new Date(verifiedAt).toLocaleDateString('en-ZA', { dateStyle: 'long' })}
                  </p>
                )}
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-left">
                <p className="text-sm font-medium text-emerald-700 mb-1">What this means for your business:</p>
                <ul className="text-sm text-emerald-800 space-y-1 list-disc list-inside">
                  <li>Your Verified Badge is displayed on your public supplier profile</li>
                  <li>Buyers can trust your registration details are confirmed</li>
                  <li>Your verification is permanently recorded on Polygon blockchain</li>
                  <li>Priority placement in supplier search results</li>
                </ul>
              </div>
              <button onClick={onClose} className="btn-primary px-12 py-4">
                Close
              </button>
            </div>
          )}

          {/* Step 1: Authority info */}
          {step === 'info' && (
            <div className="space-y-6">
              {/* Authority card */}
              <div className="bg-[#00b4d8]/5 border border-[#00b4d8]/20 rounded-2xl p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block bg-[#00b4d8] text-white text-xs font-bold px-3 py-1 rounded-full mb-2">
                      {authority.name}
                    </span>
                    <h3 className="font-bold text-lg text-neutral-900">{authority.fullName}</h3>
                    <p className="text-sm text-neutral-600 mt-1">{authority.description}</p>
                  </div>
                  {authority.url && (
                    <a
                      href={authority.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-[#00b4d8] hover:underline ml-4 whitespace-nowrap"
                    >
                      Official site <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>

              {/* Business type banner */}
              {businessType && (
                <div className="flex items-center gap-3 bg-neutral-50 rounded-2xl px-5 py-4">
                  <CircleDot size={18} className="text-[#00b4d8] flex-shrink-0" />
                  <span className="text-sm text-neutral-700">
                    Business type: <span className="font-semibold">{businessType}</span>
                    {' — '}verification is available for <strong>all business types</strong> registered with {authority.name}.
                  </span>
                </div>
              )}

              {/* Verification steps */}
              <div>
                <h4 className="font-semibold text-neutral-800 mb-4">How verification works:</h4>
                <ol className="space-y-3">
                  {authority.verificationSteps.map((s, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 bg-[#00b4d8]/10 text-[#00b4d8] rounded-full flex items-center justify-center text-sm font-bold">
                        {i + 1}
                      </span>
                      <span className="text-neutral-700 text-sm mt-1">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Required documents */}
              <div>
                <h4 className="font-semibold text-neutral-800 mb-3">Required documents:</h4>
                <ul className="space-y-2">
                  {authority.requiredDocs.map((doc, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-neutral-700">
                      <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                      {doc}
                    </li>
                  ))}
                </ul>
              </div>

              {authority.lookupUrl && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    Don&apos;t have your registration number?{' '}
                    <a href={authority.lookupUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                      Look it up on the {authority.name} portal <ExternalLink size={12} className="inline" />
                    </a>
                  </p>
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button onClick={onClose} className="flex-1 border border-neutral-200 px-6 py-4 rounded-2xl hover:bg-neutral-50 transition-colors font-medium">
                  Cancel
                </button>
                <button onClick={() => setStep('submit')} className="flex-1 btn-primary flex items-center justify-center gap-2 py-4">
                  <ShieldCheck size={20} /> Continue to Verify
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Submit */}
          {step === 'submit' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="inline-block bg-[#00b4d8] text-white text-xs font-bold px-3 py-1 rounded-full">
                  {authority.name}
                </span>
                <span className="text-sm text-neutral-500">Verification submission</span>
              </div>

              {/* Company being verified */}
              <div className="bg-neutral-50 rounded-2xl px-6 py-4">
                <p className="text-sm text-neutral-500 mb-1">Verifying company</p>
                <p className="font-bold text-lg">{legalName || tradingName || 'Your Company'}</p>
                {businessType && <p className="text-sm text-neutral-500">{businessType}</p>}
              </div>

              {/* Registration number */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  {authority.registrationNumberLabel}
                </label>
                <input
                  type="text"
                  className="input w-full"
                  value={regNumber}
                  onChange={e => { setRegNumber(e.target.value); setValidationError(''); }}
                  placeholder={authority.registrationNumberExample}
                />
                <p className="text-xs text-neutral-400 mt-1">{authority.registrationNumberExample}</p>
              </div>

              {/* Document upload */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Upload Registration Certificate <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-neutral-500 mb-3">
                  Upload {authority.requiredDocs[0]} (PDF or image, max 10 MB)
                </p>
                <div className="border-2 border-dashed border-neutral-200 rounded-2xl p-6 text-center hover:border-[#00b4d8] transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleDocUpload}
                    className="hidden"
                    id="verify-doc-upload"
                  />
                  <label htmlFor="verify-doc-upload" className="cursor-pointer">
                    {docUrl ? (
                      <div className="flex items-center justify-center gap-2 text-emerald-600">
                        <CheckCircle2 size={20} />
                        <span className="font-medium">Document uploaded ✓</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload size={28} className="mx-auto text-neutral-400" />
                        <p className="text-sm font-medium text-neutral-600">
                          {uploading ? 'Uploading…' : 'Click to upload your certificate'}
                        </p>
                        <p className="text-xs text-neutral-400">PDF, JPG or PNG</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Validation error */}
              {validationError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-2xl p-4">
                  <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{validationError}</p>
                </div>
              )}

              {/* Disclaimer */}
              <div className="text-xs text-neutral-400 bg-neutral-50 rounded-2xl p-4 leading-relaxed">
                By submitting, you confirm that the information provided is accurate and that you are authorised
                to verify this company. Your registration number will be cross-checked against{' '}
                {authority.name} public records. An on-chain Verified Badge (Soul-Bound Token) will be minted
                to your profile on the Polygon network.
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('info')}
                  className="flex-1 border border-neutral-200 px-6 py-4 rounded-2xl hover:bg-neutral-50 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={verifying || uploading}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 py-4 disabled:opacity-60"
                >
                  <ShieldCheck size={20} />
                  {verifying ? 'Verifying…' : 'Submit & Get Verified'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
