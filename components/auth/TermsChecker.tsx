import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/supabase-provider";
import { useTermsAcceptance } from "@/hooks/useTermsAcceptance";
import { TermsAcceptanceModal } from "./TermsAcceptanceModal";

interface TermsCheckerProps {
  children: React.ReactNode;
}

export const TermsChecker: React.FC<TermsCheckerProps> = ({ children }) => {
  const { profile, signOut } = useAuth();
  const { hasAcceptedCurrentTerms, checkingTerms, checkTermsAcceptance } =
    useTermsAcceptance();
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    // Only check for authenticated users
    if (profile?.id && !checkingTerms) {
      if (!hasAcceptedCurrentTerms) {
        setShowTermsModal(true);
      }
    }
  }, [profile?.id, hasAcceptedCurrentTerms, checkingTerms]);

  const handleTermsAccepted = async () => {
    setShowTermsModal(false);
    // Re-check terms acceptance to update state
    await checkTermsAcceptance();
  };

  const handleTermsDeclined = async () => {
    setShowTermsModal(false);
    // Sign out the user if they decline the terms
    await signOut();
  };

  // Don't render anything while checking terms
  if (checkingTerms) {
    return null;
  }

  return (
    <>
      {children}
      <TermsAcceptanceModal
        visible={showTermsModal}
        onAccept={handleTermsAccepted}
        onDecline={handleTermsDeclined}
        allowDismiss={false} // Force acceptance for existing users
      />
    </>
  );
};

export default TermsChecker;
