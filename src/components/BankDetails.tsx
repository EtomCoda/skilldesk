import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useStore } from "../store/useStore";
import { useToast } from "../lib/toast";
import { Building2, CreditCard, CheckCircle, Loader2 } from "lucide-react";

// Nigerian banks list with Paystack bank codes
const NIGERIAN_BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "Citibank Nigeria", code: "023" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "First City Monument Bank (FCMB)", code: "214" },
  { name: "Guaranty Trust Bank (GTBank)", code: "058" },
  { name: "Heritage Bank", code: "030" },
  { name: "Keystone Bank", code: "082" },
  { name: "Opay", code: "999992" },
  { name: "Palmpay", code: "999991" },
  { name: "Polaris Bank", code: "076" },
  { name: "Providus Bank", code: "101" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Standard Chartered Bank", code: "068" },
  { name: "Sterling Bank", code: "232" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "United Bank for Africa (UBA)", code: "033" },
  { name: "Unity Bank", code: "215" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
  { name: "Kuda Microfinance Bank", code: "90267" },
  { name: "Moniepoint Microfinance Bank", code: "50515" },
];

interface BankAccount {
  id: string;
  bank_code: string;
  account_number: string;
  account_name: string;
}

interface BankDetailsProps {
  onSuccess?: () => void;
}

const BankDetails: React.FC<BankDetailsProps> = ({ onSuccess }) => {
  const { currentUser } = useStore();
  const { toast } = useToast();
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);

  // Form state
  const [selectedBankCode, setSelectedBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState("");

  useEffect(() => {
    if (!currentUser?.id) return;
    fetchBankDetails();
  }, [currentUser?.id]);

  const fetchBankDetails = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("user_id", currentUser?.id)
      .single();
    setBankAccount(data);
    if (data) {
      setSelectedBankCode(data.bank_code);
      setAccountNumber(data.account_number);
      setResolvedName(data.account_name);
    }
    setLoading(false);
  };

  // Auto-resolve account name when bank and 10-digit account number are provided
  useEffect(() => {
    if (selectedBankCode && accountNumber.length === 10) {
      resolveAccountName();
    } else {
      setResolvedName("");
    }
  }, [selectedBankCode, accountNumber]);

  const resolveAccountName = useCallback(async () => {
    setResolving(true);
    setResolvedName("");
    try {
      // This calls Paystack's account resolution API via the Edge Function to keep the secret key secure
      const { data, error } = await supabase.functions.invoke(
        "resolve-bank-account",
        {
          body: { bank_code: selectedBankCode, account_number: accountNumber },
        },
      );
      if (error) throw error;
      setResolvedName(data.account_name);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not verify account. Please check the details.";
      toast.error(message);
    } finally {
      setResolving(false);
    }
  }, [selectedBankCode, accountNumber, toast]);

  const handleSave = async () => {
    if (!resolvedName) {
      toast.error(
        "Please enter a valid account number and select your bank to verify the name first.",
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: currentUser?.id,
        bank_code: selectedBankCode,
        account_number: accountNumber,
        account_name: resolvedName,
      };

      if (bankAccount) {
        // Update existing
        const { error } = await supabase
          .from("bank_accounts")
          .update(payload)
          .eq("user_id", currentUser?.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase.from("bank_accounts").insert(payload);
        if (error) throw error;
      }

      await fetchBankDetails();
      toast.success("Bank details saved successfully!");
      onSuccess?.();
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to save bank details.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const selectedBank = NIGERIAN_BANKS.find((b) => b.code === selectedBankCode);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-primary-600 w-6 h-6" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
          <Building2 className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Bank Details</h3>
          <p className="text-sm text-gray-500">
            Required for withdrawing your earnings
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Bank of Choice */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bank of Choice
          </label>
          <select
            id="select-bank"
            value={selectedBankCode}
            onChange={(e) => setSelectedBankCode(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">Select your bank...</option>
            {NIGERIAN_BANKS.map((bank) => (
              <option key={bank.code} value={bank.code}>
                {bank.name}
              </option>
            ))}
          </select>
        </div>

        {/* Account Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Account Number
          </label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="input-account-number"
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={accountNumber}
              onChange={(e) =>
                setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              placeholder="Enter 10-digit account number"
              className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
        </div>

        {/* Resolved Account Name */}
        <div className="min-h-[48px]">
          {resolving && (
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5">
              <Loader2 className="animate-spin w-4 h-4" />
              Verifying account...
            </div>
          )}
          {!resolving && resolvedName && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{resolvedName}</span>
            </div>
          )}
          {!resolving &&
            !resolvedName &&
            accountNumber.length > 0 &&
            accountNumber.length < 10 && (
              <p className="text-xs text-gray-400 px-1">
                Enter 10 digits to auto-verify
              </p>
            )}
        </div>

        {/* Save Button */}
        <button
          id="btn-save-bank-details"
          onClick={handleSave}
          disabled={saving || !resolvedName}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin w-4 h-4" /> Saving...
            </>
          ) : (
            "Save Bank Details"
          )}
        </button>
      </div>

      {/* Current saved info */}
      {bankAccount && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Currently saved:</p>
          <p className="text-sm font-medium text-gray-700">
            {NIGERIAN_BANKS.find((b) => b.code === bankAccount.bank_code)
              ?.name ?? "Unknown Bank"}{" "}
            — ****{bankAccount.account_number.slice(-4)}
          </p>
          <p className="text-sm text-gray-500">{bankAccount.account_name}</p>
        </div>
      )}
    </div>
  );
};

export default BankDetails;
