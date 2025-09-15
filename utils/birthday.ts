// Birthday and age-related utility functions

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

/**
 * Check if today is the user's birthday
 */
export function isBirthday(dateOfBirth: string): boolean {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);

  return (
    today.getMonth() === birthDate.getMonth() &&
    today.getDate() === birthDate.getDate()
  );
}

/**
 * Check if user's birthday is within the next N days
 */
export function isBirthdayUpcoming(
  dateOfBirth: string,
  daysAhead: number = 7,
): boolean {
  const today = new Date();
  const thisYear = today.getFullYear();
  const birthDate = new Date(dateOfBirth);

  // Create birthday date for this year
  const thisBirthday = new Date(
    thisYear,
    birthDate.getMonth(),
    birthDate.getDate(),
  );

  // If birthday already passed this year, check next year
  if (thisBirthday < today) {
    thisBirthday.setFullYear(thisYear + 1);
  }

  const diffTime = thisBirthday.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays <= daysAhead;
}

/**
 * Format birthday message
 */
export function getBirthdayMessage(name: string): string {
  const messages = [
    `🎉 Happy Birthday, ${name}! Hope you have a wonderful day!`,
    `🎂 It's your special day, ${name}! Enjoy every moment!`,
    `🎈 Wishing you a fantastic birthday, ${name}!`,
    `🥳 Happy Birthday, ${name}! May all your wishes come true!`,
  ];

  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Get age group for targeted offers
 */
export function getAgeGroup(dateOfBirth: string): string {
  const age = calculateAge(dateOfBirth);

  if (age < 18) return "teen";
  if (age < 25) return "young_adult";
  if (age < 35) return "adult";
  if (age < 50) return "middle_age";
  if (age < 65) return "mature";
  return "senior";
}
