import { DomainError } from './errors.js';

const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function assertIsoDateTime(value, field = 'scheduledAt') {
  if (typeof value !== 'string' || !ISO_DATE_TIME.test(value)) {
    throw new DomainError(
      'INVALID_DATE_TIME',
      `${field} must be an ISO date-time with a timezone`,
    );
  }

  if (Number.isNaN(Date.parse(value))) {
    throw new DomainError('INVALID_DATE_TIME', `${field} is not a valid date`);
  }

  return value;
}
