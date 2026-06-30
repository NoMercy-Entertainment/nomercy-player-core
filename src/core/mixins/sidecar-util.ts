// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { BasePlaylistItem, Chapter } from '../../types';

// ──────────────────────────────────────────────────────────────────────────
// Language code normalization.
//
// HLS manifests use BCP-47 / ISO 639-1 two-letter codes ("de", "en", "fr").
// Sidecar tracks produced by the NoMercy media encoder use ISO 639-2/B
// bibliographic codes ("ger", "eng", "fre"). Dedup must treat all variants of
// the same language as equal; otherwise a sidecar "ger" track and a manifest
// "de" track never match and both appear in the menu.
//
// The table maps every ISO 639-2/B code (and the corresponding 639-2/T where
// it differs) to the canonical ISO 639-1 two-letter code. Codes already in
// ISO 639-1 form pass through unchanged.
// ──────────────────────────────────────────────────────────────────────────

/** ISO 639-2/B + 639-2/T → ISO 639-1 canonical form. */
const LANG_CANONICAL: Readonly<Record<string, string>> = {
	// A
	aar: 'aa',
	abk: 'ab',
	afr: 'af',
	aka: 'ak',
	alb: 'sq',
	sqi: 'sq',
	amh: 'am',
	ara: 'ar',
	arg: 'an',
	arm: 'hy',
	hye: 'hy',
	asm: 'as',
	ava: 'av',
	ave: 'ae',
	aym: 'ay',
	aze: 'az',
	// B
	bak: 'ba',
	bam: 'bm',
	baq: 'eu',
	eus: 'eu',
	bel: 'be',
	ben: 'bn',
	bih: 'bh',
	bis: 'bi',
	bod: 'bo',
	tib: 'bo',
	bos: 'bs',
	bre: 'br',
	bul: 'bg',
	bur: 'my',
	mya: 'my',
	// C
	cat: 'ca',
	ces: 'cs',
	cze: 'cs',
	cha: 'ch',
	che: 'ce',
	chu: 'cu',
	chv: 'cv',
	cor: 'kw',
	cos: 'co',
	cre: 'cr',
	cym: 'cy',
	wel: 'cy',
	// D
	dan: 'da',
	deu: 'de',
	ger: 'de',
	div: 'dv',
	dzo: 'dz',
	// E
	ell: 'el',
	gre: 'el',
	eng: 'en',
	epo: 'eo',
	est: 'et',
	// F
	fao: 'fo',
	fas: 'fa',
	per: 'fa',
	fij: 'fj',
	fin: 'fi',
	fra: 'fr',
	fre: 'fr',
	fry: 'fy',
	ful: 'ff',
	// G
	gla: 'gd',
	gle: 'ga',
	glg: 'gl',
	glv: 'gv',
	grn: 'gn',
	guj: 'gu',
	// H
	hat: 'ht',
	hau: 'ha',
	heb: 'he',
	her: 'hz',
	hin: 'hi',
	hmo: 'ho',
	hrv: 'hr',
	hun: 'hu',
	// I
	ibo: 'ig',
	ido: 'io',
	iii: 'ii',
	iku: 'iu',
	ile: 'ie',
	ina: 'ia',
	ind: 'id',
	ipk: 'ik',
	isl: 'is',
	ice: 'is',
	ita: 'it',
	// J
	jav: 'jv',
	jpn: 'ja',
	// K
	kal: 'kl',
	kan: 'kn',
	kas: 'ks',
	kat: 'ka',
	geo: 'ka',
	kau: 'kr',
	kaz: 'kk',
	khm: 'km',
	kik: 'ki',
	kin: 'rw',
	kir: 'ky',
	kom: 'kv',
	kon: 'kg',
	kor: 'ko',
	kua: 'kj',
	kur: 'ku',
	// L
	lao: 'lo',
	lat: 'la',
	lav: 'lv',
	lim: 'li',
	lin: 'ln',
	lit: 'lt',
	ltz: 'lb',
	lub: 'lu',
	lug: 'lg',
	// M
	mac: 'mk',
	mkd: 'mk',
	mal: 'ml',
	mao: 'mi',
	mri: 'mi',
	mar: 'mr',
	mah: 'mh',
	may: 'ms',
	msa: 'ms',
	mlg: 'mg',
	mlt: 'mt',
	mon: 'mn',
	// N
	nau: 'na',
	nav: 'nv',
	nbl: 'nr',
	nde: 'nd',
	ndo: 'ng',
	nep: 'ne',
	nld: 'nl',
	dut: 'nl',
	nno: 'nn',
	nob: 'nb',
	nor: 'no',
	nya: 'ny',
	// O
	oci: 'oc',
	oji: 'oj',
	ori: 'or',
	orm: 'om',
	oss: 'os',
	// P
	pan: 'pa',
	pli: 'pi',
	pol: 'pl',
	por: 'pt',
	pus: 'ps',
	// Q
	que: 'qu',
	// R
	roh: 'rm',
	ron: 'ro',
	rum: 'ro',
	run: 'rn',
	rus: 'ru',
	// S
	sag: 'sg',
	san: 'sa',
	sin: 'si',
	slk: 'sk',
	slo: 'sk',
	slv: 'sl',
	sme: 'se',
	smo: 'sm',
	sna: 'sn',
	snd: 'sd',
	som: 'so',
	sot: 'st',
	spa: 'es',
	srd: 'sc',
	srp: 'sr',
	ssw: 'ss',
	sun: 'su',
	swa: 'sw',
	swe: 'sv',
	// T
	tah: 'ty',
	tam: 'ta',
	tat: 'tt',
	tel: 'te',
	tgk: 'tg',
	tgl: 'tl',
	tha: 'th',
	tir: 'ti',
	ton: 'to',
	tsn: 'tn',
	tso: 'ts',
	tuk: 'tk',
	tur: 'tr',
	twi: 'tw',
	// U
	uig: 'ug',
	ukr: 'uk',
	urd: 'ur',
	uzb: 'uz',
	// V
	ven: 've',
	vie: 'vi',
	vol: 'vo',
	// W
	wln: 'wa',
	wol: 'wo',
	// X
	xho: 'xh',
	// Y
	yid: 'yi',
	yor: 'yo',
	// Z
	zha: 'za',
	zho: 'zh',
	chi: 'zh',
	zul: 'zu',
} as const;

/**
 * Normalise a language tag to its ISO 639-1 two-letter form.
 *
 * Handles:
 *  - ISO 639-2/B bibliographic codes ("ger" → "de")
 *  - ISO 639-2/T terminological codes ("deu" → "de")
 *  - ISO 639-1 codes already in short form ("de" → "de")
 *  - BCP-47 tags — only the primary subtag is normalised ("de-AT" → "de")
 *  - `undefined` / empty string → returned as-is
 *
 * The dedup key uses this so "ger", "deu", and "de" all become "de" and
 * therefore compare equal regardless of which form the manifest or sidecar
 * used.
 */
export function normalizeLanguage(lang: string | undefined): string | undefined {
	if (!lang)
		return lang;

	const primary = lang.split('-')[0]!.toLowerCase();
	return LANG_CANONICAL[primary] ?? primary;
}

// ──────────────────────────────────────────────────────────────────────────
// Sidecar track types — structural interfaces for item track fields.
// Items carry inline tracks under `tracks: [{ kind, file, language, ... }]`.
// ──────────────────────────────────────────────────────────────────────────

export interface SidecarTrack {
	id?: string;
	kind?: string;
	file?: string;
	language?: string;
	label?: string;
	type?: string;
}

export interface ItemWithTracks extends BasePlaylistItem {
	tracks?: SidecarTrack[];
	chapters?: Chapter[];
}

export interface ItemWithDefinedTracks extends BasePlaylistItem {
	tracks: SidecarTrack[];
	chapters?: Chapter[];
}

/**
 * Narrows an item to one carrying a non-empty `tracks` array. Items with an
 *  empty array or no field at all fall through to the no-tracks path.
 */
export function hasTracksField(item: BasePlaylistItem): item is ItemWithDefinedTracks {
	return 'tracks' in item
		&& Array.isArray((item as ItemWithTracks).tracks)
		&& (item as ItemWithTracks).tracks!.length > 0;
}
