import { useMemo } from "react";
import { useAuth } from "@/context/supabase-provider";
import {
  calculateAge,
  isBirthday,
  isBirthdayUpcoming,
  getBirthdayMessage,
  getAgeGroup,
} from "@/utils/birthday";

export function useBirthday() {
  const { profile } = useAuth();

  return useMemo(() => {
    if (!profile?.date_of_birth) {
      return {
        hasDateOfBirth: false,
        age: null,
        isBirthdayToday: false,
        isBirthdayUpcoming: false,
        birthdayMessage: null,
        ageGroup: null,
      };
    }

    const age = calculateAge(profile.date_of_birth);
    const isBirthdayToday = isBirthday(profile.date_of_birth);
    const isBirthdaySoon = isBirthdayUpcoming(profile.date_of_birth);
    const birthdayMessage = isBirthdayToday
      ? getBirthdayMessage(profile.full_name)
      : null;
    const ageGroup = getAgeGroup(profile.date_of_birth);

    return {
      hasDateOfBirth: true,
      age,
      isBirthdayToday,
      isBirthdayUpcoming: isBirthdaySoon,
      birthdayMessage,
      ageGroup,
    };
  }, [profile?.date_of_birth, profile?.full_name]);
}
