export type { DefaultTranslatorOptions, ITranslator } from './ITranslator';
export { DefaultTranslator, bcp47FallbackChain } from './translator';
export { createNetworkTranslationLoader } from './loaders/translation-loader';
export type { NetworkTranslationLoader, NetworkTranslationLoaderOptions } from './loaders/translation-loader';
export { translationsFromGlob, getLazyTranslationLoader, LAZY_TRANSLATIONS_MARKER } from './loaders/translations-glob';
export type { GlobModule } from './loaders/translations-glob';
