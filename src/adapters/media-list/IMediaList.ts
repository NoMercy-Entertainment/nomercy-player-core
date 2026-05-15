import type { BasePlaylistItem } from '../../types';

export type MediaListEvent = 'change' | 'append' | 'prepend' | 'insert' | 'remove' | 'move' | 'clear' | 'shuffle' | 'sort' | 'current';

/**
 * Cursor-aware ordered list contract shared by both player libraries.
 *
 * Both `NMMusicPlayer` and `NMVideoPlayer` delegate their queue methods to a
 * single `MediaList<T>` instance rather than maintaining parallel list state.
 * Consumers subscribe to typed events rather than polling.
 */
export interface IMediaList<T extends BasePlaylistItem> {
	get(): ReadonlyArray<T>;
	set(items: T[]): void;
	length(): number;
	current(): T | undefined;
	currentIndex(): number;
	replaceItem(item: T): void;
	setCurrent(target: T | string | number | ((item: T) => boolean)): void;
	peekNext(): T | undefined;
	peekPrevious(): T | undefined;
	append(item: T | T[]): void;
	prepend(item: T | T[]): void;
	insert(item: T | T[], index: number): void;
	remove(id: string | number): void;
	removeAt(index: number): void;
	move(from: number, to: number): void;
	clear(): void;
	shuffle(): void;
	sort(compare: (a: T, b: T) => number): void;
	dispose(): void;
}
