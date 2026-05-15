/**
 * Pluggable unique-ID generator. Each call returns a fresh, collision-resistant
 * string. The default uses `crypto.randomUUID()`. Tests inject a sequential
 * counter so generated IDs are deterministic and assertion-friendly.
 */
export interface IIdGenerator {
	next(): string;
}
