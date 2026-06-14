// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Equalizer presets, default band layout, and slider ranges.
 *
 * Frequency layout, preset values, and slider ranges are ported verbatim
 * from Fillz's reference equalizer plugin (MIT) so the kit gives consumers
 * the same audio feel he hand-tuned.
 */

/** Marker used by the pre-gain pseudo-band (always at index 0 of `EqBand[]`). */
export type EqBandFrequency = number | 'Pre';

export interface EqBand {
	frequency: EqBandFrequency;
	gain: number;
	q?: number;
	type?: BiquadFilterType;
}

/**
 * A preset's `values` is an array of partial band targets. Only the
 * frequencies listed are applied — entries the consumer omits keep their
 * current gain. Lets a preset target the pre-gain or a single band without
 * resetting the rest of the chain.
 */
export interface EqPreset {
	name: string;
	values: EqBand[];
}

export interface SliderRange {
	min: number;
	max: number;
	step: number;
	default: number;
	totalSteps: number;
}

export interface EqSliderValues {
	pre: SliderRange;
	band: SliderRange;
}

/**
 * Default slider configuration — the pre-gain slider is centred at 0 (which
 * the plugin renders as unity gain via `value + 1` on the `GainNode`); band
 * sliders are ±12 dB.
 */
export const DEFAULT_SLIDER_VALUES: EqSliderValues = {
	pre: {
		min: -1,
		max: 3,
		step: 0.01,
		default: 0,
		totalSteps: 4,
	},
	band: {
		min: -12,
		max: 12,
		step: 0.01,
		default: 0,
		totalSteps: 24,
	},
};

/**
 * Default band layout: pre-gain pseudo-band at index 0, then 10 peaking
 * filters at the same centre frequencies Fillz tuned the presets against.
 *
 * Don't reorder — preset entries match by frequency, not index, but `'Pre'`
 * is conventionally first so consumers iterating bands render the pre-gain
 * slider in canonical position.
 */
export const DEFAULT_BANDS: ReadonlyArray<EqBand> = [
	{
		frequency: 'Pre',
		gain: DEFAULT_SLIDER_VALUES.pre.default,
	},
	{
		frequency: 70,
		gain: DEFAULT_SLIDER_VALUES.band.default,
	},
	{
		frequency: 180,
		gain: DEFAULT_SLIDER_VALUES.band.default,
	},
	{
		frequency: 320,
		gain: DEFAULT_SLIDER_VALUES.band.default,
	},
	{
		frequency: 600,
		gain: DEFAULT_SLIDER_VALUES.band.default,
	},
	{
		frequency: 1000,
		gain: DEFAULT_SLIDER_VALUES.band.default,
	},
	{
		frequency: 3000,
		gain: DEFAULT_SLIDER_VALUES.band.default,
	},
	{
		frequency: 6000,
		gain: DEFAULT_SLIDER_VALUES.band.default,
	},
	{
		frequency: 12000,
		gain: DEFAULT_SLIDER_VALUES.band.default,
	},
	{
		frequency: 14000,
		gain: DEFAULT_SLIDER_VALUES.band.default,
	},
	{
		frequency: 16000,
		gain: DEFAULT_SLIDER_VALUES.band.default,
	},
];

function preset(name: string, values: Array<[number, number]>): EqPreset {
	return {
		name,
		values: values.map(([frequency, gain]) => ({
			frequency,
			gain,
		})),
	};
}

/**
 * 19 built-in presets. Values are dB gains hand-tuned against the
 * 70/180/320/600/1k/3k/6k/12k/14k/16k band layout. `'Custom'` is the
 * canonical "no preset selected" state — applying it leaves the chain at
 * unity for every band so consumer UI can render an explicit "neutral"
 * choice.
 */
export const BUILTIN_PRESETS: ReadonlyArray<EqPreset> = [
	preset('Custom', [
		[70, 0],
		[180, 0],
		[320, 0],
		[600, 0],
		[1000, 0],
		[3000, 0],
		[6000, 0],
		[12000, 0],
		[14000, 0],
		[16000, 0],
	]),
	preset('Classical', [
		[70, 0.375],
		[180, 0.375],
		[320, 0.375],
		[600, 0.375],
		[1000, 0.375],
		[3000, 0.375],
		[6000, -4.5],
		[12000, -4.5],
		[14000, -4.5],
		[16000, -6],
	]),
	preset('Club', [
		[70, 0.375],
		[180, 0.375],
		[320, 2.25],
		[600, 3.75],
		[1000, 3.75],
		[3000, 3.75],
		[6000, 2.25],
		[12000, 0.375],
		[14000, 0.375],
		[16000, 0.375],
	]),
	preset('Dance', [
		[70, 6],
		[180, 4.5],
		[320, 1.5],
		[600, 0],
		[1000, 0],
		[3000, -3.75],
		[6000, -4.5],
		[12000, -4.5],
		[14000, 0],
		[16000, 0],
	]),
	preset('Flat', [
		[70, 0.375],
		[180, 0.375],
		[320, 0.375],
		[600, 0.375],
		[1000, 0.375],
		[3000, 0.375],
		[6000, 0.375],
		[12000, 0.375],
		[14000, 0.375],
		[16000, 0.375],
	]),
	preset('Laptop speakers/headphones', [
		[70, 3],
		[180, 6.75],
		[320, 3.375],
		[600, -2.25],
		[1000, -1.5],
		[3000, 1.125],
		[6000, 3],
		[12000, 6],
		[14000, 7.875],
		[16000, 9],
	]),
	preset('Large hall', [
		[70, 6.375],
		[180, 6.375],
		[320, 3.75],
		[600, 3.75],
		[1000, 0.375],
		[3000, -3],
		[6000, -3],
		[12000, -3],
		[14000, 0.375],
		[16000, 0.375],
	]),
	preset('Party', [
		[70, 4.5],
		[180, 4.5],
		[320, 0.375],
		[600, 0.375],
		[1000, 0.375],
		[3000, 0.375],
		[6000, 0.375],
		[12000, 0.375],
		[14000, 4.5],
		[16000, 4.5],
	]),
	preset('Pop', [
		[70, -1.125],
		[180, 3],
		[320, 4.5],
		[600, 4.875],
		[1000, 3.375],
		[3000, -0.75],
		[6000, -1.5],
		[12000, -1.5],
		[14000, -1.125],
		[16000, -1.125],
	]),
	preset('Reggae', [
		[70, 0.375],
		[180, 0.375],
		[320, -0.375],
		[600, -3.75],
		[1000, 0.375],
		[3000, 4.125],
		[6000, 4.125],
		[12000, 0.375],
		[14000, 0.375],
		[16000, 0.375],
	]),
	preset('Rock', [
		[70, 4.875],
		[180, 3],
		[320, -3.375],
		[600, -4.875],
		[1000, -2.25],
		[3000, 2.625],
		[6000, 5.625],
		[12000, 6.75],
		[14000, 6.75],
		[16000, 6.75],
	]),
	preset('Soft', [
		[70, 3],
		[180, 1.125],
		[320, -0.75],
		[600, -1.5],
		[1000, -0.75],
		[3000, 2.625],
		[6000, 5.25],
		[12000, 6],
		[14000, 6.75],
		[16000, 7.5],
	]),
	preset('Ska', [
		[70, -1.5],
		[180, -3],
		[320, -2.625],
		[600, -0.375],
		[1000, 2.625],
		[3000, 3.75],
		[6000, 5.625],
		[12000, 6],
		[14000, 6.75],
		[16000, 6],
	]),
	preset('Full Bass', [
		[70, 6],
		[180, 6],
		[320, 6],
		[600, 3.75],
		[1000, 1.125],
		[3000, -2.625],
		[6000, -5.25],
		[12000, -6.375],
		[14000, -6.75],
		[16000, -6.75],
	]),
	preset('Soft Rock', [
		[70, 2.625],
		[180, 2.625],
		[320, 1.5],
		[600, -0.375],
		[1000, -2.625],
		[3000, -3.375],
		[6000, -2.25],
		[12000, -0.375],
		[14000, 1.875],
		[16000, 5.625],
	]),
	preset('Full Treble', [
		[70, -6],
		[180, -6],
		[320, -6],
		[600, -2.625],
		[1000, 1.875],
		[3000, 6.75],
		[6000, 9.75],
		[12000, 9.75],
		[14000, 9.75],
		[16000, 10.5],
	]),
	preset('Full Bass & Treble', [
		[70, 4.5],
		[180, 3.75],
		[320, 0.375],
		[600, -4.5],
		[1000, -3],
		[3000, 1.125],
		[6000, 5.25],
		[12000, 6.75],
		[14000, 7.5],
		[16000, 7.5],
	]),
	preset('Live', [
		[70, -3],
		[180, 0.375],
		[320, 2.625],
		[600, 3.375],
		[1000, 3.75],
		[3000, 3.75],
		[6000, 2.625],
		[12000, 1.875],
		[14000, 1.875],
		[16000, 1.5],
	]),
	preset('Techno', [
		[70, 4.875],
		[180, 3.75],
		[320, 0.375],
		[600, -3.375],
		[1000, -3],
		[3000, 0.375],
		[6000, 4.875],
		[12000, 6],
		[14000, 6],
		[16000, 5.625],
	]),
];
