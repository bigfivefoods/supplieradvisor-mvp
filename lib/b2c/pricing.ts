/**
 * B2C is free on SupplierAdvisor.
 *
 * Members, patients, hire renters and other end customers never pay SA
 * a subscription or a platform take-rate. Brands may charge their own
 * gym / clinic / hire prices. Companies that operate Advisors still pay
 * the company SaaS (and, for HireAdvisor, supplier-side commission).
 */

export const B2C_PLATFORM_SUBSCRIPTION_ZAR = 0;
export const B2C_CUSTOMER_TAKE_RATE_PCT = 0;
export const B2C_IS_FREE = true;

export const B2C_FREE_COPY = {
  short: 'Free for members and customers',
  line: 'SA Member, hire renters, gym members and clinic patients pay nothing to SupplierAdvisor®.',
  hire:
    'You pay the hire rental and any refundable deposit the brand sets. No platform fee on top.',
  vsCompany:
    'Company workspaces are billed separately. The same login can run a business without changing this free personal wallet.',
} as const;
