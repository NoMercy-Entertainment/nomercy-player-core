import {
	PluginError,
	ResourceError,
	StateError,
} from '../errors';


// ──────────────────────────────────────────────────────────────────────────
// Error helpers
// ──────────────────────────────────────────────────────────────────────────

export function stateError(code: string, message: string, context?: Record<string, unknown>): StateError {
	return new StateError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		context,
	});
}

export function resourceError(code: string, message: string, context?: Record<string, unknown>): ResourceError {
	return new ResourceError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		context,
	});
}

export function pluginErrorFactory(code: string, message: string, context?: Record<string, unknown>): PluginError {
	return new PluginError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		context,
	});
}
