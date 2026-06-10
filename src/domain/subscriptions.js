import { DomainError } from './errors.js';
import { createId } from './ids.js';

export const SLOT_STATUS = Object.freeze({
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  CONSUMED: 'consumed',
  REFUNDED: 'refunded',
});

export function createSubscription(
  {
    id,
    studentId,
    subject,
    lessonCount,
    price,
    paidAt = null,
    createdAt,
  },
  randomUUID,
) {
  if (!studentId) {
    throw new DomainError('STUDENT_REQUIRED', 'studentId is required');
  }
  if (!Number.isInteger(lessonCount) || lessonCount <= 0) {
    throw new DomainError(
      'INVALID_LESSON_COUNT',
      'lessonCount must be a positive integer',
    );
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new DomainError('INVALID_PRICE', 'price must be a non-negative number');
  }

  const subscriptionId = id || createId('subscription', randomUUID);
  const slotPrice = lessonCount === 0 ? 0 : price / lessonCount;

  return {
    id: subscriptionId,
    studentId,
    subject: subject || 'Подготовка к школе',
    lessonCount,
    price,
    paidAt,
    createdAt,
    status: 'active',
    slots: Array.from({ length: lessonCount }, (_, index) => ({
      id: createId('slot', randomUUID),
      subscriptionId,
      position: index + 1,
      status: SLOT_STATUS.AVAILABLE,
      lessonId: null,
      consumedAt: null,
      refundedAt: null,
      amount: slotPrice,
    })),
  };
}

export function reserveSlot(slot, lessonId) {
  if (slot.status === SLOT_STATUS.CONSUMED) {
    throw new DomainError('SLOT_ALREADY_CONSUMED', 'Slot is already consumed');
  }
  if (slot.status === SLOT_STATUS.REFUNDED) {
    throw new DomainError('SLOT_REFUNDED', 'Refunded slot cannot be reserved');
  }
  if (
    slot.status === SLOT_STATUS.RESERVED &&
    slot.lessonId &&
    slot.lessonId !== lessonId
  ) {
    throw new DomainError(
      'SLOT_ALREADY_RESERVED',
      'Slot is reserved by another lesson',
    );
  }

  return { ...slot, status: SLOT_STATUS.RESERVED, lessonId };
}

export function consumeSlot(slot, lessonId, consumedAt) {
  if (slot.status === SLOT_STATUS.CONSUMED) {
    throw new DomainError('SLOT_ALREADY_CONSUMED', 'Slot is already consumed');
  }
  if (slot.status === SLOT_STATUS.REFUNDED) {
    throw new DomainError('SLOT_REFUNDED', 'Refunded slot cannot be consumed');
  }
  if (slot.lessonId && slot.lessonId !== lessonId) {
    throw new DomainError(
      'SLOT_LESSON_MISMATCH',
      'Slot belongs to another lesson',
    );
  }

  return {
    ...slot,
    status: SLOT_STATUS.CONSUMED,
    lessonId,
    consumedAt,
  };
}
