// constants/legalDocuments.ts

export interface LegalSection {
  id: string;
  title: string;
  content: string;
  subsections?: LegalSection[];
}

export interface LegalDocument {
  id: string;
  title: string;
  lastUpdated: string;
  effectiveDate: string;
  version: string;
  sections: LegalSection[];
}

// Privacy Policy Document
export const PRIVACY_POLICY: LegalDocument = {
  id: "privacy_policy",
  title: "Privacy Policy",
  lastUpdated: "2025-01-01",
  effectiveDate: "2025-01-01",
  version: "1.0",
  sections: [
    {
      id: "introduction",
      title: "Introduction",
      content: `Welcome to Plate's Privacy Policy. Qwerty App ("we," "us," "our") is committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application Plate ("App").

By using Plate, you consent to the data practices described in this policy. If you do not agree with our policies and practices, please do not use our App.`,
    },
    {
      id: "information_we_collect",
      title: "Information We Collect",
      content:
        "We collect information you provide directly to us and information collected automatically when you use our App:",
      subsections: [
        {
          id: "information_you_provide",
          title: "Information You Provide Directly",
          content: `Account Registration:
• Full name
• Email address
• Phone number
• Password (encrypted)
• Profile photo (optional)
• Date of birth (optional)

Profile Information:
• Dietary restrictions and preferences
• Favorite cuisines
• Allergies
• Preferred party size
• Special occasion dates

Booking Information:
• Reservation details (date, time, party size)
• Special requests
• Dietary notes
• Guest information (for group bookings)
• Table preferences`,
        },
        {
          id: "information_collected_automatically",
          title: "Information Collected Automatically",
          content: `Device Information:
• Device type and model
• Operating system version
• Unique device identifiers
• IP address
• Mobile network information
• App version and usage data
• Crash reports and error logs

Usage Data:
• App interactions and navigation patterns
• Search queries and filters
• Time spent on different screens
• Features used and frequency
• Location data (when permitted)
• Booking history and preferences`,
        },
      ],
    },
    {
      id: "how_we_use_information",
      title: "How We Use Your Information",
      content: "We use the information we collect for various purposes:",
      subsections: [
        {
          id: "service_provision",
          title: "Service Provision",
          content: `• Processing and managing your restaurant reservations
• Facilitating communication between you and restaurants
• Providing customer support and responding to your inquiries
• Sending booking confirmations, reminders, and updates
• Managing your account and profile settings
• Processing payments and managing billing`,
        },
        {
          id: "personalization",
          title: "Personalization and Recommendations",
          content: `• Personalizing your experience and content
• Providing restaurant recommendations based on your preferences
• Customizing search results and availability
• Offering relevant promotions and special offers
• Managing your loyalty program benefits
• Tailoring marketing communications`,
        },
        {
          id: "analytics_improvement",
          title: "Analytics and Service Improvement",
          content: `• Analyzing usage patterns and trends
• Improving app functionality and user experience
• Developing new features and services
• Conducting research and analytics
• Monitoring and ensuring platform security
• Preventing fraud and unauthorized access`,
        },
        {
          id: "legal_compliance",
          title: "Legal and Compliance",
          content: `• Complying with applicable laws and regulations
• Enforcing our Terms of Service
• Protecting our rights and the rights of others
• Responding to legal requests and preventing harm
• Maintaining records for business and legal purposes`,
        },
      ],
    },
    {
      id: "information_sharing",
      title: "How We Share Your Information",
      content: "We may share your information in the following circumstances:",
      subsections: [
        {
          id: "restaurant_partners",
          title: "Restaurant Partners",
          content: `We share necessary booking information with restaurants to facilitate your reservations:
• Your name and contact information
• Reservation details and special requests
• Dietary restrictions and accessibility needs
• Party size and seating preferences
• Arrival and cancellation notifications`,
        },
        {
          id: "service_providers",
          title: "Service Providers",
          content: `We work with third-party service providers who assist us in operating our platform:
• Payment processors (for transaction processing)
• Cloud hosting providers (for data storage and processing)
• Analytics providers (for app improvement)
• Marketing and communication providers
• Customer support platforms
• Security and fraud prevention services`,
        },
        {
          id: "business_transfers",
          title: "Business Transfers",
          content: `In the event of a merger, acquisition, or sale of all or a portion of our assets, your information may be transferred to the acquiring entity. We will provide notice before your personal information is transferred and becomes subject to a different privacy policy.`,
        },
        {
          id: "legal_requirements",
          title: "Legal Requirements",
          content: `We may disclose your information when required by law or in response to:
• Valid legal process (subpoenas, court orders)
• Government investigations or requests
• Threats to public safety or security
• Protection of our rights and property
• Prevention of fraud or illegal activities`,
        },
      ],
    },
    {
      id: "data_security",
      title: "Data Security",
      content: `We implement robust security measures to protect your personal information:

• Encryption of data in transit and at rest
• Secure payment processing through PCI-compliant providers
• Regular security audits and vulnerability assessments
• Access controls and authentication requirements
• Employee training on data protection and security
• Incident response and breach notification procedures

However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.`,
    },
    {
      id: "data_retention",
      title: "Data Retention",
      content: `We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this Privacy Policy:

• Account information: For the duration of your account plus 7 years for legal compliance
• Booking history: 7 years from the date of reservation for business records
• Communication records: 3 years from the last interaction
• Marketing preferences: Until you withdraw consent
• Legal and compliance data: As required by applicable laws

You may request deletion of your personal information at any time, subject to legal and business requirements.`,
    },
    {
      id: "your_rights",
      title: "Your Rights and Choices",
      content: "You have several rights regarding your personal information:",
      subsections: [
        {
          id: "access_rights",
          title: "Access and Portability",
          content: `• Request access to your personal information
• Obtain a copy of your data in a structured format
• Review how your information is being used
• Verify the accuracy of your data`,
        },
        {
          id: "correction_rights",
          title: "Correction and Updates",
          content: `• Update your profile and account information
• Correct inaccurate or incomplete data
• Modify your communication preferences
• Change your marketing consent settings`,
        },
        {
          id: "deletion_rights",
          title: "Deletion and Restriction",
          content: `• Request deletion of your personal information
• Restrict processing of your data
• Object to certain uses of your information
• Withdraw consent for marketing communications`,
        },
        {
          id: "exercising_rights",
          title: "How to Exercise Your Rights",
          content: `To exercise these rights, contact us at:
• Email: privacy@plate-app.com
• Phone: +961 1 234 567
• In-app: Settings > Privacy > Data Rights
• Mail: Qwerty App, Privacy Officer, Beirut, Lebanon

We will respond to your request within 30 days of receipt.`,
        },
      ],
    },
    {
      id: "international_transfers",
      title: "International Data Transfers",
      content: `Your information may be transferred to and processed in countries other than Lebanon, including countries that may not have the same data protection laws as your jurisdiction. When we transfer your information internationally, we implement appropriate safeguards:

• Standard contractual clauses approved by relevant authorities
• Adequacy decisions by data protection authorities
• Binding corporate rules for intra-group transfers
• Your explicit consent for specific transfers

We ensure that any international transfers comply with applicable data protection laws and that your information receives an adequate level of protection.`,
    },
    {
      id: "childrens_privacy",
      title: "Children's Privacy",
      content: `Our Service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.

If we become aware that we have collected personal information from a child under 13 without parental consent, we will take steps to delete that information from our servers.`,
    },
    {
      id: "changes_to_policy",
      title: "Changes to This Privacy Policy",
      content: `We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. When we make changes, we will:

• Update the "Last Updated" date at the top of this policy
• Notify you of material changes through the app or by email
• Provide you with the opportunity to review the updated policy
• Obtain your consent for material changes that affect your rights

Your continued use of our Service after the effective date of any changes constitutes your acceptance of the updated Privacy Policy.`,
    },
    {
      id: "contact_information",
      title: "Contact Information",
      content: `If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:

Qwerty App
Privacy Officer
Address: Beirut, Lebanon
Email: privacy@plate-app.com
Phone: +961 1 234 567

For urgent privacy matters or data breaches, please contact our Data Protection Officer:
Email: dpo@plate-app.com
Phone: +961 1 234 568

We are committed to addressing your privacy concerns promptly and transparently.`,
    },
  ],
};

// Terms of Service Document
export const TERMS_OF_SERVICE: LegalDocument = {
  id: "terms_of_service",
  title: "Terms and Conditions",
  lastUpdated: "2025-01-01",
  effectiveDate: "2025-01-01",
  version: "1.0",
  sections: [
    {
      id: "acceptance_of_terms",
      title: "Acceptance of Terms",
      content: `Welcome to Plate ("we," "us," "our," or the "App"), a restaurant reservation platform operated by Qwerty App. By downloading, installing, accessing, or using Plate, you ("you," "your," or "User") agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, please do not use our App.`,
    },
    {
      id: "eligibility",
      title: "Eligibility",
      content: `• You must be at least 18 years old to use Plate
• You must have the legal capacity to enter into binding contracts
• You must provide accurate, current, and complete information during registration
• You are responsible for maintaining the confidentiality of your account credentials`,
    },
    {
      id: "account_types",
      title: "Account Types",
      content: `Plate offers the following account types:

• Registered Users: Full access to all features with authenticated account
• Guest Users: Limited access to browse restaurants without booking capabilities
• OAuth Users: Authenticated via Google or Apple Sign-In`,
    },
    {
      id: "services_provided",
      title: "Services Provided",
      content: `Plate provides the following services:

Core Services:
• Restaurant discovery and search
• Real-time table reservation booking
• Restaurant information, menus, and reviews
• Location-based restaurant recommendations
• Social features for sharing dining experiences
• Loyalty program with points and tier benefits
• Special offers and promotional deals
• Group booking coordination
• Waitlist management

Service Availability:
• Services are provided "as is" and "as available"
• We do not guarantee uninterrupted or error-free service`,
    },
    {
      id: "user_accounts",
      title: "User Accounts and Registration",
      content:
        "To use certain features of our Service, you must create an account:",
      subsections: [
        {
          id: "account_creation",
          title: "Account Creation",
          content: `• You must provide accurate, current, and complete information
• You must be at least 13 years old to create an account
• You are responsible for maintaining the confidentiality of your account credentials
• You must notify us immediately of any unauthorized access to your account
• One person may not maintain more than one account`,
        },
        {
          id: "account_security",
          title: "Account Security",
          content: `• Use a strong, unique password for your account
• Do not share your login credentials with others
• Log out of your account when using shared devices
• Enable two-factor authentication when available
• Report suspicious activity immediately`,
        },
        {
          id: "account_termination",
          title: "Account Termination",
          content: `• You may close your account at any time through the app settings
• We may suspend or terminate your account for violations of these Terms
• Upon termination, your right to use the Service ceases immediately
• We may retain certain information as required by law or legitimate business interests`,
        },
      ],
    },
    {
      id: "reservations_and_bookings",
      title: "Reservations and Bookings",
      content: "Our reservation system is subject to the following terms:",
      subsections: [
        {
          id: "booking_process",
          title: "Booking Process",
          content: `• Reservations are subject to restaurant availability and confirmation
• We do not guarantee that reservation requests will be accepted
• Restaurants may have their own policies regarding reservations
• Special requests are forwarded to restaurants but not guaranteed
• Confirmation details are sent via email and in-app notifications`,
        },
        {
          id: "booking_modifications",
          title: "Modifications and Cancellations",
          content: `• You may modify or cancel reservations according to restaurant policies
• Some restaurants may charge fees for late cancellations or no-shows
• We are not responsible for cancellation fees imposed by restaurants
• Changes must be made through the app or by contacting the restaurant directly
• We reserve the right to cancel bookings in case of technical issues or force majeure`,
        },
        {
          id: "no_show_policy",
          title: "No-Show Policy",
          content: `• Failure to arrive for confirmed reservations may result in:
  - Restaurant-imposed fees or penalties
  - Negative impact on your booking history
  - Potential restrictions on future bookings
• Multiple no-shows may result in account limitations
• Contact the restaurant directly if you're running late`,
        },
      ],
    },
    {
      id: "payments_and_fees",
      title: "Payments and Fees",
      content: "Payment terms for using our Service:",
      subsections: [
        {
          id: "service_fees",
          title: "Service Fees",
          content: `• Basic reservation services are currently free for users
• Premium features may require subscription fees
• Some restaurants may charge booking deposits or prepayment
• We may introduce service fees with 30 days' notice
• All fees are clearly disclosed before payment`,
        },
        {
          id: "payment_processing",
          title: "Payment Processing",
          content: `• Payments are processed through secure, third-party providers
• We do not store your complete payment information
• You authorize us to charge your selected payment method
• Payment disputes should be reported immediately
• Refunds are subject to restaurant and our refund policies`,
        },
        {
          id: "refund_policy",
          title: "Refund Policy",
          content: `• Refunds for restaurant deposits are subject to individual restaurant policies
• Service fee refunds are considered on a case-by-case basis
• Refund requests must be submitted within 30 days
• Processing time for approved refunds is 5-10 business days
• Chargebacks may result in account suspension`,
        },
      ],
    },
    {
      id: "user_conduct",
      title: "User Conduct and Prohibited Activities",
      content: "You agree to use our Service responsibly and lawfully:",
      subsections: [
        {
          id: "acceptable_use",
          title: "Acceptable Use",
          content: `• Use the Service only for its intended purposes
• Provide accurate information in your profile and bookings
• Respect restaurant staff and other users
• Follow restaurant policies and local laws
• Maintain civility in reviews and communications`,
        },
        {
          id: "prohibited_activities",
          title: "Prohibited Activities",
          content: `You may not:
• Make false or fraudulent reservations
• Use the Service for commercial purposes without authorization
• Attempt to circumvent security measures
• Create fake accounts or impersonate others
• Post inappropriate, defamatory, or illegal content
• Attempt to hack, damage, or disrupt the Service
• Use automated systems to access the Service (bots, scrapers)
• Violate any applicable laws or regulations`,
        },
        {
          id: "consequences",
          title: "Consequences of Violations",
          content: `Violations may result in:
• Warning notifications
• Temporary account suspension
• Permanent account termination
• Legal action for severe violations
• Reporting to relevant authorities
• Forfeiture of unused credits or rewards`,
        },
      ],
    },
    {
      id: "content_and_reviews",
      title: "User Content and Reviews",
      content: "Guidelines for content you submit to our platform:",
      subsections: [
        {
          id: "content_ownership",
          title: "Content Ownership and License",
          content: `• You retain ownership of content you submit
• You grant us a worldwide, royalty-free license to use your content
• This license includes the right to display, modify, and distribute your content
• You represent that you have the right to grant this license
• You may request removal of your content at any time`,
        },
        {
          id: "review_guidelines",
          title: "Review Guidelines",
          content: `Reviews must be:
• Based on genuine dining experiences
• Honest and factual
• Respectful and constructive
• Free from personal attacks or discriminatory language
• Related to the restaurant and dining experience
• Not incentivized by restaurants or third parties`,
        },
        {
          id: "content_moderation",
          title: "Content Moderation",
          content: `• We reserve the right to review and remove content
• Automated systems may flag inappropriate content
• Appeals can be submitted for removed content
• Repeated violations may result in account restrictions
• We do not guarantee the accuracy of user-generated content`,
        },
      ],
    },
    {
      id: "intellectual_property",
      title: "Intellectual Property",
      content: `The Service and its original content, features, and functionality are owned by Table Reserve Lebanon S.A.L. and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.

You may not:
• Copy, modify, or distribute our proprietary content
• Use our trademarks or logos without permission
• Reverse engineer or decompile the app
• Create derivative works based on our Service
• Remove or alter copyright notices

Restaurant information, menus, and photos are provided by restaurant partners and may be subject to their own intellectual property rights.`,
    },
    {
      id: "disclaimers",
      title: "Disclaimers and Limitations",
      content: `IMPORTANT DISCLAIMERS:

• The Service is provided "as is" without warranties of any kind
• We do not guarantee the accuracy of restaurant information
• We are not responsible for dining experiences or food quality
• Restaurant availability and information may change without notice
• We do not warrant that the Service will be uninterrupted or error-free
• Your use of the Service is at your own risk

LIMITATION OF LIABILITY:
To the fullest extent permitted by law, Table Reserve Lebanon S.A.L. shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill.`,
    },
    {
      id: "indemnification",
      title: "Indemnification",
      content: `You agree to indemnify, defend, and hold harmless Table Reserve Lebanon S.A.L., its officers, directors, employees, agents, and affiliates from and against any claims, damages, obligations, losses, liabilities, costs, and expenses arising from:

• Your use of the Service
• Your violation of these Terms
• Your violation of any third-party rights
• Your conduct in connection with the Service
• Any content you submit to the platform

This indemnification obligation will survive termination of these Terms and your use of the Service.`,
    },
    {
      id: "dispute_resolution",
      title: "Dispute Resolution",
      content: `MANDATORY ARBITRATION:
Any disputes arising out of or relating to these Terms or the Service shall be resolved through binding arbitration in accordance with Lebanese law, rather than in court.

GOVERNING LAW:
These Terms shall be governed by and construed in accordance with the laws of the Republic of Lebanon, without regard to conflict of law principles.

JURISDICTION:
Any legal action or proceeding shall be brought exclusively in the courts of Beirut, Lebanon.

CLASS ACTION WAIVER:
You agree that any arbitration or legal proceeding shall be limited to the dispute between you and us individually. You waive any right to participate in class action lawsuits or class-wide arbitration.`,
    },
    {
      id: "changes_to_terms",
      title: "Changes to Terms",
      content: `We may modify these Terms at any time by posting the updated Terms in the app. Changes are effective immediately upon posting unless otherwise specified.

Material changes will be communicated through:
• In-app notifications
• Email notifications to registered users
• Prominent notices on the login screen

Your continued use of the Service after changes are posted constitutes your acceptance of the updated Terms. If you do not agree to the changes, you must stop using the Service.`,
    },
    {
      id: "termination",
      title: "Termination",
      content: `Either party may terminate this agreement at any time:

USER TERMINATION:
• You may delete your account at any time through app settings
• Account deletion is permanent and cannot be undone
• You remain liable for any outstanding obligations

COMPANY TERMINATION:
• We may suspend or terminate your account for violations of these Terms
• We may terminate the Service entirely with reasonable notice
• We may terminate your account immediately for serious violations

EFFECT OF TERMINATION:
• Your right to use the Service ceases immediately
• Outstanding reservations may be honored at restaurant discretion
• Certain provisions of these Terms survive termination`,
    },
    {
      id: "general_provisions",
      title: "General Provisions",
      content: `ENTIRE AGREEMENT:
These Terms constitute the entire agreement between you and Table Reserve Lebanon S.A.L. regarding the Service.

SEVERABILITY:
If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions will remain in full force and effect.

WAIVER:
Our failure to enforce any right or provision of these Terms will not be deemed a waiver of such right or provision.

ASSIGNMENT:
You may not assign your rights under these Terms. We may assign our rights and obligations without restriction.

FORCE MAJEURE:
We are not liable for any failure to perform due to causes beyond our reasonable control, including natural disasters, war, terrorism, strikes, or government actions.`,
    },
    {
      id: "contact_information",
      title: "Contact Information",
      content: `For questions about these Terms of Service, please contact us:

Qwerty App
Legal Department
Address: Beirut, Lebanon
Email: legal@plate-app.com
Phone: +961 1 234 567

For urgent legal matters:
Email: urgent@plate-app.com

Last Updated: January 1, 2025
Effective Date: January 1, 2025`,
    },
  ],
};

// Cookie Policy Document
export const COOKIE_POLICY: LegalDocument = {
  id: "cookie_policy",
  title: "Cookie and Tracking Policy",
  lastUpdated: "2025-01-01",
  effectiveDate: "2025-01-01",
  version: "1.0",
  sections: [
    {
      id: "introduction",
      title: "Introduction",
      content: `This Cookie and Tracking Policy explains how Plate ("we," "us," "our") uses cookies, tracking technologies, and similar tools in our mobile application. As a mobile app, we primarily use app-specific tracking technologies rather than traditional web cookies.`,
    },
    {
      id: "tracking_technologies",
      title: "What Are Tracking Technologies?",
      content: `Mobile App Technologies:
In our mobile app, we use:

• Device Identifiers: Unique IDs assigned to your device
• Advertising IDs: IDFA (iOS) and AAID (Android)
• Analytics SDKs: Software development kits for usage tracking
• Local Storage: App-specific data storage on your device
• Session Tokens: Temporary identifiers for your app session

Purpose of Tracking:
These technologies help us:
• Maintain your session and authentication
• Remember your preferences
• Analyze app usage and performance
• Provide personalized recommendations
• Deliver relevant offers and content
• Improve app functionality`,
    },
    {
      id: "types_of_tracking",
      title: "Types of Tracking We Use",
      content:
        "We use different types of tracking technologies for various purposes:",
      subsections: [
        {
          id: "essential_tracking",
          title: "Essential Tracking",
          content: `Purpose: Required for app functionality
Data Collected:
• Authentication tokens
• Session identifiers
• Security tokens
• User preferences
• Cart/booking state

This tracking is necessary for the app to function and cannot be disabled.`,
        },
        {
          id: "performance_tracking",
          title: "Performance and Analytics Tracking",
          content: `Purpose: Improve app performance and user experience
Data Collected:
• App crash reports and error logs
• Performance metrics and load times
• Feature usage statistics
• User journey and navigation patterns
• Device and OS information

This helps us identify and fix issues, optimize performance, and understand how users interact with our app.`,
        },
        {
          id: "functional_tracking",
          title: "Functional Tracking",
          content: `Purpose: Remember your preferences and enhance usability
Data Collected:
• App settings and preferences
• Search history and filters
• Recently viewed restaurants
• Favorite locations and cuisines
• Accessibility settings

This tracking improves your experience by remembering your choices across app sessions.`,
        },
        {
          id: "marketing_tracking",
          title: "Marketing and Personalization Tracking",
          content: `Purpose: Provide personalized content and relevant advertisements
Data Collected:
• Advertising identifiers (IDFA/AAID)
• Marketing campaign interactions
• App install attribution
• In-app purchase behavior
• Content preferences and engagement

This tracking allows us to show you relevant offers and personalized recommendations.`,
        },
      ],
    },
    {
      id: "third_party_cookies",
      title: "Third-Party Cookies and Services",
      content: `We work with third-party services that may place their own cookies on your device:

ANALYTICS PROVIDERS:
• Google Analytics: App usage and user behavior analysis
• Firebase: Performance monitoring and crash reporting
• Mixpanel: User engagement and retention analytics

PAYMENT PROCESSORS:
• Stripe: Payment processing and fraud prevention
• PayPal: Alternative payment processing

MARKETING PLATFORMS:
• Facebook: Social media integration and advertising
• Google Ads: Search and display advertising
• Apple Search Ads: App Store marketing

CUSTOMER SUPPORT:
• Zendesk: Customer service and support chat
• Intercom: In-app messaging and support

Each third-party service has its own privacy policy governing their use of cookies.`,
    },
    {
      id: "cookie_management",
      title: "Managing Your Cookie Preferences",
      content: "You have control over how we use cookies:",
      subsections: [
        {
          id: "app_settings",
          title: "In-App Cookie Settings",
          content: `You can manage cookie preferences through our app:
• Go to Settings > Privacy > Cookie Preferences
• Toggle different types of cookies on/off
• Essential cookies cannot be disabled
• Changes take effect immediately
• You can change your preferences at any time`,
        },
        {
          id: "device_settings",
          title: "Device-Level Controls",
          content: `iOS DEVICES:
• Settings > Privacy & Security > Tracking
• Settings > Privacy & Security > Apple Advertising
• Limit Ad Tracking option

ANDROID DEVICES:
• Settings > Privacy > Ads
• Opt out of Ads Personalization
• Reset Advertising ID

These settings affect all apps on your device.`,
        },
        {
          id: "browser_settings",
          title: "Web Browser Settings",
          content: `If you access our Service through a web browser:
• Most browsers allow you to control cookies through settings
• You can block all cookies or only third-party cookies
• You can delete existing cookies
• Some features may not work with cookies disabled

Consult your browser's help documentation for specific instructions.`,
        },
      ],
    },
    {
      id: "consequences_of_disabling",
      title: "Consequences of Disabling Cookies",
      content: `Disabling certain cookies may affect your experience:

ESSENTIAL COOKIES (Cannot be disabled):
• You will not be able to use the Service without these

PERFORMANCE COOKIES:
• We cannot improve the Service based on usage data
• Technical issues may be harder to identify and fix
• Performance monitoring will be limited

FUNCTIONAL COOKIES:
• Personalization features will not work
• You may need to re-enter preferences each session
• Recommendations will be less relevant

MARKETING COOKIES:
• Advertisements may be less relevant to your interests
• We cannot measure marketing campaign effectiveness
• Social media features may not function properly`,
    },
    {
      id: "data_retention",
      title: "Cookie Data Retention",
      content: `Different types of cookies are retained for different periods:

SESSION COOKIES:
• Deleted when you close the app
• Used for temporary state management

PERSISTENT COOKIES:
• Essential cookies: Up to 2 years
• Performance cookies: Up to 1 year
• Functional cookies: Up to 1 year  
• Marketing cookies: Up to 90 days

THIRD-PARTY COOKIES:
• Retention periods are controlled by third-party services
• Check their privacy policies for specific timeframes
• You can delete these through your device settings

We regularly review and delete expired cookies to minimize data collection.`,
    },
    {
      id: "updates_to_policy",
      title: "Updates to This Cookie Policy",
      content: `We may update this Cookie Policy to reflect changes in:
• The cookies and technologies we use
• Legal and regulatory requirements
• Our business practices
• Industry standards

When we make significant changes:
• We will update the "Last Updated" date
• We will notify you through the app or email
• Continued use constitutes acceptance of the changes
• You can review your cookie preferences at any time

We encourage you to review this policy periodically to stay informed about our use of cookies.`,
    },
    {
      id: "contact_information",
      title: "Contact Us About Cookies",
      content: `If you have questions or concerns about our use of cookies:

Email: privacy@plate-app.com
Phone: +961 1 234 567
Address: Qwerty App, Beirut, Lebanon

For technical issues with cookie settings:
Email: support@plate-app.com

For third-party cookie concerns, you may also need to contact the relevant third-party service directly.

Data Protection Officer: dpo@plate-app.com`,
    },
  ],
};

// Community Guidelines Document
export const COMMUNITY_GUIDELINES: LegalDocument = {
  id: "community_guidelines",
  title: "Community Guidelines",
  lastUpdated: "2025-01-01",
  effectiveDate: "2025-01-01",
  version: "1.0",
  sections: [
    {
      id: "welcome",
      title: "Welcome to the Plate Community!",
      content: `At Plate, we're building a vibrant community of food lovers, restaurant enthusiasts, and dining adventurers. These guidelines help ensure everyone has a positive experience discovering and sharing great dining moments.`,
    },
    {
      id: "community_values",
      title: "Our Community Values",
      content: "Our community is built on these core values:",
      subsections: [
        {
          id: "authenticity",
          title: "Authenticity",
          content: `• Share genuine experiences
• Post real photos from your visits
• Write honest, balanced reviews
• Be yourself`,
        },
        {
          id: "respect",
          title: "Respect",
          content: `• Treat everyone with kindness
• Value diverse opinions and tastes
• Respect cultural differences
• Consider how your words affect others`,
        },
        {
          id: "helpfulness",
          title: "Helpfulness",
          content: `• Provide constructive feedback
• Share useful tips and recommendations
• Answer questions when you can
• Support local restaurants`,
        },
        {
          id: "inclusivity",
          title: "Inclusivity",
          content: `• Welcome all community members
• Celebrate diverse cuisines
• Make everyone feel valued
• Stand against discrimination`,
        },
      ],
    },
    {
      id: "creating_great_content",
      title: "Creating Great Content",
      content: "Help others make great dining decisions with quality content:",
      subsections: [
        {
          id: "reviews_that_help",
          title: "Reviews That Help Others",
          content: `Write reviews that provide value:
• Share specific details about your experience
• Mention what you ordered and how it tasted
• Describe the atmosphere and service quality
• Include helpful tips for future diners
• Be honest about both positives and areas for improvement
• Consider the restaurant's style and price point
• Update reviews if your experience changes over time`,
        },
        {
          id: "quality_photos",
          title: "Quality Photos and Media",
          content: `Share photos that showcase the experience:
• Take photos that represent the actual food and atmosphere
• Ensure good lighting and clear images
• Respect other diners' privacy
• Follow restaurant photography policies
• Share a variety of shots (food, interior, presentation)
• Avoid heavily edited or misleading images
• Caption photos with helpful context`,
        },
        {
          id: "helpful_information",
          title: "Helpful Information Sharing",
          content: `Provide useful details for the community:
• Share menu highlights and recommendations
• Mention special dietary accommodations
• Note accessibility features
• Describe parking and transportation options
• Share information about busy times and wait periods
• Mention special events or promotions
• Provide context about pricing and value`,
        },
      ],
    },
    {
      id: "prohibited_content",
      title: "Prohibited Content and Behavior",
      content:
        "The following content and behaviors are not allowed on our platform:",
      subsections: [
        {
          id: "fake_content",
          title: "Fake and Misleading Content",
          content: `• Fake reviews or reviews of restaurants you haven't visited
• Misleading information about restaurants or dining experiences
• Artificially inflated or deflated ratings
• Reviews written by restaurant owners about their own establishments
• Coordinated review campaigns or vote manipulation
• Impersonating other users or restaurant staff`,
        },
        {
          id: "inappropriate_content",
          title: "Inappropriate Content",
          content: `• Offensive, discriminatory, or hate speech
• Content that promotes violence or illegal activities
• Sexually explicit or inappropriate material
• Personal attacks or harassment of users or restaurant staff
• Defamatory or libelous statements
• Content that violates intellectual property rights`,
        },
        {
          id: "commercial_violations",
          title: "Commercial and Promotional Violations",
          content: `• Unauthorized commercial promotions or advertisements
• Soliciting business or customers through the platform
• Offering or requesting compensation for reviews
• Competing restaurant owners posting negative reviews
• Excessive self-promotion or spam
• Attempting to manipulate search results or rankings`,
        },
        {
          id: "platform_abuse",
          title: "Platform Abuse",
          content: `• Creating multiple accounts to circumvent restrictions
• Attempting to hack or compromise platform security
• Using automated tools or bots
• Scraping data from the platform without permission
• Attempting to reverse engineer the application
• Violating rate limits or usage restrictions`,
        },
      ],
    },
    {
      id: "dispute_resolution",
      title: "Handling Disputes and Conflicts",
      content: "When conflicts arise, we encourage constructive resolution:",
      subsections: [
        {
          id: "restaurant_disputes",
          title: "Disputes with Restaurants",
          content: `FIRST STEPS:
• Try to resolve issues directly with the restaurant
• Be polite and give restaurants a chance to address concerns
• Understand that mistakes can happen and staff are human
• Consider the restaurant's perspective and constraints

IF DIRECT RESOLUTION FAILS:
• Contact our support team for assistance
• Provide detailed information about the issue
• Include relevant booking information and documentation
• Be open to mediation and compromise
• Focus on fair and reasonable solutions`,
        },
        {
          id: "user_disputes",
          title: "Disputes with Other Users",
          content: `COMMUNITY CONFLICT RESOLUTION:
• Address disagreements respectfully and constructively
• Focus on the issue, not personal attacks
• Be open to different perspectives and experiences
• Use our reporting tools for serious violations
• Contact our community team for assistance with ongoing conflicts

REPORTING GUIDELINES:
• Report content that violates our guidelines
• Provide specific examples and context
• Use the reporting feature rather than public confrontation
• Be patient while we investigate reported issues`,
        },
      ],
    },
    {
      id: "consequences",
      title: "Consequences for Guideline Violations",
      content:
        "Violations of these guidelines may result in various consequences:",
      subsections: [
        {
          id: "content_actions",
          title: "Content-Related Actions",
          content: `• Content removal or editing requirements
• Temporary restriction of posting privileges
• Review or rating adjustments
• Content flagging or warnings
• Requirement to revise inappropriate content`,
        },
        {
          id: "account_actions",
          title: "Account-Related Actions",
          content: `• Warning notifications and educational resources
• Temporary suspension of account features
• Restriction of certain platform privileges
• Permanent account suspension for serious violations
• Reporting to relevant authorities for illegal activity`,
        },
        {
          id: "appeal_process",
          title: "Appeal Process",
          content: `If you believe action was taken in error:
• Contact our support team with your concern
• Provide detailed explanation of your position
• Include any relevant evidence or context
• Be respectful and patient during the review process
• Accept final decisions gracefully if your appeal is denied`,
        },
      ],
    },
    {
      id: "special_programs",
      title: "Special Programs and Recognition",
      content: "We celebrate and recognize valuable community contributors:",
      subsections: [
        {
          id: "elite_reviewers",
          title: "Elite Reviewer Program",
          content: `RECOGNITION FOR TOP CONTRIBUTORS:
• High-quality, helpful reviews
• Consistent community participation
• Positive community interactions
• Adherence to all guidelines
• Special badges and recognition
• Exclusive events and opportunities`,
        },
        {
          id: "community_champions",
          title: "Community Champions",
          content: `LEADERSHIP OPPORTUNITIES:
• Help new users understand the platform
• Moderate community discussions
• Provide feedback on platform improvements
• Assist with guideline enforcement
• Special recognition and privileges`,
        },
      ],
    },
    {
      id: "guideline_updates",
      title: "Updates to Community Guidelines",
      content: `These guidelines may be updated to reflect:
• Changes in platform features
• Evolution of community needs
• Legal and regulatory requirements
• Feedback from community members
• Industry best practices

NOTIFICATION OF CHANGES:
• In-app notifications for significant updates
• Email notifications to active community members
• Highlighted changes in the guidelines section
• Grace period for adapting to new requirements
• Opportunity to provide feedback on proposed changes`,
    },
    {
      id: "getting_help",
      title: "Getting Help and Support",
      content: `COMMUNITY SUPPORT RESOURCES:
• Help Center with detailed guides and FAQs
• Community forums for peer-to-peer assistance
• Video tutorials for platform features
• Live chat support during business hours
• Email support for complex issues

REPORTING AND FEEDBACK:
• In-app reporting tools for violations
• Community feedback surveys
• Suggestion box for platform improvements
• Direct contact with community managers
• Regular town hall meetings with leadership

CONTACT INFORMATION:
• Community Support: community@plate-app.com
• Content Issues: content@plate-app.com
• General Support: support@plate-app.com
• Phone: +961 1 234 567`,
    },
  ],
};

// Data Processing Agreement Document
export const DATA_PROCESSING_AGREEMENT: LegalDocument = {
  id: "data_processing_agreement",
  title: "Data Processing Agreement",
  lastUpdated: "2025-01-01",
  effectiveDate: "2025-01-01",
  version: "1.0",
  sections: [
    {
      id: "introduction",
      title: "Introduction",
      content: `This Data Processing Agreement ("DPA") forms part of the agreement between Qwerty App ("Data Processor," "Plate," "we," "us") and the Restaurant Partner ("Data Controller," "you") for the provision of restaurant reservation services through the Plate platform.`,
    },
    {
      id: "definitions",
      title: "Definitions",
      content: "Key terms used in this agreement:",
      subsections: [
        {
          id: "key_terms",
          title: "Key Terms",
          content: `• "Personal Data": Any information relating to an identified or identifiable natural person
• "Processing": Any operation performed on Personal Data
• "Data Subject": The individual to whom Personal Data relates (end users/diners)
• "Controller": Restaurant Partner determines purposes and means of processing
• "Data Breach": Unauthorized access, loss, disclosure, or alteration of Personal Data
• "Sub-processor": Third party services engaged by Plate
• "Applicable Laws": GDPR, CCPA, and other relevant data protection regulations`,
        },
      ],
    },
    {
      id: "scope_and_roles",
      title: "Scope and Roles",
      content: "This section defines the data processing relationship:",
      subsections: [
        {
          id: "relationship",
          title: "Relationship",
          content: `• Controller: Restaurant Partner determines purposes and means of processing
• Processor: Plate processes data on behalf of Controller
• Joint Processing: Certain activities may involve joint controllership`,
        },
        {
          id: "data_categories",
          title: "Data Categories",
          content: `Personal Data processed includes:
• Customer names and contact information
• Booking details and preferences
• Dietary requirements and restrictions
• Special requests and occasions
• Loyalty program participation
• Review and feedback data`,
        },
      ],
    },
    {
      id: "processor_obligations",
      title: "Processor Obligations",
      content: "Plate's commitments as a data processor:",
      subsections: [
        {
          id: "compliance",
          title: "Compliance",
          content: `Plate shall:
• Process Personal Data only on documented instructions
• Ensure confidentiality of processing personnel
• Implement appropriate technical and organizational measures
• Assist with data subject rights requests
• Notify Controller of data breaches within 72 hours
• Delete or return Personal Data upon termination
• Maintain records of processing activities`,
        },
        {
          id: "security_measures",
          title: "Security Measures",
          content: `Technical and organizational measures include:
• Encryption of data in transit and at rest
• Access controls and authentication
• Regular security assessments and audits
• Staff training on data protection
• Incident response procedures
• Business continuity and disaster recovery`,
        },
      ],
    },
    {
      id: "controller_obligations",
      title: "Controller Obligations",
      content: "Restaurant Partner responsibilities:",
      subsections: [
        {
          id: "lawful_basis",
          title: "Lawful Basis and Instructions",
          content: `Restaurant Partner shall:
• Ensure lawful basis for all processing activities
• Provide clear and documented processing instructions
• Obtain necessary consents from data subjects
• Maintain privacy notices and disclosures
• Respond to data subject rights requests
• Notify relevant supervisory authorities of breaches`,
        },
        {
          id: "data_accuracy",
          title: "Data Accuracy and Minimization",
          content: `Restaurant Partner must:
• Ensure Personal Data is accurate and up-to-date
• Limit data collection to what is necessary
• Establish appropriate retention periods
• Regularly review and update data processing practices
• Train staff on data protection requirements`,
        },
      ],
    },
    {
      id: "data_transfers",
      title: "International Data Transfers",
      content: `Where Personal Data is transferred internationally:
• Adequate safeguards will be implemented
• Standard Contractual Clauses may be used
• Data subjects' rights will be protected
• Regular monitoring of transfer adequacy
• Documentation of transfer impact assessments`,
    },
    {
      id: "liability_and_indemnity",
      title: "Liability and Indemnification",
      content: `• Each party is liable for damages caused by their own violations
• Controller liable for unlawful processing instructions
• Processor liable for unauthorized processing or non-compliance
• Mutual indemnification for third-party claims
• Limitation of liability as set forth in main agreement`,
    },
    {
      id: "term_and_termination",
      title: "Term and Termination",
      content: `• This DPA remains in effect while Personal Data is processed
• Either party may terminate with reasonable notice
• Upon termination, Processor will delete or return all Personal Data
• Certain provisions survive termination (liability, confidentiality)
• Data retention for legal compliance purposes may continue`,
    },
  ],
};

// Data Protection Policy Document
export const DATA_PROTECTION_POLICY: LegalDocument = {
  id: "data_protection_policy",
  title: "Data Protection Policy",
  lastUpdated: "2025-01-01",
  effectiveDate: "2025-01-01",
  version: "1.0",
  sections: [
    {
      id: "introduction",
      title: "Introduction and Scope",
      content: `This Data Protection Policy outlines Table Reserve Lebanon S.A.L.'s commitment to protecting personal data and complying with applicable data protection laws and regulations.

This policy applies to all personal data processing activities conducted by Table Reserve, including data collected through our mobile application, website, and related services.

We are committed to implementing appropriate technical and organizational measures to ensure a level of security appropriate to the risk of processing personal data.`,
    },
    {
      id: "legal_basis",
      title: "Legal Basis for Processing",
      content: "We process personal data based on the following legal grounds:",
      subsections: [
        {
          id: "consent",
          title: "Consent",
          content: `• Marketing communications and promotional offers
• Location tracking for personalized recommendations
• Sharing data with third-party partners for enhanced services
• Cookies and tracking technologies (where required)
• Participation in surveys and research studies`,
        },
        {
          id: "contract",
          title: "Contract Performance",
          content: `• Processing reservations and bookings
• Managing user accounts and profiles
• Facilitating communication with restaurants
• Processing payments and managing billing
• Providing customer support services`,
        },
        {
          id: "legitimate_interests",
          title: "Legitimate Interests",
          content: `• Improving our services and user experience
• Preventing fraud and ensuring platform security
• Conducting analytics and performance monitoring
• Developing new features and services
• Managing business operations and administration`,
        },
        {
          id: "legal_obligations",
          title: "Legal Obligations",
          content: `• Complying with financial regulations and tax requirements
• Responding to law enforcement requests
• Meeting regulatory reporting requirements
• Implementing court orders and legal judgments
• Maintaining records for audit and compliance purposes`,
        },
      ],
    },
    {
      id: "data_categories",
      title: "Categories of Personal Data",
      content: "We process the following categories of personal data:",
      subsections: [
        {
          id: "identity_data",
          title: "Identity and Contact Data",
          content: `• Full name and preferred name
• Email address and phone number
• Postal address and billing information
• Profile picture and avatar
• Date of birth (for age verification)
• Government-issued ID (when required)`,
        },
        {
          id: "account_data",
          title: "Account and Authentication Data",
          content: `• Username and account credentials
• Account preferences and settings
• Login history and session information
• Two-factor authentication data
• Security questions and answers
• Password reset tokens`,
        },
        {
          id: "transaction_data",
          title: "Transaction and Financial Data",
          content: `• Reservation and booking details
• Payment information and billing history
• Loyalty program data and rewards
• Promotional codes and discounts used
• Refund and cancellation records
• Credit card and payment method information`,
        },
        {
          id: "behavioral_data",
          title: "Behavioral and Usage Data",
          content: `• App usage patterns and navigation
• Search queries and filters applied
• Restaurants viewed and bookings made
• Reviews and ratings provided
• Communication with restaurants and support
• Feature usage and engagement metrics`,
        },
        {
          id: "technical_data",
          title: "Technical and Device Data",
          content: `• Device identifiers and characteristics
• IP address and network information
• Operating system and app version
• Location data (when permitted)
• Crash reports and error logs
• Performance and analytics data`,
        },
      ],
    },
    {
      id: "data_sources",
      title: "Sources of Personal Data",
      content: "We collect personal data from various sources:",
      subsections: [
        {
          id: "direct_collection",
          title: "Direct Collection from Users",
          content: `• Account registration and profile creation
• Reservation bookings and modifications
• Customer support interactions
• Survey responses and feedback
• Social media account connections
• Newsletter and marketing subscriptions`,
        },
        {
          id: "automatic_collection",
          title: "Automatic Data Collection",
          content: `• App usage and interaction data
• Device and technical information
• Location data (with permission)
• Cookies and tracking technologies
• Error reports and crash data
• Performance and analytics metrics`,
        },
        {
          id: "third_party_sources",
          title: "Third-Party Sources",
          content: `• Restaurant partners (booking confirmations, visit data)
• Payment processors (transaction data)
• Social media platforms (profile information)
• Marketing partners (with user consent)
• Data brokers and aggregators (for verification)
• Public databases and directories`,
        },
      ],
    },
    {
      id: "data_sharing",
      title: "Data Sharing and Recipients",
      content:
        "We share personal data with the following categories of recipients:",
      subsections: [
        {
          id: "restaurant_partners",
          title: "Restaurant Partners",
          content: `DATA SHARED:
• Name and contact information for reservations
• Party size and dining preferences
• Special requests and dietary restrictions
• Booking history for loyalty programs
• Review and rating information (anonymized)

PURPOSE:
• Facilitating restaurant bookings and service
• Enabling personalized dining experiences
• Managing loyalty and rewards programs
• Improving restaurant services and offerings`,
        },
        {
          id: "service_providers",
          title: "Service Providers and Vendors",
          content: `CATEGORIES OF PROVIDERS:
• Cloud hosting and infrastructure providers
• Payment processing companies
• Customer support platforms
• Analytics and marketing tools
• Security and fraud prevention services
• Legal and professional service providers

DATA PROTECTION MEASURES:
• Contractual data protection obligations
• Regular security assessments and audits
• Limitation of data access to necessary purposes
• Requirement for equivalent data protection standards`,
        },
        {
          id: "legal_authorities",
          title: "Legal and Regulatory Authorities",
          content: `CIRCUMSTANCES FOR DISCLOSURE:
• Valid legal process (subpoenas, court orders)
• Law enforcement investigations
• Regulatory compliance requirements
• National security matters
• Prevention of fraud or illegal activities
• Protection of rights and safety

SAFEGUARDS:
• Legal review of all requests
• Challenge of overly broad requests
• Notification to users when legally permitted
• Minimal data disclosure principle`,
        },
      ],
    },
    {
      id: "data_security",
      title: "Data Security Measures",
      content:
        "We implement comprehensive security measures to protect personal data:",
      subsections: [
        {
          id: "technical_safeguards",
          title: "Technical Safeguards",
          content: `ENCRYPTION:
• Data encrypted in transit using TLS 1.3
• Data encrypted at rest using AES-256
• End-to-end encryption for sensitive communications
• Encrypted database storage and backups

ACCESS CONTROLS:
• Multi-factor authentication for all systems
• Role-based access control (RBAC)
• Principle of least privilege access
• Regular access reviews and updates
• Automated access logging and monitoring`,
        },
        {
          id: "organizational_measures",
          title: "Organizational Measures",
          content: `PERSONNEL SECURITY:
• Background checks for employees with data access
• Regular data protection training and awareness
• Confidentiality agreements and obligations
• Clear data handling procedures and policies
• Incident response and breach notification procedures

VENDOR MANAGEMENT:
• Due diligence assessments of third-party providers
• Contractual data protection requirements
• Regular security audits and assessments
• Monitoring of vendor compliance and performance`,
        },
        {
          id: "incident_response",
          title: "Incident Response and Breach Management",
          content: `INCIDENT DETECTION:
• Automated security monitoring and alerting
• Regular vulnerability assessments and penetration testing
• Continuous threat intelligence and analysis
• Employee reporting mechanisms for suspected incidents

BREACH RESPONSE:
• Immediate containment and damage assessment
• Notification to relevant authorities within 72 hours
• User notification for high-risk breaches
• Forensic analysis and root cause investigation
• Remediation measures and security improvements`,
        },
      ],
    },
    {
      id: "data_retention",
      title: "Data Retention and Deletion",
      content:
        "We retain personal data only as long as necessary for legitimate purposes:",
      subsections: [
        {
          id: "retention_periods",
          title: "Standard Retention Periods",
          content: `ACCOUNT DATA:
• Active accounts: Retained while account is active
• Inactive accounts: Deleted after 3 years of inactivity
• Closed accounts: Deleted within 30 days of closure

TRANSACTION DATA:
• Booking records: 7 years (legal requirement)
• Payment data: 7 years (financial regulations)
• Marketing data: Until consent is withdrawn

COMMUNICATIONS:
• Customer support: 3 years from last interaction
• Marketing communications: Until unsubscribe
• Legal notices: As required by applicable law`,
        },
        {
          id: "deletion_procedures",
          title: "Data Deletion Procedures",
          content: `AUTOMATED DELETION:
• Scheduled deletion based on retention policies
• Regular cleanup of expired data
• Automated purging of temporary files and logs

MANUAL DELETION:
• User-requested account deletion
• Right to erasure requests
• Court orders and legal requirements
• Security incident response

VERIFICATION:
• Confirmation of successful data deletion
• Audit trails for deletion activities
• Third-party notification of deletions where required`,
        },
      ],
    },
    {
      id: "user_rights",
      title: "Individual Rights and Requests",
      content:
        "We respect and facilitate the exercise of individual data protection rights:",
      subsections: [
        {
          id: "access_rights",
          title: "Right of Access",
          content: `WHAT YOU CAN REQUEST:
• Confirmation of data processing activities
• Categories of personal data being processed
• Purposes and legal basis for processing
• Recipients or categories of recipients
• Retention periods for your data
• Source of data if not collected directly

HOW TO REQUEST:
• In-app data export feature
• Email request to privacy@tablereserve.com
• Written request with identity verification
• Response within 30 days of valid request`,
        },
        {
          id: "correction_rights",
          title: "Right to Rectification",
          content: `SCOPE OF CORRECTIONS:
• Updating inaccurate personal data
• Completing incomplete information
• Correcting outdated contact details
• Updating preferences and settings

PROCESS:
• Self-service corrections through app settings
• Customer support assistance for complex changes
• Notification to third parties when required
• Verification of identity for sensitive changes`,
        },
        {
          id: "deletion_rights",
          title: "Right to Erasure",
          content: `GROUNDS FOR DELETION:
• Personal data no longer necessary for original purpose
• Withdrawal of consent where consent was the legal basis
• Objection to processing for legitimate interests
• Unlawful processing of personal data
• Compliance with legal obligations

LIMITATIONS:
• Freedom of expression and information
• Compliance with legal obligations
• Public interest or scientific research
• Establishment, exercise, or defense of legal claims`,
        },
        {
          id: "portability_rights",
          title: "Right to Data Portability",
          content: `PORTABLE DATA INCLUDES:
• Account and profile information
• Booking history and preferences
• Reviews and ratings provided
• Communication history
• Settings and configurations

DELIVERY METHODS:
• Structured data export (JSON, CSV formats)
• Secure download links
• Direct transmission to another service (where feasible)
• Physical media for large datasets (upon request)`,
        },
      ],
    },
    {
      id: "international_transfers",
      title: "International Data Transfers",
      content:
        "When we transfer data internationally, we ensure adequate protection:",
      subsections: [
        {
          id: "transfer_mechanisms",
          title: "Transfer Mechanisms",
          content: `ADEQUACY DECISIONS:
• Transfers to countries with adequate protection levels
• Regular monitoring of adequacy status
• Additional safeguards when adequacy is withdrawn

STANDARD CONTRACTUAL CLAUSES:
• EU Standard Contractual Clauses (SCCs)
• UK International Data Transfer Agreement (IDTA)
• Additional technical and organizational measures
• Regular compliance monitoring and audits

BINDING CORPORATE RULES:
• Internal data protection policies for group companies
• Consistent global data protection standards
• Regular compliance assessments and updates`,
        },
        {
          id: "transfer_safeguards",
          title: "Additional Safeguards",
          content: `TECHNICAL MEASURES:
• Enhanced encryption for international transfers
• Secure transmission protocols and channels
• Access controls and authentication requirements
• Data minimization for cross-border transfers

LEGAL PROTECTIONS:
• Contractual data protection obligations
• Rights of redress for data subjects
• Cooperation with supervisory authorities
• Notification requirements for breaches

ONGOING MONITORING:
• Regular assessment of transfer adequacy
• Updates to safeguards based on legal developments
• Documentation of transfer impact assessments`,
        },
      ],
    },
    {
      id: "contact_information",
      title: "Contact Information and Complaints",
      content: `DATA PROTECTION CONTACTS:

Data Protection Officer:
Email: dpo@plate-app.com
Phone: +961 1 234 568
Address: Qwerty App, DPO Office, Beirut, Lebanon

Privacy Team:
Email: privacy@plate-app.com
Phone: +961 1 234 567

MAKING COMPLAINTS:
If you believe your data protection rights have been violated:
1. Contact our Data Protection Officer first
2. File a complaint with the relevant supervisory authority
3. Seek legal advice if necessary

SUPERVISORY AUTHORITY:
[Relevant Lebanese Data Protection Authority]
[Contact details and complaint procedures]

We are committed to resolving data protection concerns promptly and transparently.`,
    },
  ],
};

// Export all legal documents
export const LEGAL_DOCUMENTS = {
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
  COOKIE_POLICY,
  COMMUNITY_GUIDELINES,
  DATA_PROCESSING_AGREEMENT,
  DATA_PROTECTION_POLICY,
} as const;

export type LegalDocumentType = keyof typeof LEGAL_DOCUMENTS;

// Helper functions for accessing legal documents
export const getLegalDocument = (type: LegalDocumentType): LegalDocument => {
  return LEGAL_DOCUMENTS[type];
};

export const getAllLegalDocuments = (): LegalDocument[] => {
  return Object.values(LEGAL_DOCUMENTS);
};

export const getLegalDocumentMetadata = () => {
  return Object.entries(LEGAL_DOCUMENTS).map(([key, doc]) => ({
    id: key,
    title: doc.title,
    lastUpdated: doc.lastUpdated,
    version: doc.version,
  }));
};
