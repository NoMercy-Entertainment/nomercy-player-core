export type { DefaultTranslatorOptions, ITranslator } from './ITranslator';
export { createNetworkTranslationLoader } from './loaders/translation-loader';
export type { NetworkTranslationLoader, NetworkTranslationLoaderOptions } from './loaders/translation-loader';
export { getLazyTranslationLoader, LAZY_TRANSLATIONS_MARKER, translationsFromGlob } from './loaders/translations-glob';
export type { GlobModule } from './loaders/translations-glob';
export { bcp47FallbackChain, DefaultTranslator } from './translator';
