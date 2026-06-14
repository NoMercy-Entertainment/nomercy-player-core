/**
 * Queue ingest pipeline tests.
 *
 * Every item entering the queue must pass through:
 *   1. The package-supplied `normalizePlaylistItem` (when the player class defines one).
 *   2. The consumer's `transformPlaylistItem` config callback.
 * In that order, on every entry path (queue / queueAppend / queuePrepend / queueInsert).
 */

import type { BasePlaylistItem } from '../types';
import { describe, expect, it } from 'vitest';
import { MediaList } from '../adapters/media-list/default';
import { queueMethods } from '../core/mixins/queue';

interface IngestTestItem extends BasePlaylistItem {
	normalized?: boolean;
	transformed?: boolean;
}

function makeInternals(opts: {
	normalize?: (item: BasePlaylistItem) => BasePlaylistItem;
	transform?: (item: BasePlaylistItem) => BasePlaylistItem;
}): ThisParameterType<typeof queueMethods.queue> {
	return {
		_queueList: new MediaList<BasePlaylistItem>(),
		_backlogList: new MediaList<BasePlaylistItem>(),
		_queueWired: true,
		normalizePlaylistItem: opts.normalize,
		options: { transformPlaylistItem: opts.transform },
		emit: () => {},
	} as unknown as ThisParameterType<typeof queueMethods.queue>;
}

describe('queue ingest pipeline', () => {
	const normalize = (item: BasePlaylistItem): BasePlaylistItem => ({ ...item, normalized: true } as IngestTestItem);
	const transform = (item: BasePlaylistItem): BasePlaylistItem => ({ ...item, transformed: true } as IngestTestItem);

	it('queue(items) runs normalizer then consumer transform', () => {
		const internals = makeInternals({ normalize, transform });
		queueMethods.queue.call(internals, [{ id: 1 }]);

		const [item] = queueMethods.queue.call(internals) as ReadonlyArray<IngestTestItem>;
		expect(item).toMatchObject({ id: 1, normalized: true, transformed: true });
	});

	it('queueAppend / queuePrepend / queueInsert all ingest', () => {
		const internals = makeInternals({ normalize, transform });
		queueMethods.queue.call(internals, [{ id: 0 }]);

		queueMethods.queueAppend.call(internals, { id: 1 });
		queueMethods.queuePrepend.call(internals, [{ id: 2 }]);
		queueMethods.queueInsert.call(internals, { id: 3 }, 1);

		const items = queueMethods.queue.call(internals) as ReadonlyArray<IngestTestItem>;
		expect(items).toHaveLength(4);
		for (const item of items) {
			expect(item.normalized).toBe(true);
			expect(item.transformed).toBe(true);
		}
	});

	it('works with only a normalizer, only a transform, or neither', () => {
		const onlyNormalize = makeInternals({ normalize });
		queueMethods.queue.call(onlyNormalize, [{ id: 1 }]);
		expect((queueMethods.queue.call(onlyNormalize) as ReadonlyArray<IngestTestItem>)[0]).toMatchObject({ normalized: true });

		const onlyTransform = makeInternals({ transform });
		queueMethods.queue.call(onlyTransform, [{ id: 1 }]);
		expect((queueMethods.queue.call(onlyTransform) as ReadonlyArray<IngestTestItem>)[0]).toMatchObject({ transformed: true });

		const neither = makeInternals({});
		queueMethods.queue.call(neither, [{ id: 1 }]);
		expect((queueMethods.queue.call(neither) as ReadonlyArray<IngestTestItem>)[0]).toEqual({ id: 1 });
	});
});
