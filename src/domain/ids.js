export function createId(prefix, randomUUID = crypto.randomUUID.bind(crypto)) {
  return `${prefix}_${randomUUID()}`;
}
